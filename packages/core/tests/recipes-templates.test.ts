// @fctry: #bootstrap-primitive-composition
//
// Spec 0.29 (S155–S160): tests for the token resolver's `email_account`
// support and the `{name|fallback}` per-step-default syntax.

import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  resolveParams,
  EXAMPLE_CONTEXT,
  SUPPORTED_TOKENS,
  type ProjectContext,
} from '../src/recipes/templates.js';

const baseCtx: ProjectContext = {
  name: 'alpha',
  path: '/tmp/alpha',
  type: 'Code project',
  parent_path: '/tmp',
  template_directory: null,
  email_account: null,
};

describe('SUPPORTED_TOKENS', () => {
  it('includes project.email_account (spec 0.29)', () => {
    expect(SUPPORTED_TOKENS).toContain('project.email_account');
  });

  it('still has the original five tokens', () => {
    expect(SUPPORTED_TOKENS).toEqual(
      expect.arrayContaining([
        'project.name',
        'project.path',
        'project.type',
        'project.parent_path',
        'project.type.template_directory',
      ]),
    );
  });
});

describe('EXAMPLE_CONTEXT', () => {
  it('carries an example email_account so Preview substitutes it', () => {
    expect(EXAMPLE_CONTEXT.email_account).toBe('<example-email-account>');
  });
});

describe('resolveTemplate — project.email_account (S155, S157)', () => {
  it('resolves to the project field when set', () => {
    const ctx: ProjectContext = { ...baseCtx, email_account: 'm@h3r3.com' };
    expect(resolveTemplate('Projects/{project.email_account}', ctx)).toEqual({
      ok: true,
      value: 'Projects/m@h3r3.com',
    });
  });

  it('returns unknown-token failure when project field is null and no fallback (S160)', () => {
    const result = resolveTemplate('{project.email_account}', baseCtx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.token).toBe('project.email_account');
  });

  it('returns unknown-token failure when project field is empty string (S160)', () => {
    const ctx: ProjectContext = { ...baseCtx, email_account: '' };
    const result = resolveTemplate('{project.email_account}', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown-token');
  });
});

describe('resolveTemplate — `{name|fallback}` per-step default (S158, S166)', () => {
  it('uses the project field when set (precedence: project wins over fallback)', () => {
    const ctx: ProjectContext = { ...baseCtx, email_account: 'work@example.com' };
    const result = resolveTemplate(
      '{project.email_account|m@h3r3.com}',
      ctx,
    );
    expect(result).toEqual({ ok: true, value: 'work@example.com' });
  });

  it('falls through to the literal fallback when project field is null (S158)', () => {
    const ctx: ProjectContext = { ...baseCtx, email_account: null };
    const result = resolveTemplate(
      '{project.email_account|m@h3r3.com}',
      ctx,
    );
    expect(result).toEqual({ ok: true, value: 'm@h3r3.com' });
  });

  it('falls through to the literal fallback when project field is empty string', () => {
    const ctx: ProjectContext = { ...baseCtx, email_account: '' };
    const result = resolveTemplate(
      '{project.email_account|m@h3r3.com}',
      ctx,
    );
    expect(result).toEqual({ ok: true, value: 'm@h3r3.com' });
  });

  it('still resolves embedded literals around a fallback token', () => {
    const ctx: ProjectContext = { ...baseCtx };
    expect(
      resolveTemplate('Inbox/{project.email_account|fallback@me.com}/{project.name}', ctx),
    ).toEqual({ ok: true, value: 'Inbox/fallback@me.com/alpha' });
  });

  it('an empty fallback (after `|`) is treated as no-fallback — surfaces unresolved', () => {
    const ctx: ProjectContext = { ...baseCtx };
    const result = resolveTemplate('{project.email_account|}', ctx);
    expect(result.ok).toBe(false);
  });
});

describe('resolveParams — full param-map resolve', () => {
  it('resolves account binding via fallback when project field is unset (S158)', () => {
    const ctx: ProjectContext = { ...baseCtx, email_account: null };
    const result = resolveParams(
      {
        account: '{project.email_account|m@h3r3.com}',
        mailbox: 'Projects/{project.name}',
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.account).toBe('m@h3r3.com');
      expect(result.values.mailbox).toBe('Projects/alpha');
    }
  });

  it('returns the failing key when any value cannot resolve', () => {
    const ctx: ProjectContext = { ...baseCtx, email_account: null };
    const result = resolveParams(
      {
        account: '{project.email_account}',
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.key).toBe('account');
      expect(result.failure.token).toBe('project.email_account');
    }
  });
});
