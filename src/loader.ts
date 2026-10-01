import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import yaml from 'js-yaml';
import { debug } from './log.js';
import type { OpenAPIDocument } from './types.js';

const MAX_BYTES = 10 * 1024 * 1024;

export class SpecLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpecLoadError';
  }
}

function parseContent(text: string, label: string): OpenAPIDocument {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new SpecLoadError(`${label}: empty file`);
  }
  try {
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as OpenAPIDocument;
    }
    return yaml.load(trimmed, { json: true }) as OpenAPIDocument;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new SpecLoadError(`${label}: invalid JSON or YAML (${msg})`);
  }
}

async function loadFromUrl(url: string): Promise<string> {
  debug('fetch', url);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new SpecLoadError(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new SpecLoadError(`Spec at ${url} exceeds ${MAX_BYTES} byte limit`);
  }
  return new TextDecoder().decode(buf);
}

export async function loadSpec(source: string): Promise<OpenAPIDocument> {
  const label = source;
  let text: string;
  if (/^https?:\/\//i.test(source)) {
    text = await loadFromUrl(source);
  } else {
    debug('read file', source);
    try {
      const buf = await readFile(source);
      if (buf.byteLength > MAX_BYTES) {
        throw new SpecLoadError(`${label}: exceeds ${MAX_BYTES} byte limit`);
      }
      text = buf.toString('utf8');
    } catch (e) {
      if (e instanceof SpecLoadError) throw e;
      throw new SpecLoadError(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const doc = parseContent(text, label);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new SpecLoadError(`${label}: root must be an object`);
  }
  return doc;
}

export function detectFormatFromPath(path: string): 'json' | 'yaml' {
  const ext = extname(path).toLowerCase();
  if (ext === '.json') return 'json';
  return 'yaml';
}
