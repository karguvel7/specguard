import { describe, expect, it } from 'vitest';
import { diffSchemas } from '../src/rules/schemas.js';
import { countBySeverity } from '../src/report.js';
import type { Change } from '../src/types.js';

function diff(
  base: Record<string, unknown> | undefined,
  head: Record<string, unknown> | undefined,
  mode: 'request' | 'response',
) {
  return diffSchemas(base, head, mode, 'test');
}

describe('schema diff', () => {
  it('flags removed enum value on request as error', () => {
    const changes = diff(
      { type: 'string', enum: ['a', 'b'] },
      { type: 'string', enum: ['a'] },
      'request',
    );
    expect(changes.some((c) => c.code === 'enum-value-removed' && c.severity === 'error')).toBe(
      true,
    );
  });

  it('flags added enum value on response as error', () => {
    const changes = diff(
      { type: 'string', enum: ['a'] },
      { type: 'string', enum: ['a', 'b'] },
      'response',
    );
    expect(changes.some((c) => c.code === 'enum-value-added' && c.severity === 'error')).toBe(
      true,
    );
  });

  it('flags loosened maxLength on request as warning', () => {
    const changes = diff(
      { type: 'string', maxLength: 10 },
      { type: 'string', maxLength: 20 },
      'request',
    );
    expect(changes.some((c) => c.code === 'constraint-loosened' && c.severity === 'warning')).toBe(
      true,
    );
  });

  it('flags loosened maxLength on response as error', () => {
    const changes = diff(
      { type: 'string', maxLength: 10 },
      { type: 'string', maxLength: 20 },
      'response',
    );
    expect(changes.some((c) => c.code === 'constraint-loosened' && c.severity === 'error')).toBe(
      true,
    );
  });

  it('flags new required field on request as error', () => {
    const changes = diff(
      { type: 'object', properties: { a: { type: 'string' } } },
      { type: 'object', required: ['a'], properties: { a: { type: 'string' } } },
      'request',
    );
    expect(changes.some((c) => c.code === 'required-added')).toBe(true);
  });

  it('flags removed property on response as error', () => {
    const changes = diff(
      { type: 'object', properties: { a: { type: 'string' } } },
      { type: 'object', properties: {} },
      'response',
    );
    expect(changes.some((c) => c.code === 'property-removed' && c.severity === 'error')).toBe(
      true,
    );
  });

  it('flags oneOf shrink on request as error', () => {
    const changes = diff(
      { oneOf: [{ type: 'string' }, { type: 'number' }] },
      { oneOf: [{ type: 'string' }] },
      'request',
    );
    expect(changes.some((c) => c.code === 'oneOf-shrunk')).toBe(true);
  });

  it('flags oneOf grow on response as error', () => {
    const changes = diff(
      { oneOf: [{ type: 'string' }] },
      { oneOf: [{ type: 'string' }, { type: 'number' }] },
      'response',
    );
    expect(changes.some((c) => c.code === 'oneOf-expanded' && c.severity === 'error')).toBe(
      true,
    );
  });

  it('integer to number widening on request is warning', () => {
    const changes = diff({ type: 'integer' }, { type: 'number' }, 'request');
    expect(changes.some((c) => c.code === 'type-widened' && c.severity === 'warning')).toBe(true);
  });

  it('integer to number widening on response is error', () => {
    const changes = diff({ type: 'integer' }, { type: 'number' }, 'response');
    expect(changes.some((c) => c.code === 'type-widened' && c.severity === 'error')).toBe(true);
  });

  it('string to integer is error in both modes', () => {
    for (const mode of ['request', 'response'] as const) {
      const changes = diff({ type: 'string' }, { type: 'integer' }, mode);
      expect(changes.some((c) => c.code === 'type-changed' && c.severity === 'error')).toBe(
        true,
      );
    }
  });

  it('nullable added on request is warning', () => {
    const changes = diff({ type: 'string' }, { type: ['string', 'null'] }, 'request');
    expect(changes.some((c) => c.code === 'type-null-added')).toBe(true);
  });

  it('aggregates nested property changes', () => {
    const changes = diff(
      { type: 'object', properties: { x: { type: 'string' } } },
      { type: 'object', properties: { x: { type: 'integer' } } },
      'request',
    );
    expect(changes.length).toBeGreaterThan(0);
  });
});

describe('severity helpers', () => {
  it('counts mixed severities', () => {
    const changes: Change[] = [
      { severity: 'error', code: 'a', message: 'a' },
      { severity: 'warning', code: 'b', message: 'b' },
      { severity: 'warning', code: 'c', message: 'c' },
    ];
    const counts = countBySeverity(changes);
    expect(counts.error).toBe(1);
    expect(counts.warning).toBe(2);
  });
});
