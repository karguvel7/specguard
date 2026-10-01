import type { Change, CompatMode } from '../types.js';
import {
  breakSeverity,
  change,
  compatibleSeverity,
  hasNullType,
  pushWorse,
  schemaType,
  type JsonSchema,
} from './util.js';

function compareTypes(
  base: JsonSchema | undefined,
  head: JsonSchema | undefined,
  mode: CompatMode,
  location: string,
  ctx: Partial<Change>,
): Change[] {
  const out: Change[] = [];
  if (!base && !head) return out;
  if (!base && head) {
    out.push(
      change(
        compatibleSeverity(mode),
        'schema-added',
        `Schema added at ${location}`,
        { ...ctx, location },
      ),
    );
    return out;
  }
  if (base && !head) {
    out.push(
      change(
        breakSeverity(mode),
        'schema-removed',
        `Schema removed at ${location}`,
        { ...ctx, location },
      ),
    );
    return out;
  }
  if (!base || !head) return out;
  const bt = schemaType(base);
  const ht = schemaType(head);
  const baseHasNull = hasNullType(base);
  const headHasNull = hasNullType(head);
  if (baseHasNull !== headHasNull) {
    if (!baseHasNull && headHasNull) {
      out.push(
        change(
          compatibleSeverity(mode),
          'type-null-added',
          `Nullable type at ${location}`,
          { ...ctx, location },
        ),
      );
    } else {
      out.push(
        change(
          breakSeverity(mode),
          'type-null-removed',
          `Type no longer allows null at ${location}`,
          { ...ctx, location },
        ),
      );
    }
  }
  if (bt && ht && bt !== ht) {
    const bCore = bt.split('|')[0];
    const hCore = ht.split('|')[0];
    if (bCore !== hCore) {
      const numericPair =
        (bCore === 'integer' && hCore === 'number') ||
        (bCore === 'number' && hCore === 'integer');
      if (!numericPair) {
        out.push(
          change('error', 'type-changed', `Type changed from ${bt} to ${ht} at ${location}`, {
            ...ctx,
            location,
          }),
        );
      } else {
        const widened = bCore === 'integer' && hCore === 'number';
        if (widened) {
          out.push(
            change(
              mode === 'request' ? 'warning' : 'error',
              'type-widened',
              `Type widened from ${bt} to ${ht} at ${location}`,
              { ...ctx, location },
            ),
          );
        } else {
          out.push(
            change(
              mode === 'request' ? 'error' : 'warning',
              'type-narrowed',
              `Type narrowed from ${bt} to ${ht} at ${location}`,
              { ...ctx, location },
            ),
          );
        }
      }
    }
  }
  return out;
}

function compareEnum(
  base: JsonSchema,
  head: JsonSchema,
  mode: CompatMode,
  location: string,
  ctx: Partial<Change>,
): Change[] {
  const out: Change[] = [];
  const be = Array.isArray(base.enum) ? base.enum.map(String) : null;
  const he = Array.isArray(head.enum) ? head.enum.map(String) : null;
  if (!be && !he) return out;
  if (!be && he) {
    out.push(
      change(
        breakSeverity(mode),
        'enum-added',
        `Enum constraint added at ${location}`,
        { ...ctx, location },
      ),
    );
    return out;
  }
  if (be && !he) {
    out.push(
      change(
        compatibleSeverity(mode),
        'enum-removed',
        `Enum constraint removed at ${location}`,
        { ...ctx, location },
      ),
    );
    return out;
  }
  if (!be || !he) return out;
  const removed = be.filter((v) => !he.includes(v));
  const added = he.filter((v) => !be.includes(v));
  for (const v of removed) {
    out.push(
      change(
        mode === 'request' ? 'error' : 'warning',
        'enum-value-removed',
        `Enum value "${v}" removed at ${location}`,
        { ...ctx, location },
      ),
    );
  }
  for (const v of added) {
    out.push(
      change(
        mode === 'request' ? 'warning' : 'error',
        'enum-value-added',
        `Enum value "${v}" added at ${location}`,
        { ...ctx, location },
      ),
    );
  }
  return out;
}

