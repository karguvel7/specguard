import { describe, expect, it } from 'vitest';
import { checkSpecs, diffDocuments } from '../src/detector.js';
import { loadSpec } from '../src/loader.js';
import { countBySeverity } from '../src/report.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function pair(name: string) {
  const base = await loadSpec(join(root, 'fixtures/base.openapi.yaml'));
  const head = await loadSpec(join(root, `fixtures/${name}`));
  return { base, head };
}

describe('fixtures', () => {
  it('breaking fixture reports errors', async () => {
    const result = await checkSpecs({
      base: join(root, 'fixtures/base.openapi.yaml'),
      head: join(root, 'fixtures/head-breaking.openapi.yaml'),
    });
    const counts = countBySeverity(result.changes);
    expect(counts.error).toBeGreaterThanOrEqual(9);
    expect(counts.error).toBeGreaterThan(counts.warning);
  });

  it('compatible fixture has no errors', async () => {
    const result = await checkSpecs({
      base: join(root, 'fixtures/base.openapi.yaml'),
      head: join(root, 'fixtures/head-compatible.openapi.yaml'),
    });
    const counts = countBySeverity(result.changes);
    expect(counts.error).toBe(0);
    expect(counts.warning).toBeGreaterThan(0);
    expect(counts.info).toBeGreaterThanOrEqual(1);
  });
});

describe('path and operation rules', () => {
  it('detects removed path', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    delete (head.paths as Record<string, unknown>)['/pets'];
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'path-removed')).toBe(true);
  });

  it('warns when removed path is all deprecated', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    delete (head.paths as Record<string, unknown>)['/legacy/report'];
    const changes = diffDocuments(base, head);
    const c = changes.find((x) => x.code === 'path-removed' && x.path === '/legacy/report');
    expect(c?.severity).toBe('warning');
  });

  it('detects removed operation', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const pets = (head.paths as Record<string, Record<string, unknown>>)['/pets'];
    delete pets.post;
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'operation-removed')).toBe(true);
  });

  it('warns on removed deprecated operation', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const item = (head.paths as Record<string, Record<string, unknown>>)['/pets/{petId}'];
    delete item.delete;
    const changes = diffDocuments(base, head);
    const c = changes.find((c) => c.code === 'operation-removed' && c.method === 'delete');
    expect(c?.severity).toBe('warning');
  });

  it('detects added path as warning', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    (head.paths as Record<string, unknown>)['/new'] = { get: { responses: { '200': { description: 'ok' } } } };
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'path-added')).toBe(true);
  });
});

describe('response rules', () => {
  it('detects removed response status', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const get = (head.paths as Record<string, Record<string, Record<string, unknown>>>)['/pets'].get;
    const responses = get.responses as Record<string, unknown>;
    delete responses['400'];
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'response-removed')).toBe(true);
  });
});

describe('parameter and request rules', () => {
  it('detects new required query parameter', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const params = (head.paths as Record<string, Record<string, Record<string, unknown[]>>>)['/pets'].get
      .parameters as Record<string, unknown>[];
    const limit = params.find((p) => p.name === 'limit') as Record<string, unknown>;
    limit.required = true;
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'parameter-required')).toBe(true);
  });

  it('detects removed enum value on request', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const params = (head.paths as Record<string, Record<string, Record<string, unknown[]>>>)['/pets'].get
      .parameters as Record<string, unknown>[];
    const status = params.find((p) => p.name === 'status') as Record<string, unknown>;
    (status.schema as Record<string, unknown>).enum = ['available'];
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'enum-value-removed')).toBe(true);
  });
});

describe('schema rules', () => {
  it('detects type change on response property', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const pet = (head.components as Record<string, Record<string, Record<string, unknown>>>).schemas.Pet;
    (pet.properties as Record<string, unknown>).name = { type: 'integer' };
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'type-changed' || c.code === 'type-narrowed')).toBe(true);
  });

  it('detects tightened maxLength on request', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const input = (head.components as Record<string, Record<string, Record<string, unknown>>>).schemas.PetInput;
    (input.properties as Record<string, unknown>).name = { type: 'string', maxLength: 10 };
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'constraint-tightened')).toBe(true);
  });

  it('detects new required request property', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const input = (head.components as Record<string, Record<string, Record<string, unknown>>>).schemas.PetInput;
    input.required = ['name'];
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'required-added')).toBe(true);
  });

  it('detects pattern change as error', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const input = (head.components as Record<string, Record<string, Record<string, unknown>>>).schemas.PetInput;
    (input.properties as Record<string, unknown>).name = { type: 'string', pattern: '^[0-9]+$' };
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'pattern-changed')).toBe(true);
  });

  it('widening integer to number on request is warning', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const params = (head.paths as Record<string, Record<string, Record<string, unknown[]>>>)['/pets'].get
      .parameters as Record<string, unknown>[];
    const limit = params.find((p) => p.name === 'limit') as Record<string, unknown>;
    (limit.schema as Record<string, unknown>).type = 'number';
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'type-widened')).toBe(true);
  });

  it('narrows path param type on request', async () => {
    const { base } = await pair('base.openapi.yaml');
    const head = structuredClone(base);
    const params = (head.paths as Record<string, Record<string, Record<string, unknown[]>>>)['/pets/{petId}'].get
      .parameters as Record<string, unknown>[];
    const petId = params.find((p) => p.name === 'petId') as Record<string, unknown>;
    (petId.schema as Record<string, unknown>).type = 'integer';
    const changes = diffDocuments(base, head);
    expect(changes.some((c) => c.code === 'type-changed' || c.code === 'type-narrowed')).toBe(true);
  });
});

describe('normalize', () => {
  it('rejects external refs', async () => {
    const base = await loadSpec(join(root, 'fixtures/base.openapi.yaml'));
    const head = structuredClone(base);
    (head.paths as Record<string, Record<string, unknown>>)['/pets'].get = {
      responses: {
        '200': {
          description: 'x',
          content: {
            'application/json': {
              schema: { $ref: 'http://example.com/schema.json' },
            },
          },
        },
      },
    };
    expect(() => diffDocuments(base, head)).toThrow();
  });

  it('resolves local component refs', async () => {
    const result = await checkSpecs({
      base: join(root, 'fixtures/base.openapi.yaml'),
      head: join(root, 'fixtures/base.openapi.yaml'),
    });
    expect(result.changes).toHaveLength(0);
  });
});

describe('breaking fixture codes', () => {
  it('includes response removal and enum removal', async () => {
    const result = await checkSpecs({
      base: join(root, 'fixtures/base.openapi.yaml'),
      head: join(root, 'fixtures/head-breaking.openapi.yaml'),
    });
    const codes = new Set(result.changes.map((c) => c.code));
    expect(codes.has('enum-value-removed')).toBe(true);
    expect(codes.has('type-changed')).toBe(true);
    expect(codes.has('parameter-required')).toBe(true);
  });
});
