import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { Registry, connect, getDbPath, initDb } from '@setlist/core';

const PLIST_LABEL = 'com.setlist.worker';
const LOG_DIR = join(homedir(), '.local', 'share', 'project-registry', 'logs');
const PLIST_DIR = join(homedir(), 'Library', 'LaunchAgents');

interface WorkerResult {
  eligible: number;
  executed: number;
  completed: number;
  failed: number;
  quiet_hours: boolean;
  tasks: { task_id: number; description: string; project: string | null; status: string; session_id?: string; error?: string }[];
}

function isQuietHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
}

function isTaskEligible(schedule: string): boolean {
  switch (schedule) {
    case 'now': return true;
    case 'tonight': return isQuietHours();
    case 'weekly': return true;
    default: return false;
  }
}

export function runWorker(dbPath?: string, dryRun: boolean = false): WorkerResult {
  const path = dbPath ?? getDbPath();
  initDb(path);

  // Startup sentinel
  console.log(`[setlist-worker] PID=${process.pid} started at ${new Date().toISOString()}`);

  const db = connect(path);
  const quiet = isQuietHours();
  const taskResults: WorkerResult['tasks'] = [];

  try {
    const pending = db.prepare(
      "SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at"
    ).all() as Record<string, unknown>[];

    const eligible = pending.filter(t => isTaskEligible(t.schedule as string));

    if (dryRun) {
      console.log(`[setlist-worker] Dry run: ${eligible.length} eligible task(s), ${pending.length} total pending`);
      return {
        eligible: eligible.length,
        executed: 0,
        completed: 0,
        failed: 0,
        quiet_hours: quiet,
        tasks: eligible.map(t => ({
          task_id: t.id as number,
          description: t.description as string,
          project: t.project_name as string | null,
          status: 'pending',
        })),
      };
    }

    let completed = 0;
    let failed = 0;

    for (const task of eligible) {
      const taskId = task.id as number;
      const description = task.description as string;
      const projectName = task.project_name as string | null;

      // Transition to running
      const now = new Date().toISOString();
      db.prepare("UPDATE tasks SET status = 'running', started_at = ? WHERE id = ?").run(now, taskId);

      // Determine working directory
      let cwd = join(homedir(), '.local', 'share', 'project-registry');
      if (projectName) {
        const pathRow = db.prepare(
          `SELECT pp.path FROM project_paths pp JOIN projects p ON p.id = pp.project_id WHERE p.name = ? LIMIT 1`
        ).get(projectName) as { path: string } | undefined;
        if (pathRow) cwd = pathRow.path;
      }

      try {
        // Spawn Claude Code session
        const output = execSync(
          `claude -p "${description.replace(/"/g, '\\"')}" --output-format json`,
          { cwd, timeout: 3600000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        );

        // Extract session ID from JSON output
        let sessionId = '';
        try {
          const parsed = JSON.parse(output);
          sessionId = parsed.session_id ?? parsed.id ?? '';
        } catch {
          sessionId = output.trim().slice(0, 100);
        }

        const completedAt = new Date().toISOString();
        db.prepare(
          "UPDATE tasks SET status = 'completed', session_reference = ?, completed_at = ? WHERE id = ?"
        ).run(sessionId, completedAt, taskId);

        completed++;
        taskResults.push({ task_id: taskId, description, project: projectName, status: 'completed', session_id: sessionId });

        // Re-queue weekly tasks
        if (task.schedule === 'weekly') {
          db.prepare(
            'INSERT INTO tasks (project_name, description, schedule) VALUES (?, ?, ?)'
          ).run(projectName, description, 'weekly');
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message.slice(0, 500) : 'Unknown error';
        const failedAt = new Date().toISOString();
        db.prepare(
          "UPDATE tasks SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?"
        ).run(errorMsg, failedAt, taskId);

        failed++;
        taskResults.push({ task_id: taskId, description, project: projectName, status: 'failed', error: errorMsg });
      }
    }

    return { eligible: eligible.length, executed: eligible.length, completed, failed, quiet_hours: quiet, tasks: taskResults };
  } finally {
    db.close();
  }
}

export function generatePlist(interval: number = 900): string {
  const nodePath = process.execPath;
  const workerScript = join(__dirname, 'index.js');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${workerScript}</string>
    <string>worker</string>
    <string>run</string>
  </array>
  <key>StartInterval</key>
  <integer>${interval}</integer>
  <key>WorkingDirectory</key>
  <string>${join(homedir(), '.local', 'share', 'project-registry')}</string>
  <key>StandardOutPath</key>
  <string>${join(LOG_DIR, 'worker.log')}</string>
  <key>StandardErrorPath</key>
  <string>${join(LOG_DIR, 'worker-error.log')}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>KeepAlive</key>
  <dict>
    <key>Crashed</key>
    <true/>
  </dict>
</dict>
</plist>`;
}

export function installWorker(interval: number = 900): void {
  // Pre-deploy validation
  try {
    execSync(`${process.execPath} -e "require('@setlist/core')"`, { stdio: 'pipe' });
  } catch {
    console.error('Pre-deploy validation failed: @setlist/core not importable.');
    process.exit(1);
  }

  if (!existsSync(getDbPath())) {
    console.warn('Warning: Registry database not found. Run "setlist init" first.');
  }

  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  if (!existsSync(PLIST_DIR)) mkdirSync(PLIST_DIR, { recursive: true });

  const plistPath = join(PLIST_DIR, `${PLIST_LABEL}.plist`);
  writeFileSync(plistPath, generatePlist(interval));

  try {
    execSync(`launchctl bootstrap gui/$(id -u) ${plistPath}`, { stdio: 'pipe' });
  } catch {
    try {
      execSync(`launchctl load ${plistPath}`, { stdio: 'pipe' });
    } catch (e) {
      console.error('Failed to load plist:', e instanceof Error ? e.message : e);
    }
  }

  console.log(`Worker installed: ${plistPath} (interval: ${interval}s)`);
}

export function uninstallWorker(): void {
  const plistPath = join(PLIST_DIR, `${PLIST_LABEL}.plist`);
  if (!existsSync(plistPath)) {
    console.log('Worker not installed.');
    return;
  }

  try {
    execSync(`launchctl bootout gui/$(id -u) ${plistPath}`, { stdio: 'pipe' });
  } catch {
    try {
      execSync(`launchctl unload ${plistPath}`, { stdio: 'pipe' });
    } catch { /* already unloaded */ }
  }

  try {
    require('fs').unlinkSync(plistPath);
  } catch { /* file may not exist */ }

  console.log('Worker uninstalled.');
}

export function workerStatus(): string {
  const plistPath = join(PLIST_DIR, `${PLIST_LABEL}.plist`);
  if (!existsSync(plistPath)) return 'not installed';

  try {
    const output = execSync(`launchctl list ${PLIST_LABEL} 2>/dev/null`, { encoding: 'utf-8' });
    return output.includes(PLIST_LABEL) ? 'loaded' : 'exists but not loaded';
  } catch {
    return 'exists but not loaded';
  }
}
