# SpecGuard

Detect OpenAPI breaking changes before you ship.

API teams ship removed paths, narrowed types, and new required fields without noticing. Clients break in production. SpecGuard diffs two OpenAPI 3.0 or 3.1 documents and fails the build when the change is unsafe.

It is a focused TypeScript library, a `specguard` CLI, and a composite GitHub Action. No service, database, or hosted account is required.

**Homepage:** [https://karguvel7.github.io/specguard/](https://karguvel7.github.io/specguard/)

## Problem

Reviewers cannot reliably eyeball an OpenAPI diff. A removed `400`, a `string` that became an `integer`, or a new required query parameter is easy to miss and expensive for every consumer of the API. SpecGuard turns that review into a deterministic check with a readable report and a non-zero exit code.

## Install

Requires Node.js 20 or newer.

```bash
git clone https://github.com/karguvel7/specguard.git
cd specguard
npm install
npm run build
npm test
```

Run the CLI from the build output:

```bash
node dist/cli.js check \
  --base fixtures/base.openapi.yaml \
  --head fixtures/head-breaking.openapi.yaml
```

After `npm link`, the `specguard` command is on your `PATH`. Once the package is published, `npx specguard check ...` works the same way.

Library usage:

```ts
import { checkSpecs, renderReport, shouldFail } from 'specguard';

const result = await checkSpecs({
  base: 'openapi/v1.yaml',
  head: 'openapi/v2.yaml',
});

process.stdout.write(renderReport(result, { format: 'text', failOn: 'error' }));
if (shouldFail(result, 'error')) process.exit(1);
```

## Usage

```bash
specguard check --base <path|url> --head <path|url> [--format text|json] [--fail-on error|warning|never]
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--base` | required | Previous spec. Filesystem path or `http(s)` URL. JSON or YAML. |
| `--head` | required | Candidate spec. |
| `--format` | `text` | `text` for humans, `json` for CI annotations and dashboards. |
| `--fail-on` | `error` | `error` fails on breaking changes. `warning` also fails on compatible changes. `never` always exits 0. |

Exit codes:

| Code | When |
| --- | --- |
| 0 | No findings at or above `--fail-on`. |
| 1 | Breaking changes, or warnings when `--fail-on warning`. |
| 2 | Missing file, bad YAML/JSON, unsupported OpenAPI version, or invalid flags. |

Try the fixtures:

```bash
node dist/cli.js check --base fixtures/base.openapi.yaml --head fixtures/head-breaking.openapi.yaml
node dist/cli.js check --base fixtures/base.openapi.yaml --head fixtures/head-compatible.openapi.yaml
node dist/cli.js check --base fixtures/base.openapi.yaml --head fixtures/head-breaking.openapi.yaml --format json
```

The breaking fixture exits 1. The compatible fixture exits 0 and prints warnings for additive changes.

### What counts as breaking

SpecGuard uses the usual client-compatibility rule:

- **Requests** (parameters and request bodies) may get *more* permissive. Narrowing what the server accepts is a break.
- **Responses** may get *more* restrictive. Widening what the server might send is a break.

| Change | Request | Response |
| --- | --- | --- |
| Removed path or operation | error | error |
| Removed response status | — | error |
| Type change such as `string` → `integer` | error | error |
| Type widened (`integer` → `number`, adding `null`) | warning | error |
| Type narrowed (`number` → `integer`) | error | warning |
| New required property or parameter | error | warning if a response field becomes required |
| Response property removed, or no longer required | warning if a request field is removed | error |
| Enum value removed | error | warning |
| Enum value added | warning | error |
| Tighter constraint (`maxLength` shrinks, new `pattern`, higher `minimum`) | error | warning |
| Looser constraint | warning | error |
| Added path, operation, or optional request field | warning | warning |

Shared component schemas are inlined via local `$ref` resolution before the diff. Removing a deprecated operation or a path whose operations are all deprecated is a warning instead of an error. Description and example edits are ignored. Local `$ref`s (including cycles) are resolved; external refs are rejected with a clear error.

`allOf` is merged for object composition before the diff. `oneOf` / `anyOf` length changes follow the same request/response rule. Replaced `pattern` or `format` values are errors in both directions because inclusion cannot be proved.

## CI

GitHub Actions workflow in this repo runs install, lint, typecheck, test, and build. A composite action is at [`action.yml`](action.yml):

```yaml
- uses: actions/checkout@v4
- name: OpenAPI breaking changes
  uses: ./
  with:
    base: fixtures/base.openapi.yaml
    head: fixtures/head-breaking.openapi.yaml
    fail-on: error
    format: text
```

Compare a pull request against the default branch without publishing the package:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- name: SpecGuard
  run: |
    git show origin/main:openapi.yaml > /tmp/base.openapi.yaml
    node dist/cli.js check --base /tmp/base.openapi.yaml --head openapi.yaml
```

Build the image and mount specs if you want the check in a container:

```bash
docker build -t specguard .
docker run --rm -v "$PWD:/specs:ro" specguard check \
  --base /specs/fixtures/base.openapi.yaml \
  --head /specs/fixtures/head-breaking.openapi.yaml
```

## Architecture

| Module | Role |
| --- | --- |
| `src/cli.ts` | Commander interface, exit codes |
| `src/loader.ts` | Files and URLs, size cap, JSON-compatible YAML parse |
| `src/normalize.ts` | Version check, `$ref` resolution, `allOf` merge |
| `src/detector.ts` | Public `checkSpecs` / `diffDocuments` |
| `src/rules/` | Paths, parameters, bodies, responses, schemas |
| `src/report.ts` | Text and JSON renderers, `shouldFail` |

Logging is quiet by default. Reports go to stdout and errors to stderr. Set `SPECGUARD_LOG=debug` to trace spec loads. `NO_COLOR` disables ANSI in text output. There is no config file and no secret. `.env` is not used.

## Scripts

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Vitest covers each breaking rule, both fixture pairs, loader failures, and CLI exit codes.

## License

MIT. See [LICENSE](LICENSE).
