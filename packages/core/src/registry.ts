import Database from 'better-sqlite3';
import { initDb, connect, getDbPath, getTemplateFields } from './db.js';
import {
  type ProjectRecord, type ProjectType, type ProjectStatus, type QueryDepth,
  type CapabilityDeclaration, type PortClaim,
  validateStatus, toSummary, toStandard, toFull,
} from './models.js';
import { DuplicateProjectError, NotFoundError, InvalidInputError, findClosestMatch } from './errors.js';
import { writeFields, deserializeFieldValue } from './fields.js';
import { discoverPortsInPath, type DiscoveredPort } from './port-discovery.js';

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
    type: ProjectType;
    status: string;
    description?: string;
    goals?: string;
    display_name?: string;
    paths?: string[];
    fields?: Record<string, unknown>;
    producer?: string;
  }): number {
    validateStatus(opts.type, opts.status);
    const displayName = opts.display_name || opts.name;
    const producer = opts.producer ?? 'system';

    const db = this.open();
    try {
      const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(opts.name);
      if (existing) throw new DuplicateProjectError(opts.name);

      const result = db.prepare(
        `INSERT INTO projects (name, display_name, type, status, description, goals) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(opts.name, displayName, opts.type, opts.status, opts.description ?? '', opts.goals ?? '');

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
  }): Record<string, unknown>[] {
    const depth = opts?.depth ?? 'summary';
    const db = this.open();
    try {
      let sql = 'SELECT * FROM projects';
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (opts?.type_filter) {
        conditions.push('type = ?');
        params.push(opts.type_filter);
      }
      if (opts?.status_filter) {
        conditions.push('status = ?');
        params.push(opts.status_filter);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY name';

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
  }): Record<string, unknown>[] {
    const db = this.open();
    try {
      const q = `%${opts.query}%`;
      let sql = `
        SELECT DISTINCT p.* FROM projects p
        LEFT JOIN project_fields pf ON pf.project_id = p.id
        WHERE (
          p.name LIKE ? OR p.display_name LIKE ? OR p.description LIKE ?
          OR p.goals LIKE ? OR pf.field_value LIKE ?
        )
      `;
      const params: unknown[] = [q, q, q, q, q];

      if (opts.type_filter) {
        sql += ' AND p.type = ?';
        params.push(opts.type_filter);
      }
      if (opts.status_filter) {
        sql += ' AND p.status = ?';
        params.push(opts.status_filter);
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

  getRegistryStats(): { total: number; by_type: Record<string, number>; by_status: Record<string, number> } {
    const db = this.open();
    try {
      const total = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }).count;
      const typeRows = db.prepare('SELECT type, COUNT(*) as count FROM projects GROUP BY type').all() as { type: string; count: number }[];
      const statusRows = db.prepare('SELECT status, COUNT(*) as count FROM projects GROUP BY status').all() as { status: string; count: number }[];

      const by_type: Record<string, number> = {};
      for (const r of typeRows) by_type[r.type] = r.count;

      const by_status: Record<string, number> = {};
      for (const r of statusRows) by_status[r.status] = r.count;

      return { total, by_type, by_status };
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
    goals?: string;
    display_name?: string;
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
      if (updates.goals !== undefined) { sets.push('goals = ?'); params.push(updates.goals); }

      if (sets.length === 0) return;

      sets.push("updated_at = datetime('now')");
      params.push(row.id);

      db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
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
    status?: string;
    description?: string;
    goals?: string;
    display_name?: string;
    dry_run?: boolean;
  }): { count: number; projects: string[]; dry_run: boolean } {
    if (!opts.type_filter && !opts.status_filter) {
      throw new InvalidInputError('batch_update requires at least one filter (type_filter or status_filter).');
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
          if (opts.goals !== undefined) { sets.push('goals = ?'); updateParams.push(opts.goals); }
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

  // ── Tasks ─────────────────────────────────────────────────────

  queueTask(opts: {
    description: string;
    project_name?: string;
    schedule: string;
    type_filter?: string;
    status_filter?: string;
  }): { task_id?: number; count?: number; projects?: string[] } {
    const isFanOut = opts.type_filter || opts.status_filter;

    if (isFanOut) {
      if (!opts.type_filter && !opts.status_filter) {
        throw new InvalidInputError('Cross-project dispatch requires at least one filter.');
      }
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
  }): { count: number; projects: string[] } {
    const db = this.open();
    try {
      let sql = 'SELECT name FROM projects';
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (opts.type_filter) { conditions.push('type = ?'); params.push(opts.type_filter); }
      if (opts.status_filter) { conditions.push('status = ?'); params.push(opts.status_filter); }
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
      paths,
      extended_fields,
      field_producers,
      capabilities,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  private formatRecord(db: Database.Database, record: ProjectRecord, depth: QueryDepth): Record<string, unknown> {
    switch (depth) {
      case 'minimal':
        return { name: record.name, type: record.type, status: record.status };
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
