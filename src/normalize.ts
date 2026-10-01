import type { OpenAPIDocument } from './types.js';
import { SpecLoadError } from './loader.js';

type JsonSchema = Record<string, unknown>;

const SUPPORTED = new Set(['3.0.0', '3.0.1', '3.0.2', '3.0.3', '3.1.0']);

export function assertOpenApiVersion(doc: OpenAPIDocument): string {
  const openapi = doc.openapi;
  if (typeof openapi !== 'string' || !SUPPORTED.has(openapi)) {
    throw new SpecLoadError(
      `Unsupported or missing openapi version (got ${String(openapi)}; need 3.0.x or 3.1.0)`,
    );
  }
  return openapi;
}

function isRef(obj: unknown): obj is { $ref: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    '$ref' in obj &&
    typeof (obj as { $ref: unknown }).$ref === 'string'
  );
}

function decodeRef(ref: string): string {
  if (!ref.startsWith('#/')) {
    throw new SpecLoadError(`External or unsupported $ref: ${ref}`);
  }
  return ref.slice(2);
}

function getByPointer(doc: OpenAPIDocument, pointer: string): unknown {
  const parts = pointer.split('/');
  let cur: unknown = doc;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') {
      throw new SpecLoadError(`Invalid $ref pointer: #/${pointer}`);
    }
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeAllOf(schemas: JsonSchema[]): JsonSchema {
  const merged: JsonSchema = { type: 'object', properties: {}, required: [] as string[] };
  const props = merged.properties as Record<string, unknown>;
  const required = new Set<string>();
  for (const s of schemas) {
    if (s.type && s.type !== 'object' && !s.allOf) {
      return deepClone(s);
    }
    const p = s.properties as Record<string, unknown> | undefined;
    if (p) {
      for (const [k, v] of Object.entries(p)) {
        props[k] = v;
      }
    }
    const req = s.required;
    if (Array.isArray(req)) {
      for (const r of req) {
        if (typeof r === 'string') required.add(r);
      }
    }
  }
  if (required.size) merged.required = [...required];
  return merged;
}

function resolveNode(
  node: unknown,
  root: OpenAPIDocument,
  stack: string[],
): unknown {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    return node.map((item) => resolveNode(item, root, stack));
  }
  if (isRef(node)) {
    const pointer = decodeRef(node.$ref);
    if (stack.includes(pointer)) {
      return { $ref: node.$ref, _circular: true };
    }
    const target = getByPointer(root, pointer);
    if (target === undefined) {
      throw new SpecLoadError(`Unresolved $ref: ${node.$ref}`);
    }
    return resolveNode(deepClone(target), root, [...stack, pointer]);
  }
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.allOf) && obj.allOf.length > 0) {
    const parts = obj.allOf.map((p) =>
      resolveNode(p, root, stack) as JsonSchema,
    );
    const merged = mergeAllOf(parts);
    const rest = { ...obj };
    delete rest.allOf;
    delete rest.$ref;
    const resolvedRest = resolveNode(rest, root, stack);
    const restObj =
      typeof resolvedRest === 'object' && resolvedRest !== null && !Array.isArray(resolvedRest)
        ? (resolvedRest as JsonSchema)
        : {};
    return { ...merged, ...restObj };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'description' || k === 'example' || k === 'examples') continue;
    out[k] = resolveNode(v, root, stack);
  }
  return out;
}

export function normalizeDocument(doc: OpenAPIDocument): OpenAPIDocument {
  assertOpenApiVersion(doc);
  return resolveNode(deepClone(doc), doc, []) as OpenAPIDocument;
}

export function getSchemaTitle(schema: unknown): string | undefined {
  if (schema && typeof schema === 'object' && 'title' in schema) {
    const t = (schema as { title?: unknown }).title;
    return typeof t === 'string' ? t : undefined;
  }
  return undefined;
}
