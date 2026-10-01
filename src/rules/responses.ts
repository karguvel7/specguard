import type { Change, OpenAPIDocument } from '../types.js';
import { HTTP_METHODS } from '../types.js';
import { diffSchemas } from './schemas.js';
import { change, operationId, type JsonSchema } from './util.js';

export function diffResponses(
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
      const bResp = (bOp.responses as Record<string, unknown>) ?? {};
      const hResp = (hOp.responses as Record<string, unknown>) ?? {};
      for (const code of Object.keys(bResp)) {
        if (!(code in hResp)) {
          out.push(
            change(
              'error',
              'response-removed',
              `Response status ${code} removed for ${method.toUpperCase()} ${path}`,
              { ...ctx, location: code },
            ),
          );
        }
      }
      for (const code of Object.keys(hResp)) {
        if (!(code in bResp)) {
          out.push(
            change(
              'warning',
              'response-added',
              `Response status ${code} added for ${method.toUpperCase()} ${path}`,
              { ...ctx, location: code },
            ),
          );
        }
      }
      for (const code of Object.keys(bResp)) {
        if (!(code in hResp)) continue;
        const bSchema = responseSchema(bResp[code] as Record<string, unknown>);
        const hSchema = responseSchema(hResp[code] as Record<string, unknown>);
        out.push(
          ...diffSchemas(bSchema, hSchema, 'response', `response ${code}`, ctx),
        );
      }
    }
  }
  return out;
}

function responseSchema(resp: Record<string, unknown> | undefined): JsonSchema | undefined {
  if (!resp) return undefined;
  const content = resp.content as Record<string, unknown> | undefined;
  if (!content) return undefined;
  const appJson = content['application/json'] as Record<string, unknown> | undefined;
  if (!appJson) return undefined;
  return appJson.schema as JsonSchema | undefined;
}
