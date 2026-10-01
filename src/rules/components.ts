import type { Change, OpenAPIDocument } from '../types.js';
import { diffSchemas } from './schemas.js';
import { change, type JsonSchema } from './util.js';

/** Diff shared schemas when referenced; also report unused component-only diffs at schema level. */
export function diffComponents(
  base: OpenAPIDocument,
  head: OpenAPIDocument,
): Change[] {
  const out: Change[] = [];
  const bComp = (base.components as Record<string, unknown>)?.schemas as
    | Record<string, JsonSchema>
    | undefined;
  const hComp = (head.components as Record<string, unknown>)?.schemas as
    | Record<string, JsonSchema>
    | undefined;
  if (!bComp && !hComp) return out;
  const names = new Set([...Object.keys(bComp ?? {}), ...Object.keys(hComp ?? {})]);
  for (const name of names) {
    const b = bComp?.[name];
    const h = hComp?.[name];
    if (b && !h) {
      out.push(
        change('error', 'component-removed', `Component schema "${name}" removed`, {
          location: `#/components/schemas/${name}`,
        }),
      );
      continue;
    }
    if (!b && h) {
      out.push(
        change('warning', 'component-added', `Component schema "${name}" added`, {
          location: `#/components/schemas/${name}`,
        }),
      );
      continue;
    }
    if (b && h) {
      out.push(
        ...diffSchemas(b, h, 'request', `#/components/schemas/${name}`, {
          location: `#/components/schemas/${name}`,
        }),
      );
    }
  }
  return out;
}
