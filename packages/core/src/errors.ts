export class RegistryError extends Error {
  code: string;
  suggestion?: string;

  constructor(code: string, message: string, suggestion?: string) {
    const full = suggestion
      ? `Error [${code}]: ${message} Suggestion: ${suggestion}`
      : `Error [${code}]: ${message}`;
    super(full);
    this.name = 'RegistryError';
    this.code = code;
    this.suggestion = suggestion;
  }
}

export class DuplicateProjectError extends RegistryError {
  constructor(name: string) {
    super(
      'DUPLICATE',
      `A project named '${name}' already exists.`,
      `Use update_project() to modify it, or get_project() to see current data.`
    );
    this.name = 'DuplicateProjectError';
  }
}

export class NotFoundError extends RegistryError {
  constructor(name: string, suggestion?: string) {
    const suggestionText = suggestion
      ? `Did you mean '${suggestion}'? Use get_project('${suggestion}') to check.`
      : `Use list_projects() to see available projects.`;
    super('NOT_FOUND', `No project named '${name}' found.`, suggestionText);
    this.name = 'NotFoundError';
  }
}

export class EmptyRegistryError extends RegistryError {
  constructor() {
    super(
      'EMPTY_REGISTRY',
      'The registry has no projects.',
      'Use register_project() to add one, or run migration to populate from existing projects.'
    );
    this.name = 'EmptyRegistryError';
  }
}

export class InvalidInputError extends RegistryError {
  constructor(message: string) {
    super('INVALID_INPUT', message);
    this.name = 'InvalidInputError';
  }
}

/**
 * Find the closest matching project name using Levenshtein distance.
 */
export function findClosestMatch(target: string, candidates: string[]): string | undefined {
  if (candidates.length === 0) return undefined;

  let bestMatch: string | undefined;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const tLower = target.toLowerCase();
    const cLower = candidate.toLowerCase();

    // Full Levenshtein distance
    const fullDist = levenshtein(tLower, cLower);
    const fullThreshold = Math.max(Math.floor(Math.max(target.length, candidate.length) * 0.5), 3);
    if (fullDist < bestDistance && fullDist <= fullThreshold) {
      bestDistance = fullDist;
      bestMatch = candidate;
      continue;
    }

    // Prefix match: compare target against the prefix of candidate (same length)
    if (candidate.length > target.length) {
      const prefix = cLower.slice(0, tLower.length);
      const prefixDist = levenshtein(tLower, prefix);
      if (prefixDist <= 2 && prefixDist < bestDistance) {
        bestDistance = prefixDist;
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
