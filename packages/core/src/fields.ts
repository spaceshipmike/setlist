import type Database from 'better-sqlite3';

/**
 * Serialize a field value for storage. Lists are stored as JSON arrays.
 */
export function serializeFieldValue(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

/**
 * Deserialize a field value from storage. Tries JSON parse for arrays/objects.
 */
export function deserializeFieldValue(value: string): string | string[] {
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Write extended fields for a project, respecting producer ownership.
 * Fields owned by a different producer are skipped (not overwritten).
 */
export function writeFields(
  db: Database.Database,
  projectId: number,
  fields: Record<string, unknown>,
  producer: string,
): void {
  const upsert = db.prepare(`
    INSERT INTO project_fields (project_id, field_name, field_value, producer, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(project_id, field_name) DO UPDATE SET
      field_value = excluded.field_value,
      producer = excluded.producer,
      updated_at = excluded.updated_at
    WHERE project_fields.producer = excluded.producer
  `);

  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    upsert.run(projectId, name, serializeFieldValue(value), producer);
  }
}
