// @fctry: #capability-declarations
import type { Registry, CapabilityDeclaration } from '@setlist/core';
import { introspectLibraryExports } from '@setlist/core';
import { introspectCliCommands } from '@setlist/cli/introspect';
import { introspectMcpTools } from './introspect-tools.js';

/**
 * Logger shape accepted by `selfRegisterCapabilities`.
 *
 * The real MCP server writes warnings to stderr; tests pass a capturing
 * logger so they can assert what was logged without swallowing stderr.
 * The contract is minimal on purpose — no levels beyond warn.
 */
export interface Logger {
  warn(message: string): void;
}

/**
 * The project name setlist self-registers under. Hoisted to a constant so
 * tests and the startup wiring stay aligned.
 */
export const SELF_REGISTER_PROJECT = 'setlist';

/**
 * The producer string stamped on every capability row written by the
 * startup orchestrator.
 */
export const SELF_REGISTER_PRODUCER = 'setlist-self-register';

/**
 * Describes which surface an introspection attempt covered, for logging
 * and test assertions.
 */
type SurfaceName = 'tool' | 'cli-command' | 'library';

interface SurfaceSpec {
  surface: SurfaceName;
  introspect: () => CapabilityDeclaration[];
}

const SURFACES: SurfaceSpec[] = [
  { surface: 'tool', introspect: introspectMcpTools },
  { surface: 'cli-command', introspect: introspectCliCommands },
  { surface: 'library', introspect: introspectLibraryExports },
];

export interface SelfRegisterResult {
  succeeded: SurfaceName[];
  failed: Array<{ surface: SurfaceName; reason: string }>;
}

/**
 * Run startup self-registration: introspect each surface, write its rows
 * via `Registry.registerCapabilitiesForType`, and survive partial failures.
 *
 * Contract (§2.11, S117):
 * - Never throws. A thrown exception from one surface does not break the
 *   others and does not bubble up to the server's createServer() caller.
 * - Uses per-type replace semantics, so a failing surface leaves its prior
 *   rows intact (last-known-good preserved, not overwritten with empty).
 * - Exactly one WARN log per failed surface, naming the surface and reason.
 * - Silent on the happy path — no stdout/stderr writes when all three
 *   succeed (preserves S112 "silent idempotent step" criterion).
 * - Returns a structured result so tests can assert which surfaces landed.
 */
export function selfRegisterCapabilities(
  registry: Registry,
  logger: Logger,
): SelfRegisterResult {
  const succeeded: SurfaceName[] = [];
  const failed: Array<{ surface: SurfaceName; reason: string }> = [];

  for (const spec of SURFACES) {
    try {
      const caps = spec.introspect();
      registry.registerCapabilitiesForType(
        SELF_REGISTER_PROJECT,
        spec.surface,
        caps,
        SELF_REGISTER_PRODUCER,
      );
      succeeded.push(spec.surface);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      failed.push({ surface: spec.surface, reason });
      logger.warn(
        `Capability self-registration: ${spec.surface} introspection failed (${reason}); other surfaces registered.`,
      );
    }
  }

  return { succeeded, failed };
}

/**
 * Default logger that writes warnings to stderr. Exported so production
 * wiring can use it without importing console directly.
 */
export const stderrLogger: Logger = {
  warn(message: string) {
    // eslint-disable-next-line no-console
    console.warn(message);
  },
};
