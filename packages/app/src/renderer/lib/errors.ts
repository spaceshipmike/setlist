/**
 * Parse registry errors into user-friendly messages with recovery suggestions.
 * RegistryError messages have the format: "Error [CODE]: message Suggestion: suggestion"
 */

const ERROR_PATTERNS: Array<{ pattern: RegExp; message: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /Error \[DUPLICATE\]: A project named '(.+)' already exists/,
    message: (m) => `A project named "${m[1]}" already exists. Choose a different name.`,
  },
  {
    pattern: /Error \[NOT_FOUND\]: No project named '(.+)' found.*Did you mean '(.+)'\?/,
    message: (m) => `Project "${m[1]}" not found. Did you mean "${m[2]}"?`,
  },
  {
    pattern: /Error \[NOT_FOUND\]: No project named '(.+)' found/,
    message: (m) => `Project "${m[1]}" not found.`,
  },
  {
    pattern: /Error \[INVALID_INPUT\]: (.+)/,
    message: (m) => m[1],
  },
  {
    pattern: /SQLITE_CONSTRAINT/,
    message: () => 'A database constraint was violated. The operation could not be completed.',
  },
  {
    pattern: /SQLITE_BUSY|database is locked/,
    message: () => 'The database is temporarily busy. Try again in a moment.',
  },
];

export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  for (const { pattern, message } of ERROR_PATTERNS) {
    const match = raw.match(pattern);
    if (match) return message(match);
  }

  // Strip "Error [CODE]: " prefix if present but no specific pattern matched
  const stripped = raw.replace(/^Error \[\w+\]: /, '');
  return stripped || 'An unexpected error occurred. Please try again.';
}
