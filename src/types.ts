export type Severity = 'error' | 'warning' | 'info';

/** Request = client→server; response = server→client (compatibility rules differ). */
export type CompatMode = 'request' | 'response';

export interface Change {
  severity: Severity;
  code: string;
  message: string;
  operationId?: string;
  path?: string;
  method?: string;
  location?: string;
}

export interface CheckResult {
  changes: Change[];
  baseVersion?: string;
  headVersion?: string;
}

export interface CheckOptions {
  base: string;
  head: string;
}

export type FailOn = 'error' | 'warning' | 'never';
export type ReportFormat = 'text' | 'json';

export interface RenderOptions {
  format: ReportFormat;
  failOn: FailOn;
}

export type OpenAPIDocument = Record<string, unknown>;

export type HttpMethod =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'options'
  | 'head'
  | 'patch'
  | 'trace';

export const HTTP_METHODS: HttpMethod[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];
