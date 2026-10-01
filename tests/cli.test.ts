import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist/cli.js');

function run(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: root });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('cli', () => {
  it('exits 1 on breaking fixture', async () => {
    const { code, stdout } = await run([
      'check',
      '--base',
      'fixtures/base.openapi.yaml',
      '--head',
      'fixtures/head-breaking.openapi.yaml',
    ]);
    expect(code).toBe(1);
    expect(stdout).toContain('error');
  });

  it('exits 0 on compatible fixture', async () => {
    const { code } = await run([
      'check',
      '--base',
      'fixtures/base.openapi.yaml',
      '--head',
      'fixtures/head-compatible.openapi.yaml',
    ]);
    expect(code).toBe(0);
  });

  it('exits 2 on missing base', async () => {
    const { code, stderr } = await run([
      'check',
      '--base',
      'fixtures/missing.yaml',
      '--head',
      'fixtures/base.openapi.yaml',
    ]);
    expect(code).toBe(2);
    expect(stderr.length).toBeGreaterThan(0);
  });

  it('supports json format', async () => {
    const { code, stdout } = await run([
      'check',
      '--base',
      'fixtures/base.openapi.yaml',
      '--head',
      'fixtures/head-breaking.openapi.yaml',
      '--format',
      'json',
    ]);
    expect(code).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.summary).toBeDefined();
    expect(Array.isArray(parsed.changes)).toBe(true);
  });

  it('fail-on never exits 0', async () => {
    const { code } = await run([
      'check',
      '--base',
      'fixtures/base.openapi.yaml',
      '--head',
      'fixtures/head-breaking.openapi.yaml',
      '--fail-on',
      'never',
    ]);
    expect(code).toBe(0);
  });

  it('fail-on warning fails on compatible warnings', async () => {
    const { code } = await run([
      'check',
      '--base',
      'fixtures/base.openapi.yaml',
      '--head',
      'fixtures/head-compatible.openapi.yaml',
      '--fail-on',
      'warning',
    ]);
    expect(code).toBe(1);
  });
});
