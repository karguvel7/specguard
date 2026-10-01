import { describe, expect, it } from 'vitest';
import { normalizeDocument } from '../src/normalize.js';
import type { OpenAPIDocument } from '../src/types.js';

describe('normalizeDocument', () => {
  it('merges allOf object properties', () => {
    const doc: OpenAPIDocument = {
      openapi: '3.0.3',
      paths: {},
      components: {
        schemas: {
          Merged: {
            allOf: [
              { type: 'object', properties: { a: { type: 'string' } } },
              { type: 'object', properties: { b: { type: 'integer' } }, required: ['b'] },
            ],
          },
        },
      },
    };
    const norm = normalizeDocument(doc);
    const merged = (norm.components as Record<string, Record<string, unknown>>).schemas
      .Merged as Record<string, unknown>;
    expect(merged.properties).toBeDefined();
    const props = merged.properties as Record<string, unknown>;
    expect(props.a).toBeDefined();
    expect(props.b).toBeDefined();
    expect(merged.required).toContain('b');
  });

  it('strips description fields during normalize', () => {
    const doc: OpenAPIDocument = {
      openapi: '3.0.3',
      info: { title: 't', version: '1' },
      paths: {
        '/x': {
          get: {
            description: 'old',
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const norm = normalizeDocument(doc);
    const get = (norm.paths as Record<string, Record<string, Record<string, unknown>>>)['/x'].get;
    expect(get.description).toBeUndefined();
  });

  it('resolves local ref', () => {
    const doc: OpenAPIDocument = {
      openapi: '3.0.3',
      paths: {
        '/items': {
          get: {
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Item' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Item: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    };
    const norm = normalizeDocument(doc);
    const schema = (
      (norm.paths as Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>>)['/items']
        .get.responses['200'].content['application/json'].schema as Record<string, unknown>
    );
    expect(schema.type).toBe('object');
    expect(schema.$ref).toBeUndefined();
  });
});
