import { describe, expect, it } from 'vitest';
import { renderReport, shouldFail } from '../src/report.js';
import type { CheckResult } from '../src/types.js';

const sample: CheckResult = {
  changes: [
    { severity: 'error', code: 'x', message: 'err' },
    { severity: 'warning', code: 'y', message: 'warn' },
  ],
  baseVersion: '3.0.3',
  headVersion: '3.0.3',
};

describe('report', () => {
  it('shouldFail on error by default', () => {
    expect(shouldFail(sample, 'error')).toBe(true);
    expect(shouldFail(sample, 'never')).toBe(false);
  });

  it('renders json', () => {
    const out = renderReport(sample, { format: 'json', failOn: 'error' });
    expect(JSON.parse(out).summary.error).toBe(1);
  });

  it('renders text', () => {
    const out = renderReport(sample, { format: 'text', failOn: 'error' });
    expect(out).toContain('1 error');
  });

  it('shouldFail on warning threshold', () => {
    expect(shouldFail(sample, 'warning')).toBe(true);
    expect(shouldFail({ changes: [{ severity: 'warning', code: 'w', message: 'w' }] }, 'error')).toBe(
      false,
    );
  });

  it('empty result text report', () => {
    const out = renderReport({ changes: [] }, { format: 'text', failOn: 'error' });
    expect(out).toContain('No changes');
  });
});
