import Database from 'better-sqlite3';
import { initDb, connect, getDbPath, getTemplateFields } from './db.js';
import {
  type ProjectRecord, type ProjectType, type ProjectStatus, type QueryDepth,
  type CapabilityDeclaration, type PortClaim,
  type AreaName,
  validateStatus, toSummary, toStandard, toFull,
  UNASSIGNED_AREA_SENTINEL,
} from './models.js';
import {
  DuplicateProjectError, NotFoundError, InvalidInputError, findClosestMatch,
  InvalidAreaError, InvalidProjectTypeError,
  AreaHasProjectsError, ProjectTypeHasProjectsError,
  InvalidAreaColorError, DuplicateAreaNameError, DuplicateProjectTypeNameError,
} from './errors.js';
import {
  isValidAreaColor, type AreaRow,
} from './areas.js';
import {
  rowToProjectType, type ProjectType as UserProjectType, type ProjectTypeRow,
} from './project-types.js';
import { writeFields, deserializeFieldValue } from './fields.js';
import { discoverPortsInPath, type DiscoveredPort } from './port-discovery.js';
import { computeNextSteps, type NextStep, type ProjectEnrichmentSnapshot } from './next-steps.js';

export const PORT_RANGE_MIN = 3000;
export const PORT_RANGE_MAX = 9999;

