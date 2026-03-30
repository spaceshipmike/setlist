/**
 * Minimal YAML parser for NLSpec frontmatter.
 * Handles: scalar values, arrays (both inline [] and block - items),
 * nested objects (synopsis block), quoted strings.
 * Does NOT handle: multiline strings, anchors, complex nesting beyond 2 levels.
 */
export function parse(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');
  let currentKey: string | null = null;
  let currentIndent = 0;
  let nestedObj: Record<string, unknown> | null = null;
  let nestedKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;

    // Nested object property (indented under a key like "synopsis:")
    if (nestedKey && indent > currentIndent && nestedObj) {
      const kvMatch = trimmed.match(/^(\S+)\s*:\s*(.*)/);
      if (kvMatch) {
        nestedObj[kvMatch[1]] = parseValue(kvMatch[2]);
        continue;
      }
      // Array item in nested object
      if (trimmed.startsWith('- ')) {
        // Find the last key in nestedObj that is/should be an array
        if (currentKey && nestedObj[currentKey] !== undefined) {
          const arr = nestedObj[currentKey];
          if (Array.isArray(arr)) {
            arr.push(trimmed.slice(2).trim());
          }
        }
        continue;
      }
    }

    // Top-level key: value
    const kvMatch = trimmed.match(/^(\S+)\s*:\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      const rawValue = kvMatch[2];

      if (nestedKey && nestedObj) {
        result[nestedKey] = nestedObj;
        nestedKey = null;
        nestedObj = null;
      }

      if (!rawValue || rawValue === '') {
        // Could be start of a nested object or block array
        // Look ahead to determine
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextTrimmed = nextLine.trim();
          const nextIndent = nextLine.length - nextLine.trimStart().length;
          if (nextIndent > indent && nextTrimmed.match(/^\S+\s*:/)) {
            // Nested object
            nestedKey = key;
            nestedObj = {};
            currentIndent = indent;
            currentKey = null;
            continue;
          }
        }
        result[key] = '';
      } else {
        result[key] = parseValue(rawValue);
      }
      currentKey = key;
      currentIndent = indent;
      continue;
    }

    // Block array item at top level
    if (trimmed.startsWith('- ') && currentKey) {
      const existing = result[currentKey];
      if (Array.isArray(existing)) {
        existing.push(trimmed.slice(2).trim());
      } else {
        result[currentKey] = [trimmed.slice(2).trim()];
      }
    }
  }

  // Flush any remaining nested object
  if (nestedKey && nestedObj) {
    result[nestedKey] = nestedObj;
  }

  return result;
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();

  // Quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Inline array: [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1);
    if (!inner.trim()) return [];
    return inner.split(',').map(item => {
      const t = item.trim();
      if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1);
      }
      return t;
    });
  }

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  return trimmed;
}
