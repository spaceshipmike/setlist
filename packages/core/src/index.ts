export { initDb, connect, getDbPath, getTemplateFields, SCHEMA_VERSION } from './db.js';
export { extractNamedTerms } from './named-terms.js';
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
export {
  Bootstrap,
  BootstrapNotConfiguredError,
  BootstrapFolderExistsError,
  type BootstrapConfig,
  type BootstrapProjectOpts,
  type BootstrapResult,
  // Spec 0.28: recipe-driven bootstrap envelope union.
  type BootstrapEnvelope,
  type BootstrapPendingState,
  type BootstrapPreflightFailure,
  type BootstrapDryRunTrace,
  type ExecutedStep,
} from './bootstrap.js';
export {
  // Recipe data model (spec 0.28)
  BUILTIN_PRIMITIVE_KEYS,
  type BuiltinPrimitiveKey,
  type PrimitiveShape,
  type PrimitiveDefinition,
  type FilesystemOpDefinition,
  type ShellCommandDefinition,
  type McpToolDefinition,
  type Primitive,
  type PrimitiveRow,
  type RecipeStep,
  type RecipeStepRow,
  type Recipe,
  type RecipeSnapshot,
} from './recipes/types.js';
export {
  rowToPrimitive,
  rowToRecipeStep,
  seedBuiltinPrimitives,
  seedBuiltinRecipes,
  listPrimitives,
  getPrimitive,
  getBuiltinPrimitiveByKey,
  createCustomPrimitive,
  updateCustomPrimitive,
  deleteCustomPrimitive,
  countRecipeReferences,
  listReferencingTypes,
  getRecipe,
  replaceRecipe,
  appendRecipeStep,
  snapshotRecipe,
  type CreatePrimitiveOpts,
  type UpdatePrimitiveOpts,
} from './recipes/store.js';
export { PrimitivesRegistry } from './recipes/registry.js';
export {
  resolveTemplate,
  resolveParams,
  EXAMPLE_CONTEXT,
  SUPPORTED_TOKENS,
  type ProjectContext,
  type ResolveResult,
  type ResolveSuccess,
  type ResolveFailure,
  type ResolveMapResult,
  type ResolveMapSuccess,
  type ResolveMapFailure,
} from './recipes/templates.js';
export {
  newCleanupLog,
  TRAILER_NAME,
  TRAILER_LABEL,
  type StepStatus,
  type StepResult,
  type PreflightResult,
  type PreflightEnvelope,
  type ExecutorContext,
  type ShapeExecutor,
  type CleanupLog,
  type RunnerEnvelope,
} from './recipes/runner.js';
export {
  NULL_MCP_CALLER,
  type McpToolCaller,
  type McpToolDescriptor,
  type McpCallResult,
  type McpCallSuccess,
  type McpCallFailure,
} from './recipes/mcp-caller.js';
export { filesystemExecutor } from './recipes/executors/filesystem.js';
export { shellExecutor, firstBinary, binaryOnPath } from './recipes/executors/shell.js';
export { mcpExecutor } from './recipes/executors/mcp.js';
export {
  walkRecipe,
  resumeWalk,
  preflight,
  pickExecutor,
  type WalkOpts,
} from './recipes/walk.js';
export { HealthAssessor, HEALTH_CACHE_TTL_MS, type HealthTier, type HealthDimension, type DimensionResult, type HealthAssessment, type PortfolioHealth } from './health.js';
export { computeProjectVersion, listProjectDocuments, type ProjectVersion } from './project-version.js';
export { introspectLibraryExports } from './introspect-exports.js';
export { computeNextSteps, type NextStep, type ProjectEnrichmentSnapshot } from './next-steps.js';