export class Registry {
  private _dbPath: string;

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? getDbPath();
    // Ensure DB is initialized
    initDb(this._dbPath);
  }

  get dbPath(): string {
    return this._dbPath;
  }

  private open(): Database.Database {
    return connect(this._dbPath);
  }

  // ── Registration ──────────────────────────────────────────────

  register(opts: {
    name: string;
    type?: ProjectType;
    status: string;
    description?: string;
    goals?: string | string[];
    display_name?: string;
    paths?: string[];
    fields?: Record<string, unknown>;
    producer?: string;
    // spec 0.13: optional structural area + parent
    area?: AreaName | string | null;
    parent_project?: string | null;
  }): number {
    // spec 0.13: type is narrowed to 'project' — callers may still pass it but
    // legacy 'area_of_focus' is rejected at the DB CHECK and surfaced here.
    const type: ProjectType = 'project';
    if (opts.type && opts.type !== 'project') {
      throw new InvalidInputError(
        `Unknown project type: ${opts.type}. Must be 'project' (spec 0.13 retired 'area_of_focus' — use area assignment instead).`
      );
    }
    validateStatus(type, opts.status);
    const displayName = opts.display_name || opts.name;
    const producer = opts.producer ?? 'system';

    const db = this.open();
    try {
      const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(opts.name);
      if (existing) throw new DuplicateProjectError(opts.name);

      // Resolve area_id if provided
      let areaIdForInsert: number | null = null;
      if (opts.area != null) {
        areaIdForInsert = this.resolveAreaIdOrThrow(db, opts.area);
      }

      // Resolve parent_project_id if provided
      let parentIdForInsert: number | null = null;
      if (opts.parent_project != null) {
        if (opts.parent_project === opts.name) {
          throw new InvalidInputError(
            `Cannot set parent: ${opts.name} is a descendant of ${opts.name}. Moving it would create a cycle.`
          );
        }
        const prow = db.prepare('SELECT id FROM projects WHERE name = ?').get(opts.parent_project) as { id: number } | undefined;
        if (!prow) {
          const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
          throw new NotFoundError(opts.parent_project, findClosestMatch(opts.parent_project, allNames.map(r => r.name)));
        }
        parentIdForInsert = prow.id;
      }

      const result = db.prepare(
        `INSERT INTO projects (name, display_name, type, status, description, goals, area_id, parent_project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(opts.name, displayName, type, opts.status, opts.description ?? '', this._serializeGoals(opts.goals), areaIdForInsert, parentIdForInsert);

      const projectId = Number(result.lastInsertRowid);

      if (opts.paths) {
        const insertPath = db.prepare(
          `INSERT INTO project_paths (project_id, path, added_by) VALUES (?, ?, ?)`
        );
        for (const p of opts.paths) {
          insertPath.run(projectId, p, producer);
        }
      }

      if (opts.fields) {
        writeFields(db, projectId, opts.fields, producer);
      }

      return projectId;
    } finally {
      db.close();
    }
  }

  // ── Querying ──────────────────────────────────────────────────

  getProject(name: string, depth: QueryDepth = 'standard'): Record<string, unknown> | null {
    const db = this.open();
    try {
      const record = this.loadRecord(db, { name });
      if (!record) return null;
      return this.formatRecord(db, record, depth);
    } finally {
      db.close();
    }
  }

  /**
   * Get a project by name, throwing NotFoundError with fuzzy suggestion if not found.
   */
  getProjectOrThrow(name: string, depth: QueryDepth = 'standard'): Record<string, unknown> {
    const db = this.open();
    try {
      const record = this.loadRecord(db, { name });
      if (!record) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        const closest = findClosestMatch(name, allNames.map(r => r.name));
        throw new NotFoundError(name, closest);
      }
      return this.formatRecord(db, record, depth);
    } finally {
      db.close();
    }
  }

  listProjects(opts?: {
    depth?: QueryDepth;
    type_filter?: string;
    status_filter?: string;
    area_filter?: string;
  }): Record<string, unknown>[] {
    const depth = opts?.depth ?? 'summary';
    const db = this.open();
    try {
      let sql = 'SELECT p.* FROM projects p';
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (opts?.type_filter) {
        // spec 0.13: only 'project' exists; legacy 'area_of_focus' filter yields 0 rows.
        conditions.push('p.type = ?');
        params.push(opts.type_filter);
      }
      if (opts?.status_filter) {
        conditions.push('p.status = ?');
        params.push(opts.status_filter);
      }
      if (opts?.area_filter) {
        if (opts.area_filter === UNASSIGNED_AREA_SENTINEL) {
          conditions.push('p.area_id IS NULL');
        } else {
          const areaId = this.resolveAreaIdOrThrow(db, opts.area_filter);
          conditions.push('p.area_id = ?');
          params.push(areaId);
        }
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY p.name';

      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map(row => {
        const record = this.rowToRecord(db, row);
        return this.formatRecord(db, record, depth);
      });
    } finally {
      db.close();
    }
  }

  searchProjects(opts: {
    query: string;
    type_filter?: string;
    status_filter?: string;
    area_filter?: string;
  }): Record<string, unknown>[] {
    const db = this.open();
    try {
      const q = `%${opts.query}%`;
      let sql = `
        SELECT DISTINCT p.* FROM projects p
        LEFT JOIN project_fields pf ON pf.project_id = p.id
        WHERE (
          p.name LIKE ? OR p.display_name LIKE ? OR p.description LIKE ?
          OR p.goals LIKE ? OR p.topics LIKE ? OR p.entities LIKE ?
          OR p.concerns LIKE ? OR pf.field_value LIKE ?
        )
      `;
      const params: unknown[] = [q, q, q, q, q, q, q, q];

      if (opts.type_filter) {
        sql += ' AND p.type = ?';
        params.push(opts.type_filter);
      }
      if (opts.status_filter) {
        sql += ' AND p.status = ?';
        params.push(opts.status_filter);
      }
      if (opts.area_filter) {
        if (opts.area_filter === UNASSIGNED_AREA_SENTINEL) {
          sql += ' AND p.area_id IS NULL';
        } else {
          const areaId = this.resolveAreaIdOrThrow(db, opts.area_filter);
          sql += ' AND p.area_id = ?';
          params.push(areaId);
        }
      }
      sql += ' ORDER BY p.name';

      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map(row => {
        const record = this.rowToRecord(db, row);
        return this.formatRecord(db, record, 'summary');
      });
    } finally {
      db.close();
    }
  }

  getRegistryStats(): {
    total: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    by_area: Record<string, number>;
    unassigned: number;
  } {
    const db = this.open();
    try {
      const total = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }).count;
      const typeRows = db.prepare('SELECT type, COUNT(*) as count FROM projects GROUP BY type').all() as { type: string; count: number }[];
      const statusRows = db.prepare('SELECT status, COUNT(*) as count FROM projects GROUP BY status').all() as { status: string; count: number }[];

      const by_type: Record<string, number> = {};
      for (const r of typeRows) by_type[r.type] = r.count;

      const by_status: Record<string, number> = {};
      for (const r of statusRows) by_status[r.status] = r.count;

      // spec 0.26: per-area distribution iterates the live `areas` table —
      // user-managed entities, no canonical-list seed.
      const by_area: Record<string, number> = {};
      const areaRows = db.prepare(`
        SELECT a.name as name, COUNT(p.id) as count
        FROM areas a LEFT JOIN projects p ON p.area_id = a.id
        GROUP BY a.id, a.name
      `).all() as { name: string; count: number }[];
      for (const r of areaRows) by_area[r.name] = r.count;
      const unassigned = (db.prepare('SELECT COUNT(*) as c FROM projects WHERE area_id IS NULL').get() as { c: number }).c;

      return { total, by_type, by_status, by_area, unassigned };
    } finally {
      db.close();
    }
  }

  switchProject(name: string): Record<string, unknown> {
    const db = this.open();
    try {
      const record = this.loadRecord(db, { name });
      if (!record) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        const closest = findClosestMatch(name, allNames.map(r => r.name));
        throw new NotFoundError(name, closest);
      }

      const result = this.formatRecord(db, record, 'full');

      // Add port assignments
      const ports = this.loadPorts(db, record.id);
      if (ports.length > 0) result.ports = ports;

      return result;
    } finally {
      db.close();
    }
  }

  // ── Update / Archive ──────────────────────────────────────────

  updateCore(name: string, updates: {
    status?: string;
    description?: string;
    goals?: string | string[];
    display_name?: string;
    // spec 0.13: structural area + parent on update. Use null to clear.
    area?: AreaName | string | null;
    parent_project?: string | null;
  }): void {
    const db = this.open();
    try {
      const row = db.prepare('SELECT id, type FROM projects WHERE name = ?').get(name) as { id: number; type: string } | undefined;
      if (!row) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        const closest = findClosestMatch(name, allNames.map(r => r.name));
        throw new NotFoundError(name, closest);
      }

      if (updates.status) {
        validateStatus(row.type, updates.status);
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      if (updates.display_name !== undefined) { sets.push('display_name = ?'); params.push(updates.display_name); }
      if (updates.status !== undefined) { sets.push('status = ?'); params.push(updates.status); }
      if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description); }
      if (updates.goals !== undefined) { sets.push('goals = ?'); params.push(this._serializeGoals(updates.goals)); }

      // area/parent handled below via dedicated setters so we get validation + cycle check
      const touchedCore = sets.length > 0;
      if (touchedCore) {
        sets.push("updated_at = datetime('now')");
        params.push(row.id);
        db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      }
    } finally {
      db.close();
    }

    // Delegate area/parent updates to the dedicated setters so validation and
    // cycle-prevention logic live in one place.
    if (updates.area !== undefined) {
      this.setProjectArea(name, updates.area);
    }
    if (updates.parent_project !== undefined) {
      this.setParentProject(name, updates.parent_project);
    }
  }

  // ── Area / Parent structural operations (spec 0.13) ──────────

  /**
   * Resolve an area name (case-sensitive) to an area_id, throwing
   * InvalidAreaError if unknown.
   *
   * Spec 0.26: areas are user-managed entities. Validation runs against the
   * live `areas` table, not against a hardcoded canonical list.
   */
  private resolveAreaIdOrThrow(db: Database.Database, areaName: string): number {
    const row = db.prepare('SELECT id FROM areas WHERE name = ?').get(areaName) as { id: number } | undefined;
    if (!row) {
      throw new InvalidAreaError(areaName);
    }
    return row.id;
  }

  // ── Area CRUD (spec 0.26) ────────────────────────────────────

  /** List all user-managed areas, ordered by name. */
  listAreas(): AreaRow[] {
    const db = this.open();
    try {
      return db.prepare('SELECT id, name, display_name, description, color FROM areas ORDER BY name')
        .all() as AreaRow[];
    } finally {
      db.close();
    }
  }

  /**
   * Create a new area. Throws DuplicateAreaNameError on UNIQUE collision and
   * InvalidAreaColorError on a color outside the curated palette.
   */
  createArea(opts: { name: string; display_name?: string; description?: string; color: string }): AreaRow {
    if (!opts.name || opts.name.trim().length === 0) {
      throw new InvalidInputError('Area name cannot be empty.');
    }
    if (!isValidAreaColor(opts.color)) {
      throw new InvalidAreaColorError(opts.color);
    }
    const db = this.open();
    try {
      const existing = db.prepare('SELECT id FROM areas WHERE name = ?').get(opts.name) as { id: number } | undefined;
      if (existing) throw new DuplicateAreaNameError(opts.name);

      const result = db.prepare(
        `INSERT INTO areas (name, display_name, description, color) VALUES (?, ?, ?, ?)`
      ).run(opts.name, opts.display_name ?? opts.name, opts.description ?? '', opts.color);

      return db.prepare('SELECT id, name, display_name, description, color FROM areas WHERE id = ?')
        .get(result.lastInsertRowid) as AreaRow;
    } finally {
      db.close();
    }
  }

  /**
   * Update an area. The `id` is the stable identity — renames preserve
   * memory routing because area_id never changes. Patch-style: undefined
   * fields are left alone.
   */
  updateArea(id: number, patch: { name?: string; display_name?: string; description?: string; color?: string }): AreaRow {
    const db = this.open();
    try {
      const current = db.prepare('SELECT * FROM areas WHERE id = ?').get(id) as AreaRow | undefined;
      if (!current) throw new InvalidAreaError(id);

      if (patch.color !== undefined && !isValidAreaColor(patch.color)) {
        throw new InvalidAreaColorError(patch.color);
      }
      if (patch.name !== undefined && patch.name !== current.name) {
        const conflict = db.prepare('SELECT id FROM areas WHERE name = ? AND id != ?').get(patch.name, id) as { id: number } | undefined;
        if (conflict) throw new DuplicateAreaNameError(patch.name);
      }

      const next = {
        name: patch.name ?? current.name,
        display_name: patch.display_name ?? current.display_name,
        description: patch.description ?? current.description,
        color: patch.color ?? current.color,
      };
      db.prepare(
        `UPDATE areas SET name = ?, display_name = ?, description = ?, color = ? WHERE id = ?`
      ).run(next.name, next.display_name, next.description, next.color, id);

      return db.prepare('SELECT id, name, display_name, description, color FROM areas WHERE id = ?').get(id) as AreaRow;
    } finally {
      db.close();
    }
  }

  /**
   * Delete an area. Throws AreaHasProjectsError if any project references it
   * (delete-block guard — the UI must show a reassign flow first).
   */
  deleteArea(id: number): void {
    const db = this.open();
    try {
      const area = db.prepare('SELECT name FROM areas WHERE id = ?').get(id) as { name: string } | undefined;
      if (!area) throw new InvalidAreaError(id);

      const count = (db.prepare('SELECT COUNT(*) AS c FROM projects WHERE area_id = ?').get(id) as { c: number }).c;
      if (count > 0) throw new AreaHasProjectsError(area.name, count);

      db.prepare('DELETE FROM areas WHERE id = ?').run(id);
    } finally {
      db.close();
    }
  }

  // ── Project-type CRUD (spec 0.26) ────────────────────────────

  /** List all user-managed project types, ordered by name. */
  listProjectTypes(): UserProjectType[] {
    const db = this.open();
    try {
      const rows = db.prepare(
        `SELECT id, name, default_directory, git_init, template_directory, color, created_at, updated_at
         FROM project_types ORDER BY name`
      ).all() as ProjectTypeRow[];
      return rows.map(rowToProjectType);
    } finally {
      db.close();
    }
  }

  /** Create a new project type. */
  createProjectType(opts: {
    name: string;
    default_directory: string;
    git_init: boolean;
    template_directory?: string | null;
    color?: string | null;
  }): UserProjectType {
    if (!opts.name || opts.name.trim().length === 0) {
      throw new InvalidInputError('Project-type name cannot be empty.');
    }
    if (!opts.default_directory || opts.default_directory.trim().length === 0) {
      throw new InvalidInputError('Project-type default_directory cannot be empty.');
    }
    if (opts.color != null && !isValidAreaColor(opts.color)) {
      throw new InvalidAreaColorError(opts.color);
    }
    const db = this.open();
    try {
      const existing = db.prepare('SELECT id FROM project_types WHERE name = ?').get(opts.name) as { id: number } | undefined;
      if (existing) throw new DuplicateProjectTypeNameError(opts.name);

      const now = Math.floor(Date.now() / 1000);
      const result = db.prepare(
        `INSERT INTO project_types (name, default_directory, git_init, template_directory, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        opts.name,
        opts.default_directory,
        opts.git_init ? 1 : 0,
        opts.template_directory ?? null,
        opts.color ?? null,
        now,
        now,
      );

      const row = db.prepare(
        `SELECT id, name, default_directory, git_init, template_directory, color, created_at, updated_at
         FROM project_types WHERE id = ?`
      ).get(result.lastInsertRowid) as ProjectTypeRow;
      return rowToProjectType(row);
    } finally {
      db.close();
    }
  }

  /** Update a project type. Patch-style. */
  updateProjectType(id: number, patch: {
    name?: string;
    default_directory?: string;
    git_init?: boolean;
    template_directory?: string | null;
    color?: string | null;
  }): UserProjectType {
    const db = this.open();
    try {
      const current = db.prepare(
        `SELECT id, name, default_directory, git_init, template_directory, color, created_at, updated_at
         FROM project_types WHERE id = ?`
      ).get(id) as ProjectTypeRow | undefined;
      if (!current) throw new InvalidProjectTypeError(id);

      if (patch.color !== undefined && patch.color != null && !isValidAreaColor(patch.color)) {
        throw new InvalidAreaColorError(patch.color);
      }
      if (patch.name !== undefined && patch.name !== current.name) {
        const conflict = db.prepare('SELECT id FROM project_types WHERE name = ? AND id != ?').get(patch.name, id) as { id: number } | undefined;
        if (conflict) throw new DuplicateProjectTypeNameError(patch.name);
      }

      const now = Math.floor(Date.now() / 1000);
      const next = {
        name: patch.name ?? current.name,
        default_directory: patch.default_directory ?? current.default_directory,
        git_init: patch.git_init !== undefined ? (patch.git_init ? 1 : 0) : current.git_init,
        template_directory: patch.template_directory !== undefined ? patch.template_directory : current.template_directory,
        color: patch.color !== undefined ? patch.color : current.color,
      };
      db.prepare(
        `UPDATE project_types SET name = ?, default_directory = ?, git_init = ?,
                                  template_directory = ?, color = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        next.name, next.default_directory, next.git_init,
        next.template_directory, next.color, now, id,
      );

      const row = db.prepare(
        `SELECT id, name, default_directory, git_init, template_directory, color, created_at, updated_at
         FROM project_types WHERE id = ?`
      ).get(id) as ProjectTypeRow;
      return rowToProjectType(row);
    } finally {
      db.close();
    }
  }

  /**
   * Delete a project type. Throws ProjectTypeHasProjectsError if any
   * project references it.
   */
  deleteProjectType(id: number): void {
    const db = this.open();
    try {
      const t = db.prepare('SELECT name FROM project_types WHERE id = ?').get(id) as { name: string } | undefined;
      if (!t) throw new InvalidProjectTypeError(id);

      const count = (db.prepare('SELECT COUNT(*) AS c FROM projects WHERE project_type_id = ?').get(id) as { c: number }).c;
      if (count > 0) throw new ProjectTypeHasProjectsError(t.name, count);

      db.prepare('DELETE FROM project_types WHERE id = ?').run(id);
    } finally {
      db.close();
    }
  }

  /** S74: Assign or clear a project's area. Null clears to Unassigned. */
  setProjectArea(name: string, area: AreaName | string | null): Record<string, unknown> {
    const db = this.open();
    try {
      const row = db.prepare('SELECT id FROM projects WHERE name = ?').get(name) as { id: number } | undefined;
      if (!row) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        throw new NotFoundError(name, findClosestMatch(name, allNames.map(r => r.name)));
      }

      let areaId: number | null = null;
      if (area != null) areaId = this.resolveAreaIdOrThrow(db, area);

      db.prepare(
        "UPDATE projects SET area_id = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(areaId, row.id);

      const record = this.loadRecord(db, { projectId: row.id })!;
      return this.formatRecord(db, record, 'standard');
    } finally {
      db.close();
    }
  }

  /**
   * S75/S76: Set or clear a project's parent. Rejects self-parenting and
   * cycles by walking the ancestor chain of the proposed parent upward.
   * Error message format: "Cannot set parent: {child-name} is a descendant of {proposed-parent-name}. Moving it would create a cycle."
   */
  setParentProject(childName: string, parentName: string | null): Record<string, unknown> {
    const db = this.open();
    try {
      const child = db.prepare('SELECT id FROM projects WHERE name = ?').get(childName) as { id: number } | undefined;
      if (!child) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        throw new NotFoundError(childName, findClosestMatch(childName, allNames.map(r => r.name)));
      }

      if (parentName === null) {
        db.prepare("UPDATE projects SET parent_project_id = NULL, updated_at = datetime('now') WHERE id = ?").run(child.id);
        const record = this.loadRecord(db, { projectId: child.id })!;
        return this.formatRecord(db, record, 'standard');
      }

      // Self-parent check
      if (parentName === childName) {
        throw new InvalidInputError(
          `Cannot set parent: ${childName} is a descendant of ${parentName}. Moving it would create a cycle.`
        );
      }

      const parent = db.prepare('SELECT id FROM projects WHERE name = ?').get(parentName) as { id: number } | undefined;
      if (!parent) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        throw new NotFoundError(parentName, findClosestMatch(parentName, allNames.map(r => r.name)));
      }

      // Cycle walker: walk from proposed parent upward through ancestors. If we
      // ever hit the child, the proposed move would create a cycle.
      // Bounded by total project count to terminate on any pathological loop.
      const maxHops = (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c + 1;
      let cursor: number | null = parent.id;
      let hops = 0;
      while (cursor != null) {
        if (hops++ > maxHops) {
          throw new InvalidInputError(
            `Cannot set parent: ${childName} is a descendant of ${parentName}. Moving it would create a cycle.`
          );
        }
        if (cursor === child.id) {
          throw new InvalidInputError(
            `Cannot set parent: ${childName} is a descendant of ${parentName}. Moving it would create a cycle.`
          );
        }
        const next = db.prepare('SELECT parent_project_id FROM projects WHERE id = ?').get(cursor) as { parent_project_id: number | null } | undefined;
        cursor = next?.parent_project_id ?? null;
      }

      db.prepare(
        "UPDATE projects SET parent_project_id = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(parent.id, child.id);

      const record = this.loadRecord(db, { projectId: child.id })!;
      return this.formatRecord(db, record, 'standard');
    } finally {
      db.close();
    }
  }

  archiveProject(name: string): { ports_released: number; capabilities_cleared: number } {
    const db = this.open();
    try {
      const row = db.prepare('SELECT id FROM projects WHERE name = ?').get(name) as { id: number } | undefined;
      if (!row) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        const closest = findClosestMatch(name, allNames.map(r => r.name));
        throw new NotFoundError(name, closest);
      }

      db.prepare("UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(row.id);

      const portsResult = db.prepare('DELETE FROM project_ports WHERE project_id = ?').run(row.id);
      const capsResult = db.prepare('DELETE FROM project_capabilities WHERE project_id = ?').run(row.id);

      return {
        ports_released: portsResult.changes,
        capabilities_cleared: capsResult.changes,
      };
    } finally {
      db.close();
    }
  }

  renameProject(oldName: string, newName: string): void {
    const db = this.open();
    try {
      const row = db.prepare('SELECT id FROM projects WHERE name = ?').get(oldName) as { id: number } | undefined;
      if (!row) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        const closest = findClosestMatch(oldName, allNames.map(r => r.name));
        throw new NotFoundError(oldName, closest);
      }

      const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(newName);
      if (existing) throw new DuplicateProjectError(newName);

      const doRename = db.transaction(() => {
        // Update the project name
        db.prepare("UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?").run(newName, row.id);

        // Rewrite tasks.project_name (TEXT, not FK)
        db.prepare('UPDATE tasks SET project_name = ? WHERE project_name = ?').run(newName, oldName);

        // Rewrite memories.project_id (TEXT, not FK)
        db.prepare('UPDATE memories SET project_id = ? WHERE project_id = ?').run(newName, oldName);

        // Rewrite memory_sources.project_id (TEXT)
        db.prepare('UPDATE memory_sources SET project_id = ? WHERE project_id = ?').run(newName, oldName);
      });

      doRename();
    } finally {
      db.close();
    }
  }

  // ── Profile Enrichment ────────────────────────────────────────

  enrichProject(name: string, profile: {
    goals?: string[];
    topics?: string[];
    entities?: string[];
    concerns?: string[];
  }): { name: string; goals: string[]; topics: string[]; entities: string[]; concerns: string[] } {
    const db = this.open();
    try {
      const row = db.prepare('SELECT id, goals, topics, entities, concerns FROM projects WHERE name = ?')
        .get(name) as { id: number; goals: string; topics: string; entities: string; concerns: string } | undefined;
      if (!row) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        throw new NotFoundError(name, findClosestMatch(name, allNames.map(r => r.name)));
      }

      // Parse existing values
      const existingGoals = this._parseGoalsField(row.goals);
      const existingTopics: string[] = JSON.parse(row.topics || '[]');
      const existingEntities: string[] = JSON.parse(row.entities || '[]');
      const existingConcerns: string[] = JSON.parse(row.concerns || '[]');

      // Merge with union semantics
      const mergedGoals = profile.goals
        ? [...new Set([...existingGoals, ...profile.goals])]
        : existingGoals;
      const mergedTopics = profile.topics
        ? [...new Set([...existingTopics, ...profile.topics.map(t => t.toLowerCase())])]
        : existingTopics;
      const mergedEntities = profile.entities
        ? [...new Set([...existingEntities, ...profile.entities.map(e => e.toLowerCase())])]
        : existingEntities;
      const mergedConcerns = profile.concerns
        ? [...new Set([...existingConcerns, ...profile.concerns.map(c => c.toLowerCase())])]
        : existingConcerns;

      // Write back
      db.prepare(`UPDATE projects SET
        goals = ?, topics = ?, entities = ?, concerns = ?,
        updated_at = datetime('now')
        WHERE id = ?`).run(
        JSON.stringify(mergedGoals),
        JSON.stringify(mergedTopics),
        JSON.stringify(mergedEntities),
        JSON.stringify(mergedConcerns),
        row.id,
      );

      return { name, goals: mergedGoals, topics: mergedTopics, entities: mergedEntities, concerns: mergedConcerns };
    } finally {
      db.close();
    }
  }

  /** Parse goals from either JSON array or legacy comma-separated string */
  private _parseGoalsField(goals: string): string[] {
    if (!goals) return [];
    const trimmed = goals.trim();
    if (trimmed.startsWith('[')) {
      try { return JSON.parse(trimmed); } catch { /* fall through */ }
    }
    // Legacy: newline-separated list (with or without bullet prefix) → split into items;
    // single-line prose → single-element array (commas inside a sentence are not delimiters).
    if (trimmed.includes('\n')) {
      return trimmed.split('\n').map(g => g.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    }
    return [trimmed];
  }

  /** Serialize goals to canonical JSON-array storage. Accepts string[], JSON-array string, or legacy prose. */
  private _serializeGoals(goals: string | string[] | undefined): string {
    if (goals === undefined) return '';
    if (Array.isArray(goals)) return JSON.stringify(goals);
    if (goals === '') return '';
    return JSON.stringify(this._parseGoalsField(goals));
  }

  // ── Fields ────────────────────────────────────────────────────

  updateFields(name: string, fields: Record<string, unknown>, producer: string, paths?: string[]): void {
    const db = this.open();
    try {
      const row = db.prepare('SELECT id FROM projects WHERE name = ?').get(name) as { id: number } | undefined;
      if (!row) {
        const allNames = db.prepare('SELECT name FROM projects').all() as { name: string }[];
        throw new NotFoundError(name, findClosestMatch(name, allNames.map(r => r.name)));
      }

      writeFields(db, row.id, fields, producer);

      if (paths) {
        const insertPath = db.prepare(
          `INSERT OR IGNORE INTO project_paths (project_id, path, added_by) VALUES (?, ?, ?)`
        );
        for (const p of paths) insertPath.run(row.id, p, producer);
      }

      db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(row.id);
    } finally {
      db.close();
    }
  }

  // ── Batch ─────────────────────────────────────────────────────

  batchUpdate(opts: {
    type_filter?: string;
    status_filter?: string;
    area_filter?: string;
    status?: string;
    description?: string;
    goals?: string | string[];
    display_name?: string;
    dry_run?: boolean;
  }): { count: number; projects: string[]; dry_run: boolean } {
    if (!opts.type_filter && !opts.status_filter && !opts.area_filter) {
      throw new InvalidInputError('batch_update requires at least one filter (type_filter, status_filter, or area_filter).');
    }
    const hasUpdates = opts.status !== undefined || opts.description !== undefined ||
      opts.goals !== undefined || opts.display_name !== undefined;
    if (!hasUpdates) {
      throw new InvalidInputError('batch_update requires at least one field to update.');
    }

    const db = this.open();
    try {
      let sql = 'SELECT id, name, type FROM projects';
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (opts.type_filter) { conditions.push('type = ?'); params.push(opts.type_filter); }
      if (opts.status_filter) { conditions.push('status = ?'); params.push(opts.status_filter); }
      if (opts.area_filter) {
        if (opts.area_filter === UNASSIGNED_AREA_SENTINEL) {
          conditions.push('area_id IS NULL');
        } else {
          const areaId = this.resolveAreaIdOrThrow(db, opts.area_filter);
          conditions.push('area_id = ?');
          params.push(areaId);
        }
      }
      sql += ' WHERE ' + conditions.join(' AND ');

      const matched = db.prepare(sql).all(...params) as { id: number; name: string; type: string }[];
      const names = matched.map(m => m.name);

      if (opts.dry_run) {
        return { count: matched.length, projects: names, dry_run: true };
      }

      // Validate status for each project type if changing status
      if (opts.status) {
        for (const m of matched) {
          validateStatus(m.type, opts.status);
        }
      }

      const updateInTransaction = db.transaction(() => {
        for (const m of matched) {
          const sets: string[] = [];
          const updateParams: unknown[] = [];

          if (opts.display_name !== undefined) { sets.push('display_name = ?'); updateParams.push(opts.display_name); }
          if (opts.status !== undefined) { sets.push('status = ?'); updateParams.push(opts.status); }
          if (opts.description !== undefined) { sets.push('description = ?'); updateParams.push(opts.description); }
          if (opts.goals !== undefined) { sets.push('goals = ?'); updateParams.push(this._serializeGoals(opts.goals)); }
          sets.push("updated_at = datetime('now')");
          updateParams.push(m.id);

          db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...updateParams);

          // Archive cleanup
          if (opts.status === 'archived') {
            db.prepare('DELETE FROM project_ports WHERE project_id = ?').run(m.id);
            db.prepare('DELETE FROM project_capabilities WHERE project_id = ?').run(m.id);
          }
        }
      });

      updateInTransaction();

      return { count: matched.length, projects: names, dry_run: false };
    } finally {
      db.close();
    }
  }

  // ── Ports ─────────────────────────────────────────────────────

  claimPort(projectName: string, serviceLabel: string, port?: number, protocol: string = 'tcp', claimedBy: string = 'system'): number {
    const db = this.open();
    try {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined;
      if (!project) throw new NotFoundError(projectName);

      let portNum: number;
      if (port !== undefined) {
        if (port < PORT_RANGE_MIN || port > PORT_RANGE_MAX) {
          throw new InvalidInputError(`Port ${port} is out of range (${PORT_RANGE_MIN}-${PORT_RANGE_MAX}).`);
        }
        // Check if already claimed
        const existing = db.prepare(
          `SELECT pp.port, p.name, pp.service_label FROM project_ports pp JOIN projects p ON p.id = pp.project_id WHERE pp.port = ?`
        ).get(port) as { port: number; name: string; service_label: string } | undefined;

        if (existing) {
          throw new InvalidInputError(`Port ${port} is already claimed by ${existing.name} (${existing.service_label}).`);
        }
        portNum = port;
      } else {
        portNum = this.autoAllocatePort(db);
      }

      db.prepare(
        `INSERT INTO project_ports (project_id, port, service_label, protocol, claimed_by) VALUES (?, ?, ?, ?, ?)`
      ).run(project.id, portNum, serviceLabel, protocol, claimedBy);

      return portNum;
    } finally {
      db.close();
    }
  }

  releasePort(projectName: string, port: number): boolean {
    const db = this.open();
    try {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined;
      if (!project) return false;

      const result = db.prepare('DELETE FROM project_ports WHERE project_id = ? AND port = ?').run(project.id, port);
      return result.changes > 0;
    } finally {
      db.close();
    }
  }

  checkPort(port: number): { available: boolean; port: number; project?: string; service_label?: string; protocol?: string } {
    const db = this.open();
    try {
      const row = db.prepare(
        `SELECT pp.port, p.name as project, pp.service_label, pp.protocol
         FROM project_ports pp JOIN projects p ON p.id = pp.project_id
         WHERE pp.port = ?`
      ).get(port) as { port: number; project: string; service_label: string; protocol: string } | undefined;

      if (!row) return { available: true, port };
      return { available: false, port, project: row.project, service_label: row.service_label, protocol: row.protocol };
    } finally {
      db.close();
    }
  }

  listProjectPorts(projectName: string): PortClaim[] {
    const db = this.open();
    try {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined;
      if (!project) return [];
      return this.loadPorts(db, project.id);
    } finally {
      db.close();
    }
  }

  discoverPorts(projectName: string): { claimed: DiscoveredPort[]; skipped: { port: number; reason: string }[]; summary: string } {
    const db = this.open();
    try {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined;
      if (!project) throw new NotFoundError(projectName);

      const pathRows = db.prepare('SELECT path FROM project_paths WHERE project_id = ?').all(project.id) as { path: string }[];
      if (pathRows.length === 0) {
        return { claimed: [], skipped: [], summary: 'No filesystem paths registered for this project.' };
      }

      const claimed: DiscoveredPort[] = [];
      const skipped: { port: number; reason: string }[] = [];

      for (const { path } of pathRows) {
        const discovered = discoverPortsInPath(path);
        for (const dp of discovered) {
          if (dp.port < PORT_RANGE_MIN || dp.port > PORT_RANGE_MAX) {
            skipped.push({ port: dp.port, reason: `Out of range (${PORT_RANGE_MIN}-${PORT_RANGE_MAX})` });
            continue;
          }

          const existing = db.prepare(
            'SELECT pp.port, p.name FROM project_ports pp JOIN projects p ON p.id = pp.project_id WHERE pp.port = ?'
          ).get(dp.port) as { port: number; name: string } | undefined;

          if (existing) {
            if (existing.name === projectName) {
              // Already claimed by this project — idempotent skip
              continue;
            }
            skipped.push({ port: dp.port, reason: `Already claimed by ${existing.name}` });
            continue;
          }

          db.prepare(
            'INSERT INTO project_ports (project_id, port, service_label, protocol, claimed_by) VALUES (?, ?, ?, ?, ?)'
          ).run(project.id, dp.port, dp.service_label, 'tcp', 'discovery');

          claimed.push(dp);
        }
      }

      const summary = `Discovered ${claimed.length + skipped.length} port(s): ${claimed.length} claimed, ${skipped.length} skipped.`;
      return { claimed, skipped, summary };
    } finally {
      db.close();
    }
  }

  // ── Capabilities ──────────────────────────────────────────────

  registerCapabilities(projectName: string, capabilities: CapabilityDeclaration[], producer: string = 'fctry'): number {
    const db = this.open();
    try {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined;
      if (!project) throw new NotFoundError(projectName);

      const doReplace = db.transaction(() => {
        db.prepare('DELETE FROM project_capabilities WHERE project_id = ?').run(project.id);

        const insert = db.prepare(`
          INSERT INTO project_capabilities
          (project_id, name, capability_type, description, inputs, outputs, producer, requires_auth, invocation_model, audience)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const cap of capabilities) {
          insert.run(
            project.id,
            cap.name,
            cap.capability_type,
            cap.description ?? '',
            cap.inputs ?? '',
            cap.outputs ?? '',
            producer,
            cap.requires_auth != null ? (cap.requires_auth ? 1 : 0) : null,
            cap.invocation_model ?? '',
            cap.audience ?? '',
          );
        }
      });

      doReplace();
      return capabilities.length;
    } finally {
      db.close();
    }
  }

  /**
   * Replace capability rows for a specific (project, capability_type) pair.
   *
   * Unlike `registerCapabilities`, which replaces the project's entire capability
   * set, this scopes the replace to one `capability_type` at a time. Used by
   * setlist's startup self-registration (§2.11) so that a failure introspecting
   * one surface (e.g. CLI commands) does not wipe the other surfaces.
   *
   * Contract:
   * - All rows with (project_id, capability_type) are deleted and replaced.
   * - Rows of other types for the same project are untouched.
   * - An empty `capabilities` array clears the (project, type) set.
   * - Every incoming capability must have `capability_type === capabilityType`;
   *   the method does not accept mixed types (guard against caller error).
   * - Unknown project throws NotFoundError.
   */
  registerCapabilitiesForType(
    projectName: string,
    capabilityType: string,
    capabilities: CapabilityDeclaration[],
    producer: string = 'fctry',
  ): number {
    if (!capabilityType) {
      throw new Error('registerCapabilitiesForType: capabilityType is required');
    }
    for (const cap of capabilities) {
      if (cap.capability_type !== capabilityType) {
        throw new Error(
          `registerCapabilitiesForType: mixed types not allowed — expected '${capabilityType}' but got '${cap.capability_type}' on capability '${cap.name}'`,
        );
      }
    }

    const db = this.open();
    try {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined;
      if (!project) throw new NotFoundError(projectName);

      const doReplace = db.transaction(() => {
        db.prepare(
          'DELETE FROM project_capabilities WHERE project_id = ? AND capability_type = ?',
        ).run(project.id, capabilityType);

        const insert = db.prepare(`
          INSERT INTO project_capabilities
          (project_id, name, capability_type, description, inputs, outputs, producer, requires_auth, invocation_model, audience)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const cap of capabilities) {
          insert.run(
            project.id,
            cap.name,
            cap.capability_type,
            cap.description ?? '',
            cap.inputs ?? '',
            cap.outputs ?? '',
            producer,
            cap.requires_auth != null ? (cap.requires_auth ? 1 : 0) : null,
            cap.invocation_model ?? '',
            cap.audience ?? '',
          );
        }
      });

      doReplace();
      return capabilities.length;
    } finally {
      db.close();
    }
  }

  queryCapabilities(opts?: {
    project_name?: string;
    capability_type?: string;
    keyword?: string;
  }): Record<string, unknown>[] {
    const db = this.open();
    try {
      let sql = `
        SELECT pc.*, p.name as project_name FROM project_capabilities pc
        JOIN projects p ON p.id = pc.project_id
      `;
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (opts?.project_name) {
        conditions.push('p.name = ?');
        params.push(opts.project_name);
      }
      if (opts?.capability_type) {
        conditions.push('pc.capability_type = ?');
        params.push(opts.capability_type);
      }
      if (opts?.keyword) {
        const kw = `%${opts.keyword}%`;
        conditions.push('(pc.name LIKE ? OR pc.description LIKE ?)');
        params.push(kw, kw);
      }
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY p.name, pc.name';

      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map(row => {
        const result: Record<string, unknown> = {
          project: row.project_name,
          name: row.name,
          type: row.capability_type,
          description: row.description,
        };
        if (row.inputs) result.inputs = row.inputs;
        if (row.outputs) result.outputs = row.outputs;
        if (row.requires_auth != null) result.requires_auth = Boolean(row.requires_auth);
        if (row.invocation_model) result.invocation_model = row.invocation_model;
        if (row.audience) result.audience = row.audience;
        return result;
      });
    } finally {
      db.close();
    }
  }

  // ── Project Digests ──────────────────────────────────────────

  /**
   * Read a single project's digest of the given kind. Returns null if no digest
   * exists. Staleness is computed against `current_spec_version` when provided;
   * when omitted, stale defaults to false (caller can't distinguish fresh from
   * stale without knowing the current version).
   */
  getProjectDigest(project_name: string, opts?: { digest_kind?: string; current_spec_version?: string }): {
    project_name: string;
    digest_kind: string;
    digest_text: string;
    spec_version: string;
    producer: string;
    generated_at: string;
    token_count: number | null;
    named_terms: string[];
    stale: boolean;
  } | null {
    const kind = opts?.digest_kind ?? 'essence';
    const db = this.open();
    try {
      const row = db.prepare(`
        SELECT pd.digest_kind, pd.digest_text, pd.spec_version, pd.producer, pd.generated_at, pd.token_count, pd.named_terms
        FROM project_digests pd
        JOIN projects p ON p.id = pd.project_id
        WHERE p.name = ? AND pd.digest_kind = ?
      `).get(project_name, kind) as
        | { digest_kind: string; digest_text: string; spec_version: string; producer: string; generated_at: string; token_count: number | null; named_terms: string }
        | undefined;
      if (!row) return null;
      const stale = opts?.current_spec_version != null ? row.spec_version !== opts.current_spec_version : false;
      return {
        project_name,
        digest_kind: row.digest_kind,
        digest_text: row.digest_text,
        spec_version: row.spec_version,
        producer: row.producer,
        generated_at: row.generated_at,
        token_count: row.token_count,
        named_terms: parseTermsField(row.named_terms),
        stale,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Batch read digests. Returns a map keyed by project name. Missing projects
   * are omitted unless `include_missing: true`, in which case they appear with
   * `digest_text: null`. `include_stale` defaults to true; set to false to
   * exclude stale digests (requires `current_spec_versions` to compute).
   */
  getProjectDigests(opts?: {
    project_names?: string[];
    digest_kind?: string;
    include_missing?: boolean;
    include_stale?: boolean;
    current_spec_versions?: Record<string, string>;
  }): Record<string, {
    digest_text: string | null;
    spec_version: string | null;
    producer: string | null;
    generated_at: string | null;
    token_count: number | null;
    named_terms: string[];
    stale: boolean;
  }> {
    const kind = opts?.digest_kind ?? 'essence';
    const includeMissing = opts?.include_missing ?? false;
    const includeStale = opts?.include_stale ?? true;
    const currentVersions = opts?.current_spec_versions ?? {};
    const db = this.open();
    try {
      let sql = `
        SELECT p.name AS project_name, pd.digest_text, pd.spec_version, pd.producer, pd.generated_at, pd.token_count, pd.named_terms
        FROM projects p
        LEFT JOIN project_digests pd ON pd.project_id = p.id AND pd.digest_kind = ?
      `;
      const params: unknown[] = [kind];
      if (opts?.project_names && opts.project_names.length > 0) {
        const placeholders = opts.project_names.map(() => '?').join(', ');
        sql += ` WHERE p.name IN (${placeholders})`;
        params.push(...opts.project_names);
      }
      sql += ' ORDER BY p.name';
      const rows = db.prepare(sql).all(...params) as {
        project_name: string;
        digest_text: string | null;
        spec_version: string | null;
        producer: string | null;
        generated_at: string | null;
        token_count: number | null;
        named_terms: string | null;
      }[];
      const result: Record<string, {
        digest_text: string | null;
        spec_version: string | null;
        producer: string | null;
        generated_at: string | null;
        token_count: number | null;
        named_terms: string[];
        stale: boolean;
      }> = {};
      for (const r of rows) {
        const hasDigest = r.digest_text != null;
        if (!hasDigest && !includeMissing) continue;
        const current = currentVersions[r.project_name];
        const stale = hasDigest && current != null ? r.spec_version !== current : false;
        if (stale && !includeStale) continue;
        result[r.project_name] = {
          digest_text: r.digest_text,
          spec_version: r.spec_version,
          producer: r.producer,
          generated_at: r.generated_at,
          token_count: r.token_count,
          named_terms: parseTermsField(r.named_terms),
          stale,
        };
      }
      return result;
    } finally {
      db.close();
    }
  }

  /**
   * Write (replace) a project's digest. Per-kind token ceilings enforce a hard
   * upper bound; callers should trim to the target range (see DIGEST_KIND_CONFIG
   * in models.ts). Returns the prior spec_version if one existed, so the
   * caller can log drift.
   */
  refreshProjectDigest(opts: {
    project_name: string;
    digest_kind?: string;
    digest_text: string;
    spec_version: string;
    producer: string;
    token_count?: number;
    named_terms?: string[];
  }): { project_name: string; digest_kind: string; written: true; prior_spec_version: string | null } {
    const kind = opts.digest_kind ?? 'essence';
    const DIGEST_CEILINGS: Record<string, number> = { essence: 1200 };
    const ceiling = DIGEST_CEILINGS[kind];
    if (ceiling != null && opts.token_count != null && opts.token_count > ceiling) {
      throw new Error(`Digest exceeds ceiling for kind '${kind}' (${opts.token_count} > ${ceiling} tokens). Trim and retry.`);
    }
    const db = this.open();
    try {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(opts.project_name) as { id: number } | undefined;
      if (!project) throw new NotFoundError(opts.project_name);
      const prior = db.prepare(`
        SELECT spec_version FROM project_digests WHERE project_id = ? AND digest_kind = ?
      `).get(project.id, kind) as { spec_version: string } | undefined;
      const namedTermsJson = JSON.stringify(opts.named_terms ?? []);
      db.prepare(`
        INSERT INTO project_digests (project_id, digest_kind, digest_text, spec_version, producer, generated_at, token_count, named_terms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (project_id, digest_kind) DO UPDATE SET
          digest_text = excluded.digest_text,
          spec_version = excluded.spec_version,
          producer = excluded.producer,
          generated_at = excluded.generated_at,
          token_count = excluded.token_count,
          named_terms = excluded.named_terms
      `).run(
        project.id,
        kind,
        opts.digest_text,
        opts.spec_version,
        opts.producer,
        new Date().toISOString(),
        opts.token_count ?? null,
        namedTermsJson,
      );
      return {
        project_name: opts.project_name,
        digest_kind: kind,
        written: true,
        prior_spec_version: prior?.spec_version ?? null,
      };
    } finally {
      db.close();
    }
  }

  // ── Next steps recipe (spec 0.27, S136) ───────────────────────

  /**
   * Build the field-presence snapshot used by `computeNextSteps`. Combines
   * the projects row, extended fields, capability count, digest existence,
   * and the project_type row's `git_init` flag. Returns null when the
   * project does not exist (caller is expected to have the name from a
   * registration response, so absence is a programming error rather than
   * an exception path).
   */
  getEnrichmentSnapshot(name: string): ProjectEnrichmentSnapshot | null {
    const db = this.open();
    try {
      const project = db.prepare(`
        SELECT p.id, p.description, p.goals, p.topics, p.entities,
               p.project_type_id,
               pt.git_init AS pt_git_init
        FROM projects p
        LEFT JOIN project_types pt ON pt.id = p.project_type_id
        WHERE p.name = ?
      `).get(name) as
        | { id: number; description: string | null; goals: string | null; topics: string | null; entities: string | null; project_type_id: number | null; pt_git_init: number | null }
        | undefined;
      if (!project) return null;

      const fieldRows = db.prepare(
        'SELECT field_name, field_value FROM project_fields WHERE project_id = ?'
      ).all(project.id) as { field_name: string; field_value: string }[];
      const fields: Record<string, string> = {};
      for (const row of fieldRows) fields[row.field_name] = row.field_value;

      const capCountRow = db.prepare(
        'SELECT COUNT(*) AS n FROM project_capabilities WHERE project_id = ?'
      ).get(project.id) as { n: number };

      const digestRow = db.prepare(
        'SELECT 1 FROM project_digests WHERE project_id = ? LIMIT 1'
      ).get(project.id) as { 1?: number } | undefined;

      const hasNonEmpty = (value: string | null | undefined): boolean =>
        value != null && value !== '' && value !== '[]';

      // Description is present when any prose surface carries text: the
      // projects.description column (set by register_project) or one of the
      // structured-field aliases (set by write_fields). All four enrich the
      // same agent-facing surface; any one of them satisfies the recipe.
      const hasDescription =
        hasNonEmpty(project.description)
        || hasNonEmpty(fields.description)
        || hasNonEmpty(fields.short_description)
        || hasNonEmpty(fields.medium_description);

      // For non-code projects (project_type.git_init === 0), tech_stack and
      // patterns aren't part of the recipe. When project_type_id is null
      // (legacy register_project call), default to code-project semantics.
      const isCodeProject = project.project_type_id == null
        ? true
        : project.pt_git_init === 1;

      return {
        has_description: hasDescription,
        has_tech_stack: hasNonEmpty(fields.tech_stack),
        has_patterns: hasNonEmpty(fields.patterns),
        has_goals: hasNonEmpty(project.goals),
        has_topics: hasNonEmpty(project.topics),
        has_entities: hasNonEmpty(project.entities),
        has_capabilities: capCountRow.n > 0,
        has_digest: digestRow != null,
        is_code_project: isCodeProject,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Compute the next_steps recipe for the project's current state. Returns
   * `[]` when the project is fully enriched (or when the project does not
   * exist — callers always have a freshly-registered name so this case
   * never occurs in normal flow).
   */
  getNextSteps(name: string): NextStep[] {
    const snapshot = this.getEnrichmentSnapshot(name);
    if (!snapshot) return [];
    return computeNextSteps(snapshot);
  }

  // ── Tasks ─────────────────────────────────────────────────────

  queueTask(opts: {
    description: string;
    project_name?: string;
    schedule: string;
    type_filter?: string;
    status_filter?: string;
    area_filter?: string;
  }): { task_id?: number; count?: number; projects?: string[] } {
    const isFanOut = opts.type_filter || opts.status_filter || opts.area_filter;

    if (isFanOut) {
      return this.dispatchTasks(opts);
    }

    const db = this.open();
    try {
      const result = db.prepare(
        'INSERT INTO tasks (project_name, description, schedule) VALUES (?, ?, ?)'
      ).run(opts.project_name ?? null, opts.description, opts.schedule);

      return { task_id: Number(result.lastInsertRowid) };
    } finally {
      db.close();
    }
  }

  private dispatchTasks(opts: {
    description: string;
    schedule: string;
    type_filter?: string;
    status_filter?: string;
    area_filter?: string;
  }): { count: number; projects: string[] } {
    const db = this.open();
    try {
      let sql = 'SELECT name FROM projects';
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (opts.type_filter) { conditions.push('type = ?'); params.push(opts.type_filter); }
      if (opts.status_filter) { conditions.push('status = ?'); params.push(opts.status_filter); }
      if (opts.area_filter) {
        if (opts.area_filter === UNASSIGNED_AREA_SENTINEL) {
          conditions.push('area_id IS NULL');
        } else {
          const areaId = this.resolveAreaIdOrThrow(db, opts.area_filter);
          conditions.push('area_id = ?');
          params.push(areaId);
        }
      }
      sql += ' WHERE ' + conditions.join(' AND ');

      const projects = db.prepare(sql).all(...params) as { name: string }[];
      const names = projects.map(p => p.name);

      const insert = db.prepare('INSERT INTO tasks (project_name, description, schedule) VALUES (?, ?, ?)');
      const doInsert = db.transaction(() => {
        for (const name of names) {
          insert.run(name, opts.description, opts.schedule);
        }
      });
      doInsert();

      return { count: names.length, projects: names };
    } finally {
      db.close();
    }
  }

  listTasks(opts?: {
    status_filter?: string;
    project_name?: string;
  }): Record<string, unknown>[] {
    const db = this.open();
    try {
      let sql = 'SELECT * FROM tasks';
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (opts?.status_filter) { conditions.push('status = ?'); params.push(opts.status_filter); }
      if (opts?.project_name) { conditions.push('project_name = ?'); params.push(opts.project_name); }

      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY created_at DESC';

      return db.prepare(sql).all(...params) as Record<string, unknown>[];
    } finally {
      db.close();
    }
  }

  // ── Internal helpers ──────────────────────────────────────────

  private loadRecord(db: Database.Database, opts: { name?: string; projectId?: number }): ProjectRecord | null {
    let row: Record<string, unknown> | undefined;
    if (opts.name) {
      row = db.prepare('SELECT * FROM projects WHERE name = ?').get(opts.name) as Record<string, unknown> | undefined;
    } else if (opts.projectId) {
      row = db.prepare('SELECT * FROM projects WHERE id = ?').get(opts.projectId) as Record<string, unknown> | undefined;
    }
    if (!row) return null;
    return this.rowToRecord(db, row);
  }

  private rowToRecord(db: Database.Database, row: Record<string, unknown>): ProjectRecord {
    const id = row.id as number;

    // Load structural area + parent/children (spec 0.13)
    const areaId = (row.area_id as number | null) ?? null;
    const parentId = (row.parent_project_id as number | null) ?? null;

    let areaName: AreaName | null = null;
    if (areaId != null) {
      // spec 0.26: areas are user-managed; resolve by id, no allowlist check
      const arow = db.prepare('SELECT name FROM areas WHERE id = ?').get(areaId) as { name: string } | undefined;
      if (arow) areaName = arow.name;
    }

    // spec 0.26: project_type_id resolves to the user-managed project_types row
    const projectTypeId = (row.project_type_id as number | null) ?? null;
    let projectTypeName: string | null = null;
    if (projectTypeId != null) {
      const trow = db.prepare('SELECT name FROM project_types WHERE id = ?').get(projectTypeId) as { name: string } | undefined;
      if (trow) projectTypeName = trow.name;
    }

    let parentName: string | null = null;
    let parentArchived = false;
    if (parentId != null) {
      const prow = db.prepare('SELECT name, status FROM projects WHERE id = ?').get(parentId) as { name: string; status: string } | undefined;
      if (prow) {
        parentName = prow.name;
        parentArchived = prow.status === 'archived';
      }
    }

    const childRows = db.prepare(
      'SELECT name FROM projects WHERE parent_project_id = ? ORDER BY name'
    ).all(id) as { name: string }[];
    const children = childRows.map(r => r.name);

    // Load paths
    const pathRows = db.prepare('SELECT path FROM project_paths WHERE project_id = ? ORDER BY path').all(id) as { path: string }[];
    const paths = pathRows.map(r => r.path);

    // Load extended fields
    const fieldRows = db.prepare('SELECT field_name, field_value, producer FROM project_fields WHERE project_id = ?').all(id) as {
      field_name: string; field_value: string; producer: string;
    }[];
    const extended_fields: Record<string, string> = {};
    const field_producers: Record<string, string> = {};
    for (const f of fieldRows) {
      extended_fields[f.field_name] = f.field_value;
      field_producers[f.field_name] = f.producer;
    }

    // Load capabilities
    const capRows = db.prepare('SELECT * FROM project_capabilities WHERE project_id = ?').all(id) as Record<string, unknown>[];
    const capabilities: CapabilityDeclaration[] = capRows.map(c => ({
      name: c.name as string,
      capability_type: c.capability_type as string,
      description: c.description as string,
      inputs: c.inputs as string || undefined,
      outputs: c.outputs as string || undefined,
      requires_auth: c.requires_auth != null ? Boolean(c.requires_auth) : null,
      invocation_model: c.invocation_model as string || undefined,
      audience: c.audience as string || undefined,
    }));

    return {
      id,
      name: row.name as string,
      display_name: row.display_name as string,
      type: row.type as ProjectType,
      status: row.status as ProjectStatus,
      description: row.description as string,
      goals: row.goals as string,
      topics: (row.topics as string) || '[]',
      entities: (row.entities as string) || '[]',
      concerns: (row.concerns as string) || '[]',
      paths,
      extended_fields,
      field_producers,
      capabilities,
      area: areaName,
      area_id: areaId,
      parent_project: parentName,
      parent_project_id: parentId,
      parent_archived: parentArchived,
      children,
      project_type_id: projectTypeId,
      project_type_name: projectTypeName,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  private formatRecord(db: Database.Database, record: ProjectRecord, depth: QueryDepth): Record<string, unknown> {
    switch (depth) {
      case 'minimal':
        return {
          name: record.name,
          type: record.type,
          status: record.status,
          area: record.area,
          parent_project: record.parent_project,
          children: record.children,
        };
      case 'summary':
        return toSummary(record);
      case 'standard': {
        const templateFields = getTemplateFields(db, record.type);
        return toStandard(record, templateFields);
      }
      case 'full':
        return toFull(record);
      default:
        return toSummary(record);
    }
  }

  private loadPorts(db: Database.Database, projectId: number): PortClaim[] {
    const rows = db.prepare(
      'SELECT port, service_label, protocol, claimed_at FROM project_ports WHERE project_id = ? ORDER BY port'
    ).all(projectId) as PortClaim[];
    return rows;
  }

  private autoAllocatePort(db: Database.Database): number {
    const claimed = db.prepare('SELECT port FROM project_ports ORDER BY port').all() as { port: number }[];
    const claimedSet = new Set(claimed.map(r => r.port));

    for (let p = PORT_RANGE_MIN; p <= PORT_RANGE_MAX; p++) {
      if (!claimedSet.has(p)) return p;
    }
    throw new InvalidInputError('No available ports in range 3000-9999.');
  }
}

function parseTermsField(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
