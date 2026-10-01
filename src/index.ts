export { checkSpecs, diffDocuments } from './detector.js';
export { loadSpec, SpecLoadError } from './loader.js';
export { normalizeDocument, assertOpenApiVersion } from './normalize.js';
export { renderReport, shouldFail, countBySeverity } from './report.js';
export type {
  Change,
  CheckOptions,
  CheckResult,
  FailOn,
  ReportFormat,
  Severity,
  CompatMode,
} from './types.js';
