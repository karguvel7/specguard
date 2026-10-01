import type { Change, OpenAPIDocument } from '../types.js';
import { HTTP_METHODS } from '../types.js';
import { change, isDeprecatedOperation, operationId } from './util.js';

export function diffPaths(
  base: OpenAPIDocument,
  head: OpenAPIDocument,
): Change[] {
  const out: Change[] = [];
  const basePaths = (base.paths as Record<string, unknown>) ?? {};
  const headPaths = (head.paths as Record<string, unknown>) ?? {};

  for (const path of Object.keys(basePaths)) {
    if (!(path in headPaths)) {
      const pathItem = basePaths[path] as Record<string, unknown>;
      const allDeprecated = HTTP_METHODS.every((m) => {
        const op = pathItem[m] as Record<string, unknown> | undefined;
        return !op || isDeprecatedOperation(op);
      });
      out.push(
        change(
          allDeprecated ? 'warning' : 'error',
          'path-removed',
          `Path removed: ${path}`,
          { path },
        ),
      );
      continue;
    }
    const baseItem = basePaths[path] as Record<string, unknown>;
    const headItem = headPaths[path] as Record<string, unknown>;
    for (const method of HTTP_METHODS) {
      const bOp = baseItem[method] as Record<string, unknown> | undefined;
      const hOp = headItem[method] as Record<string, unknown> | undefined;
      if (bOp && !hOp) {
        const sev = isDeprecatedOperation(bOp) ? 'warning' : 'error';
        out.push(
          change(sev, 'operation-removed', `Operation removed: ${method.toUpperCase()} ${path}`, {
            path,
            method,
            operationId: operationId(path, method, bOp),
          }),
        );
      }
      if (!bOp && hOp) {
        out.push(
          change('warning', 'operation-added', `Operation added: ${method.toUpperCase()} ${path}`, {
            path,
            method,
            operationId: operationId(path, method, hOp),
          }),
        );
      }
    }
  }
  for (const path of Object.keys(headPaths)) {
    if (!(path in basePaths)) {
      out.push(
        change('warning', 'path-added', `Path added: ${path}`, { path }),
      );
    }
  }
  return out;
}
