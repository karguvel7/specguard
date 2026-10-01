import type { Change, OpenAPIDocument } from '../types.js';
import { HTTP_METHODS } from '../types.js';
import { diffSchemas } from './schemas.js';
import { change, operationId, type JsonSchema } from './util.js';

type Param = Record<string, unknown>;

function paramKey(p: Param): string {
  const name = String(p.name ?? '');
  const loc = String(p.in ?? '');
  return `${loc}:${name}`;
}

function mergeParams(
  pathItem: Record<string, unknown> | undefined,
  op: Record<string, unknown> | undefined,
): Param[] {
  const map = new Map<string, Param>();
  const add = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const p of list) {
      if (p && typeof p === 'object') map.set(paramKey(p as Param), p as Param);
    }
  };
  add(pathItem?.parameters);
  add(op?.parameters);
  return [...map.values()];
}

export function diffParameters(
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
      const bParams = mergeParams(baseItem, bOp);
      const hParams = mergeParams(headItem, hOp);
      const bMap = new Map(bParams.map((p) => [paramKey(p), p]));
      const hMap = new Map(hParams.map((p) => [paramKey(p), p]));
      for (const [key, bp] of bMap) {
        if (!hMap.has(key)) {
          out.push(
            change('error', 'parameter-removed', `Parameter removed: ${key}`, {
              ...ctx,
              location: key,
            }),
          );
          continue;
        }
        const hp = hMap.get(key)!;
        const bReq = bp.required === true;
        const hReq = hp.required === true;
        if (!bReq && hReq) {
          out.push(
            change(
              'error',
              'parameter-required',
              `Parameter ${key} is now required`,
              { ...ctx, location: key },
            ),
          );
        }
        out.push(
          ...diffSchemas(
            bp.schema as JsonSchema,
            hp.schema as JsonSchema,
            'request',
            `parameter ${key}`,
            ctx,
          ),
        );
      }
      for (const key of hMap.keys()) {
        if (!bMap.has(key)) {
          out.push(
            change('warning', 'parameter-added', `Parameter added: ${key}`, {
              ...ctx,
              location: key,
            }),
          );
        }
      }
    }
  }
  return out;
}
