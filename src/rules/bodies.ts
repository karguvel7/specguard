import type { Change, OpenAPIDocument } from '../types.js';
import { HTTP_METHODS } from '../types.js';
import { diffSchemas } from './schemas.js';
import { operationId, type JsonSchema } from './util.js';

export function diffRequestBodies(
  base: OpenAPIDocument,
  head: OpenAPIDocument,
): Change[] {
  const out: Change[] = [];
  const basePaths = (base.paths as Record<string, unknown>) ?? {};
  const headPaths = (head.paths as Record<string, unknown>) ?? {};

  for (const path of Object.keys(basePaths)) {
    if (!(path in headPaths)) continue;
    const baseItem = basePaths[path] as Record<string, unknown>;
    const headItem = headPaths[path] as Record<string, unknown>;
    for (const method of HTTP_METHODS) {
      const bOp = baseItem[method] as Record<string, unknown> | undefined;
      const hOp = headItem[method] as Record<string, unknown> | undefined;
      if (!bOp || !hOp) continue;
      const ctx = {
        path,
        method,
        operationId: operationId(path, method, bOp),
      };
      const bBody = bOp.requestBody as Record<string, unknown> | undefined;
      const hBody = hOp.requestBody as Record<string, unknown> | undefined;
      if (!bBody && !hBody) continue;
      const bSchema = extractJsonSchema(bBody);
      const hSchema = extractJsonSchema(hBody);
      out.push(
        ...diffSchemas(bSchema, hSchema, 'request', 'requestBody', ctx),
      );
    }
  }
  return out;
}

function extractJsonSchema(
  body: Record<string, unknown> | undefined,
): JsonSchema | undefined {
  if (!body) return undefined;
  const content = body.content as Record<string, unknown> | undefined;
  if (!content) return undefined;
  const appJson = content['application/json'] as Record<string, unknown> | undefined;
  if (!appJson) return undefined;
  return appJson.schema as JsonSchema | undefined;
}
