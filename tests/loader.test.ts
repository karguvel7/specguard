import { describe, expect, it } from 'vitest';
import { loadSpec, SpecLoadError } from '../src/loader.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('loader', () => {
  it('loads YAML fixture', async () => {
    const doc = await loadSpec(join(root, 'fixtures/base.openapi.yaml'));
    expect(doc.openapi).toBe('3.0.3');
  });

  it('throws for missing file', async () => {
    await expect(loadSpec('/no/such/spec.yaml')).rejects.toBeInstanceOf(SpecLoadError);
  });

  it('throws for invalid YAML', async () => {
    const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const dir = await mkdtemp(join(tmpdir(), 'specguard-'));
    const path = join(dir, 'bad.yaml');
    await writeFile(path, ':\n  bad yaml [[[', 'utf8');
    await expect(loadSpec(path)).rejects.toBeInstanceOf(SpecLoadError);
    await rm(dir, { recursive: true });
  });
});
