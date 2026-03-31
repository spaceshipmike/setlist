import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Registry, initDb, connect } from '@setlist/core';
import { runWorker, generatePlist } from '../src/worker.js';

describe('Worker (S25)', () => {
  let tmpDir: string;
  let dbPath: string;
  let registry: Registry;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'setlist-worker-test-'));
    dbPath = join(tmpDir, 'test.db');
    registry = new Registry(dbPath);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Dry Run Mode ───────────────────────────────────────────

  it('dry run reports eligible tasks without executing', () => {
    registry.register({ name: 'proj-a', type: 'project', status: 'active' });
    registry.queueTask({ description: 'Task one', project_name: 'proj-a', schedule: 'now' });
    registry.queueTask({ description: 'Task two', project_name: 'proj-a', schedule: 'now' });

    const result = runWorker(dbPath, true);
    expect(result.eligible).toBe(2);
    expect(result.executed).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].status).toBe('pending');

    // Tasks should still be pending (no execution)
    const tasks = registry.listTasks({ status_filter: 'pending' });
    expect(tasks).toHaveLength(2);
  });

  it('dry run with no pending tasks reports zero eligible', () => {
    const result = runWorker(dbPath, true);
    expect(result.eligible).toBe(0);
    expect(result.tasks).toHaveLength(0);
  });

  // ── Task Eligibility (schedule-based) ──────────────────────

  it('now tasks are always eligible in dry run', () => {
    registry.register({ name: 'p', type: 'project', status: 'active' });
    registry.queueTask({ description: 'Immediate', project_name: 'p', schedule: 'now' });

    const result = runWorker(dbPath, true);
    expect(result.eligible).toBe(1);
  });

  it('weekly tasks are always eligible in dry run', () => {
    registry.register({ name: 'p', type: 'project', status: 'active' });
    registry.queueTask({ description: 'Weekly job', project_name: 'p', schedule: 'weekly' });

    const result = runWorker(dbPath, true);
    expect(result.eligible).toBe(1);
  });

  it('tonight tasks eligibility depends on quiet hours', () => {
    registry.register({ name: 'p', type: 'project', status: 'active' });
    registry.queueTask({ description: 'Night task', project_name: 'p', schedule: 'tonight' });

    const result = runWorker(dbPath, true);
    const hour = new Date().getHours();
    const isQuiet = hour >= 22 || hour < 6;

    if (isQuiet) {
      expect(result.eligible).toBe(1);
    } else {
      expect(result.eligible).toBe(0);
    }
  });

  // ── Task State Transitions (direct DB) ─────────────────────

  it('tasks start as pending', () => {
    registry.register({ name: 'p', type: 'project', status: 'active' });
    registry.queueTask({ description: 'Test', project_name: 'p', schedule: 'now' });

    const db = connect(dbPath);
    try {
      const task = db.prepare("SELECT status FROM tasks LIMIT 1").get() as { status: string };
      expect(task.status).toBe('pending');
    } finally {
      db.close();
    }
  });

  it('running tasks can transition to completed', () => {
    registry.register({ name: 'p', type: 'project', status: 'active' });
    registry.queueTask({ description: 'Test', project_name: 'p', schedule: 'now' });

    const db = connect(dbPath);
    try {
      const task = db.prepare("SELECT id FROM tasks LIMIT 1").get() as { id: number };
      const now = new Date().toISOString();

      db.prepare("UPDATE tasks SET status = 'running', started_at = ? WHERE id = ?").run(now, task.id);
      db.prepare("UPDATE tasks SET status = 'completed', session_reference = 'sess-123', completed_at = ? WHERE id = ?").run(now, task.id);

      const completed = db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id) as Record<string, unknown>;
      expect(completed.status).toBe('completed');
      expect(completed.session_reference).toBe('sess-123');
      expect(completed.completed_at).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it('running tasks can transition to failed with error message', () => {
    registry.register({ name: 'p', type: 'project', status: 'active' });
    registry.queueTask({ description: 'Test', project_name: 'p', schedule: 'now' });

    const db = connect(dbPath);
    try {
      const task = db.prepare("SELECT id FROM tasks LIMIT 1").get() as { id: number };
      const now = new Date().toISOString();

      db.prepare("UPDATE tasks SET status = 'running', started_at = ? WHERE id = ?").run(now, task.id);
      db.prepare("UPDATE tasks SET status = 'failed', error_message = 'exit code 1', completed_at = ? WHERE id = ?").run(now, task.id);

      const failed = db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id) as Record<string, unknown>;
      expect(failed.status).toBe('failed');
      expect(failed.error_message).toBe('exit code 1');
    } finally {
      db.close();
    }
  });

  it('weekly tasks can be re-queued as new pending tasks', () => {
    registry.register({ name: 'p', type: 'project', status: 'active' });
    registry.queueTask({ description: 'Weekly sync', project_name: 'p', schedule: 'weekly' });

    const db = connect(dbPath);
    try {
      const task = db.prepare("SELECT id FROM tasks LIMIT 1").get() as { id: number };
      const now = new Date().toISOString();

      // Simulate completion
      db.prepare("UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?").run(now, task.id);

      // Re-queue (as the worker does)
      db.prepare("INSERT INTO tasks (project_name, description, schedule) VALUES (?, ?, ?)").run('p', 'Weekly sync', 'weekly');

      const allTasks = db.prepare("SELECT * FROM tasks ORDER BY id").all() as Record<string, unknown>[];
      expect(allTasks).toHaveLength(2);
      expect(allTasks[0].status).toBe('completed');
      expect(allTasks[1].status).toBe('pending');
      expect(allTasks[1].description).toBe('Weekly sync');
    } finally {
      db.close();
    }
  });

  // ── Plist Generation ───────────────────────────────────────

  it('generates valid plist with correct structure', () => {
    const plist = generatePlist(900);
    expect(plist).toContain('com.setlist.worker');
    expect(plist).toContain('<key>StartInterval</key>');
    expect(plist).toContain('<integer>900</integer>');
    expect(plist).toContain('<key>KeepAlive</key>');
    expect(plist).toContain('<key>Crashed</key>');
    expect(plist).toContain('<true/>');
  });

  it('respects custom interval', () => {
    const plist = generatePlist(300);
    expect(plist).toContain('<integer>300</integer>');
  });

  // ── Startup Sentinel ───────────────────────────────────────

  it('emits startup sentinel on dry run', () => {
    const consoleSpy = vi.spyOn(console, 'log');

    runWorker(dbPath, true);

    const sentinelCall = consoleSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('[setlist-worker]') && call[0].includes('PID='),
    );
    expect(sentinelCall).toBeTruthy();

    consoleSpy.mockRestore();
  });
});
