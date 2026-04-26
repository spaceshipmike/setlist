export { initDb, connect, getDbPath, getTemplateFields, SCHEMA_VERSION } from './db.js';
export * from './models.js';
export * from './errors.js';
export {
  AREA_COLOR_PALETTE, SEED_AREAS, isValidAreaColor,
  type AreaRow,
} from './areas.js';
export {
  SEED_PROJECT_TYPES, rowToProjectType,
  type ProjectType as UserProjectType, type ProjectTypeRow,
} from './project-types.js';
export { serializeFieldValue, deserializeFieldValue, writeFields } from './fields.js';
export { Registry, PORT_RANGE_MIN, PORT_RANGE_MAX } from './registry.js';
export { MemoryStore } from './memory.js';
export { MemoryRetrieval, classifyIntent, type RecallResult, type QueryIntent } from './memory-retrieval.js';
export { CrossQuery } from './cross-query.js';
export { discoverPortsInPath, type DiscoveredPort } from './port-discovery.js';
export { MemoryReflection, type ReflectionResult } from './memory-reflection.js';
export { scanLocations, applyProposals, type MigrationProposal } from './migration.js';
export { scanMemories, applyMemoryMigration, type MemoryMigrationProposal, type MemoryMigrationResult } from './migrate-memories.js';
export { Bootstrap, BootstrapNotConfiguredError, BootstrapFolderExistsError, type BootstrapConfig, type BootstrapProjectOpts, type BootstrapResult } from './bootstrap.js';
export { HealthAssessor, HEALTH_CACHE_TTL_MS, type HealthTier, type HealthDimension, type DimensionResult, type HealthAssessment, type PortfolioHealth } from './health.js';
export { computeProjectVersion, listProjectDocuments, type ProjectVersion } from './project-version.js';
export { introspectLibraryExports } from './introspect-exports.js';
export { computeNextSteps, type NextStep, type ProjectEnrichmentSnapshot } from './next-steps.js';
