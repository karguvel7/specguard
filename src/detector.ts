import { loadSpec } from './loader.js';
import { assertOpenApiVersion, normalizeDocument } from './normalize.js';
import { diffRequestBodies } from './rules/bodies.js';
import { diffParameters } from './rules/parameters.js';
import { diffPaths } from './rules/paths.js';
import { diffResponses } from './rules/responses.js';
import type { Change, CheckOptions, CheckResult, OpenAPIDocument } from './types.js';

function sortChanges(changes: Change[]): Change[] {
  const order = { error: 0, warning: 1, info: 2 };
  return [...changes].sort((a, b) => {
    const s = order[a.severity] - order[b.severity];
    if (s !== 0) return s;
    return a.message.localeCompare(b.message);
  });
}

export function diffDocuments(
  base: OpenAPIDocument,
  head: OpenAPIDocument,
): Change[] {
  const baseNorm = normalizeDocument(base);
  const headNorm = normalizeDocument(head);
  const changes: Change[] = [];
  changes.push(...diffPaths(baseNorm, headNorm));
  changes.push(...diffParameters(baseNorm, headNorm));
  changes.push(...diffRequestBodies(baseNorm, headNorm));
  changes.push(...diffResponses(baseNorm, headNorm));
  return sortChanges(changes);
}

export async function checkSpecs(options: CheckOptions): Promise<CheckResult> {
  const baseRaw = await loadSpec(options.base);
  const headRaw = await loadSpec(options.head);
  const baseVersion = assertOpenApiVersion(baseRaw);
  const headVersion = assertOpenApiVersion(headRaw);
  const changes = diffDocuments(baseRaw, headRaw);
  if (baseVersion !== headVersion) {
    changes.push({
      severity: 'info',
      code: 'openapi-version-changed',
      message: `OpenAPI version changed from ${baseVersion} to ${headVersion}`,
    });
  }
  return { changes, baseVersion, headVersion };
}
