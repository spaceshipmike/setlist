/**
 * Minimal YAML parser for NLSpec frontmatter.
 * Handles: scalar values, arrays (inline `[...]` on one line, inline arrays
 * spanning multiple lines, and block `- items`), nested objects (synopsis
 * block), quoted strings.
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
        const innerKey = kvMatch[1];
        const innerValue = kvMatch[2];
        if (!innerValue || innerValue === '') {
          // No inline value — look ahead for a block array (`- item`).
          // If found, initialize as an empty array so subsequent block
          // items can be pushed into it; otherwise leave as empty string.
          let isBlockArray = false;
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const nextTrimmed = nextLine.trim();
            const nextIndent = nextLine.length - nextLine.trimStart().length;
            if (nextIndent > indent && nextTrimmed.startsWith('- ')) {
              isBlockArray = true;
            }
          }
          nestedObj[innerKey] = isBlockArray ? [] : '';
        } else if (innerValue.trim().startsWith('[')) {
          const consumed = consumeInlineArray(innerValue.trim(), lines, i);
          if (consumed) {
            nestedObj[innerKey] = consumed.items;
            i = consumed.endIdx;
          } else {
            nestedObj[innerKey] = parseValue(innerValue);
          }
        } else {
          nestedObj[innerKey] = parseValue(innerValue);
        }
        currentKey = innerKey;
        continue;
      }
      // Array item in nested object
      if (trimmed.startsWith('- ')) {
        // Find the last key in nestedObj that is/should be an array
        if (currentKey && nestedObj[currentKey] !== undefined) {
          const arr = nestedObj[currentKey];
          if (Array.isArray(arr)) {
            // Strip optional surrounding quotes on block-array string items.
            let item = trimmed.slice(2).trim();
            if ((item.startsWith('"') && item.endsWith('"')) ||
                (item.startsWith("'") && item.endsWith("'"))) {
              item = item.slice(1, -1);
            }
            arr.push(item);
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
      } else if (rawValue.trim().startsWith('[')) {
        const consumed = consumeInlineArray(rawValue.trim(), lines, i);
        if (consumed) {
          result[key] = consumed.items;
          i = consumed.endIdx;
        } else {
          result[key] = parseValue(rawValue);
        }
      } else {
        result[key] = parseValue(rawValue);
      }
      currentKey = key;
      currentIndent = indent;
      continue;
    }

    // Block array item at top level
    if (trimmed.startsWith('- ') && currentKey) {
      let item = trimmed.slice(2).trim();
      if ((item.startsWith('"') && item.endsWith('"')) ||
          (item.startsWith("'") && item.endsWith("'"))) {
        item = item.slice(1, -1);
      }
      const existing = result[currentKey];
      if (Array.isArray(existing)) {
        existing.push(item);
      } else {
        result[currentKey] = [item];
      }
    }
  }

  // Flush any remaining nested object
  if (nestedKey && nestedObj) {
    result[nestedKey] = nestedObj;
  }

  return result;
}

/**
 * Consume an inline array that may span multiple lines.
 * `initial` must start with `[`. If the matching `]` is on the same line
 * (`endIdx === startIdx`) or on a later line, returns the parsed items
 * and the index of the line containing the closing bracket. Returns null
 * if the bracket never closes (caller falls back to scalar parsing).
 */
function consumeInlineArray(
  initial: string,
  lines: string[],
  startIdx: number,
): { items: string[]; endIdx: number } | null {
  if (!initial.startsWith('[')) return null;
  const state = { depth: 0, inQuote: null as string | null };
  let buf = initial;
  let endIdx = startIdx;
  if (scanBrackets(initial, state)) {
    return { items: parseInlineArrayContent(buf), endIdx };
  }
  for (let j = startIdx + 1; j < lines.length; j++) {
    const next = lines[j];
    buf += '\n' + next;
    endIdx = j;
    if (scanBrackets(next, state)) {
      return { items: parseInlineArrayContent(buf), endIdx };
    }
  }
  return null;
}

/**
 * Walk `s` and update bracket/quote state. Returns true when the bracket
 * depth returns to zero within `s` (i.e. the array literal closes here).
 * State is mutated across calls so a multi-line scan can resume.
 */
function scanBrackets(
  s: string,
  state: { depth: number; inQuote: string | null },
): boolean {
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (state.inQuote) {
      if (ch === state.inQuote && s[k - 1] !== '\\') state.inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { state.inQuote = ch; continue; }
    if (ch === '[' || ch === '{') { state.depth++; continue; }
    if (ch === ']' || ch === '}') {
      state.depth--;
      if (state.depth === 0) return true;
    }
  }
  return false;
}

/**
 * Parse a fully-bracketed inline array string (e.g. `[a, "b, c", d]`,
 * possibly containing newlines) into its element list. Quote- and
 * bracket-aware, so commas inside `"..."` or nested `[...]` don't split.
 */
function parseInlineArrayContent(bracketed: string): string[] {
  const open = bracketed.indexOf('[');
  const close = bracketed.lastIndexOf(']');
  if (open < 0 || close <= open) return [];
  const inner = bracketed.slice(open + 1, close);
  return splitArrayItems(inner);
}

function splitArrayItems(inner: string): string[] {
  const items: string[] = [];
  let buf = '';
  let depth = 0;
  let inQuote: string | null = null;
  for (let k = 0; k < inner.length; k++) {
    const ch = inner[k];
    if (inQuote) {
      if (ch === inQuote && inner[k - 1] !== '\\') inQuote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch; buf += ch; continue; }
    if (ch === '[' || ch === '{') { depth++; buf += ch; continue; }
    if (ch === ']' || ch === '}') { depth = Math.max(0, depth - 1); buf += ch; continue; }
    if (ch === ',' && depth === 0) {
      pushItem(items, buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  pushItem(items, buf);
  return items;
}

function pushItem(items: string[], raw: string): void {
  let t = raw.trim();
  if (!t) return;
  if ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1);
  }
  items.push(t);
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();

  // Quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Inline array: [a, b, c] (single-line; multi-line handled by caller)
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return splitArrayItems(trimmed.slice(1, -1));
  }

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  return trimmed;
}