function numVal(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

function compareConstraints(
  base: JsonSchema,
  head: JsonSchema,
  mode: CompatMode,
  location: string,
  ctx: Partial<Change>,
): Change[] {
  const out: Change[] = [];
  const keys = ['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems'];
  for (const key of keys) {
    const b = numVal(base[key]);
    const h = numVal(head[key]);
    if (b === undefined && h === undefined) continue;
    if (b === undefined && h !== undefined) {
      out.push(
        change(
          breakSeverity(mode),
          'constraint-added',
          `New ${key}=${h} at ${location}`,
          { ...ctx, location },
        ),
      );
      continue;
    }
    if (b !== undefined && h === undefined) continue;
    if (b === h) continue;
    const tighter =
      key.startsWith('min')
        ? h !== undefined && b !== undefined && h > b
        : h !== undefined && b !== undefined && h < b;
    if (tighter) {
      out.push(
        change(
          mode === 'request' ? 'error' : 'warning',
          'constraint-tightened',
          `${key} tightened from ${b} to ${h} at ${location}`,
          { ...ctx, location },
        ),
      );
    } else {
      out.push(
        change(
          mode === 'request' ? 'warning' : 'error',
          'constraint-loosened',
          `${key} loosened from ${b} to ${h} at ${location}`,
          { ...ctx, location },
        ),
      );
    }
  }
  if (base.pattern !== head.pattern) {
    if (base.pattern !== undefined || head.pattern !== undefined) {
      out.push(
        change(
          'error',
          'pattern-changed',
          `pattern changed at ${location}`,
          { ...ctx, location },
        ),
      );
    }
  }
  if (base.format !== head.format) {
    if (base.format !== undefined || head.format !== undefined) {
      out.push(
        change(
          'error',
          'format-changed',
          `format changed at ${location}`,
          { ...ctx, location },
        ),
      );
    }
  }
  return out;
}

function compareRequired(
  baseReq: string[],
  headReq: string[],
  mode: CompatMode,
  location: string,
  ctx: Partial<Change>,
): Change[] {
  const out: Change[] = [];
  const added = headReq.filter((r) => !baseReq.includes(r));
  const removed = baseReq.filter((r) => !headReq.includes(r));
  for (const r of added) {
    out.push(
      change(
        mode === 'request' ? 'error' : 'warning',
        'required-added',
        `Property "${r}" is now required at ${location}`,
        { ...ctx, location },
      ),
    );
  }
  for (const r of removed) {
    out.push(
      change(
        mode === 'request' ? 'warning' : 'error',
        'required-removed',
        `Property "${r}" is no longer required at ${location}`,
        { ...ctx, location },
      ),
    );
  }
  return out;
}

function compareOneOfAnyOf(
  base: JsonSchema,
  head: JsonSchema,
  key: 'oneOf' | 'anyOf',
  mode: CompatMode,
  location: string,
  ctx: Partial<Change>,
): Change[] {
  const b = Array.isArray(base[key]) ? base[key].length : 0;
  const h = Array.isArray(head[key]) ? head[key].length : 0;
  if (b === h) return [];
  if (h > b) {
    return [
      change(
        mode === 'request' ? 'warning' : 'error',
        `${key}-expanded`,
        `${key} length increased at ${location}`,
        { ...ctx, location },
      ),
    ];
  }
  return [
    change(
      mode === 'request' ? 'error' : 'warning',
      `${key}-shrunk`,
      `${key} length decreased at ${location}`,
      { ...ctx, location },
    ),
  ];
}

export function diffSchemas(
  base: JsonSchema | undefined,
  head: JsonSchema | undefined,
  mode: CompatMode,
  location: string,
  ctx: Partial<Change> = {},
): Change[] {
  const out: Change[] = [];
  pushWorse(out, compareTypes(base, head, mode, location, ctx));
  if (!base || !head) return out;
  pushWorse(out, compareEnum(base, head, mode, location, ctx));
  pushWorse(out, compareConstraints(base, head, mode, location, ctx));
  pushWorse(out, compareOneOfAnyOf(base, head, 'oneOf', mode, location, ctx));
  pushWorse(out, compareOneOfAnyOf(base, head, 'anyOf', mode, location, ctx));

  const baseProps = (base.properties as Record<string, JsonSchema>) ?? {};
  const headProps = (head.properties as Record<string, JsonSchema>) ?? {};
  const baseReq = Array.isArray(base.required)
    ? base.required.filter((r): r is string => typeof r === 'string')
    : [];
  const headReq = Array.isArray(head.required)
    ? head.required.filter((r): r is string => typeof r === 'string')
    : [];
  pushWorse(out, compareRequired(baseReq, headReq, mode, location, ctx));

  for (const key of Object.keys(baseProps)) {
    if (!(key in headProps)) {
      out.push(
        change(
          mode === 'request' ? 'warning' : 'error',
          'property-removed',
          `Property "${key}" removed at ${location}`,
          { ...ctx, location },
        ),
      );
    }
  }
  for (const key of Object.keys(headProps)) {
    if (!(key in baseProps)) {
      out.push(
        change(
          compatibleSeverity(mode),
          'property-added',
          `Property "${key}" added at ${location}`,
          { ...ctx, location },
        ),
      );
    }
  }
  for (const key of new Set([...Object.keys(baseProps), ...Object.keys(headProps)])) {
    pushWorse(
      out,
      diffSchemas(baseProps[key], headProps[key], mode, `${location}.${key}`, ctx),
    );
  }
  if (base.type === 'array' || head.type === 'array') {
    pushWorse(
      out,
      diffSchemas(
        base.items as JsonSchema,
        head.items as JsonSchema,
        mode,
        `${location}[]`,
        ctx,
      ),
    );
  }
  return out;
}
