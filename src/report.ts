import type { Change, CheckResult, FailOn, RenderOptions } from './types.js';

function useColor(): boolean {
  return !process.env.NO_COLOR && process.stdout.isTTY === true;
}

function colorize(text: string, severity: Change['severity']): string {
  if (!useColor()) return text;
  const codes: Record<Change['severity'], string> = {
    error: '\x1b[31m',
    warning: '\x1b[33m',
    info: '\x1b[36m',
  };
  return `${codes[severity]}${text}\x1b[0m`;
}

export function countBySeverity(changes: Change[]): Record<Change['severity'], number> {
  return changes.reduce(
    (acc, c) => {
      acc[c.severity] += 1;
      return acc;
    },
    { error: 0, warning: 0, info: 0 },
  );
}

export function shouldFail(result: CheckResult, failOn: FailOn): boolean {
  if (failOn === 'never') return false;
  const counts = countBySeverity(result.changes);
  if (failOn === 'error') return counts.error > 0;
  return counts.error > 0 || counts.warning > 0;
}

function meetsThreshold(severity: Change['severity'], failOn: FailOn): boolean {
  if (failOn === 'never') return false;
  if (severity === 'error') return true;
  if (severity === 'warning' && failOn === 'warning') return true;
  return false;
}

export function renderReport(result: CheckResult, options: RenderOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(
      {
        baseVersion: result.baseVersion,
        headVersion: result.headVersion,
        summary: countBySeverity(result.changes),
        changes: result.changes,
        fail: shouldFail(result, options.failOn),
      },
      null,
      2,
    );
  }
  const counts = countBySeverity(result.changes);
  const lines: string[] = [];
  lines.push(
    `SpecGuard: ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} info`,
  );
  if (result.changes.length === 0) {
    lines.push('No changes detected.');
    return lines.join('\n') + '\n';
  }
  for (const c of result.changes) {
    const prefix = c.severity.toUpperCase().padEnd(7);
    const where = c.operationId ?? c.path ?? c.location ?? '';
    const loc = where ? ` (${where})` : '';
    lines.push(colorize(`${prefix} [${c.code}] ${c.message}${loc}`, c.severity));
  }
  return lines.join('\n') + '\n';
}

export function filterForDisplay(changes: Change[], failOn: FailOn): Change[] {
  return changes.filter((c) => meetsThreshold(c.severity, failOn) || c.severity === 'info');
}
