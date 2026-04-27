import { describe, it, expect } from 'vitest';
import { parse } from '../src/yaml-parse.js';

describe('yaml-parse', () => {
  it('parses scalar values', () => {
    const result = parse('title: Foo\nversion: "1.2"\nactive: true\ncount: 7');
    expect(result).toEqual({
      title: 'Foo',
      version: '1.2',
      active: true,
      count: 7,
    });
  });

  it('parses single-line inline arrays', () => {
    const result = parse('tags: [a, "b c", d]');
    expect(result.tags).toEqual(['a', 'b c', 'd']);
  });

  it('parses block arrays at top level', () => {
    const text = [
      'goals:',
      '  - First',
      '  - "Second goal"',
      '  - Third',
    ].join('\n');
    expect(parse(text).goals).toEqual(['First', 'Second goal', 'Third']);
  });

  it('parses nested objects with block arrays (post-3d778fe)', () => {
    const text = [
      'synopsis:',
      '  short: "A short summary"',
      '  tech-stack:',
      '    - Node',
      '    - "TypeScript"',
      '    - SQLite',
      '  goals:',
      '    - Goal one',
      '    - Goal two',
    ].join('\n');
    const result = parse(text);
    expect(result.synopsis).toEqual({
      short: 'A short summary',
      'tech-stack': ['Node', 'TypeScript', 'SQLite'],
      goals: ['Goal one', 'Goal two'],
    });
  });

  it('parses multi-line inline arrays at top level', () => {
    const text = [
      'patterns: [',
      '  "first pattern",',
      '  "second pattern",',
      '  "third"',
      ']',
    ].join('\n');
    expect(parse(text).patterns).toEqual([
      'first pattern',
      'second pattern',
      'third',
    ]);
  });

  it('parses multi-line inline arrays inside a nested object', () => {
    const text = [
      'synopsis:',
      '  short: "Hello"',
      '  patterns: [',
      '    "alpha",',
      '    "beta with, comma",',
      '    "gamma"',
      '  ]',
      '  goals: ["one", "two"]',
    ].join('\n');
    const result = parse(text) as { synopsis: Record<string, unknown> };
    expect(result.synopsis.short).toBe('Hello');
    expect(result.synopsis.patterns).toEqual([
      'alpha',
      'beta with, comma',
      'gamma',
    ]);
    expect(result.synopsis.goals).toEqual(['one', 'two']);
  });

  it('parses multi-line inline arrays with a trailing comma', () => {
    const text = [
      'tags: [',
      '  "a",',
      '  "b",',
      ']',
    ].join('\n');
    expect(parse(text).tags).toEqual(['a', 'b']);
  });
});
