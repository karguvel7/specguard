import type { Change, CompatMode } from '../types.js';

export type JsonSchema = Record<string, unknown>;

export function change(
  severity: Change['severity'],
  code: string,
  message: string,
  ctx: Partial<Change> = {},
): Change {
  return { severity, code, message, ...ctx };
}

export function schemaType(schema: JsonSchema | undefined): string | undefined {
  if (!schema) return undefined;
  if (typeof schema.type === 'string') return schema.type;
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((t) => t !== 'null');
    return types.length === 1 ? types[0] : types.join('|');
  }
  if (schema.enum) return 'enum';
  return undefined;
}

export function hasNullType(schema: JsonSchema): boolean {
  if (Array.isArray(schema.type) && schema.type.includes('null')) return true;
  if (schema.nullable === true) return true;
  return false;
}

export function pushWorse(target: Change[], items: Change[]): void {
  target.push(...items);
}

/** Breaking on request = error; on response = warning (and vice versa for compatible direction). */
export function severityForRequestBreak(): Change['severity'] {
  return 'error';
}

export function severityForRequestCompatible(): Change['severity'] {
  return 'warning';
}

export function severityForResponseBreak(): Change['severity'] {
  return 'error';
}

export function severityForResponseCompatible(): Change['severity'] {
  return 'warning';
}

export function breakSeverity(mode: CompatMode): Change['severity'] {
  return mode === 'request'
    ? severityForRequestBreak()
    : severityForResponseBreak();
}

export function compatibleSeverity(mode: CompatMode): Change['severity'] {
  return mode === 'request'
    ? severityForRequestCompatible()
    : severityForResponseCompatible();
}

export function isDeprecatedOperation(op: Record<string, unknown> | undefined): boolean {
  return op?.deprecated === true;
}

export function operationId(
  path: string,
  method: string,
  op: Record<string, unknown> | undefined,
): string | undefined {
  if (op && typeof op.operationId === 'string') return op.operationId;
  return `${method.toUpperCase()} ${path}`;
}
