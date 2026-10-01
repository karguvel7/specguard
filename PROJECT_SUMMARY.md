# SpecGuard project summary

## What was built

SpecGuard detects breaking changes between two OpenAPI 3.0 or 3.1 documents (JSON or YAML, file or URL).

- TypeScript library: `checkSpecs`, `diffDocuments`, `renderReport`, `shouldFail`
- CLI: `specguard check --base <path|url> --head <path|url> [--format text|json] [--fail-on error|warning|never]`
- Rules for removed paths and operations, removed response statuses, incompatible type changes, new required request fields and parameters, removed enum values, and tightened or loosened constraints. Request and response directions use opposite compatibility rules.
- Text and JSON reporters. Exit 1 when findings meet `--fail-on` (default `error`). Exit 2 for bad input.
- Fixtures in `fixtures/`, Vitest coverage, ESLint, GitHub Actions CI, composite `action.yml`, Dockerfile, docs site, MIT license.
- Repository: [https://github.com/karguvel7/specguard](https://github.com/karguvel7/specguard)
- Docs: [https://karguvel7.github.io/specguard/](https://karguvel7.github.io/specguard/)

## How to run

```bash
npm install
npm run build
node dist/cli.js check --base fixtures/base.openapi.yaml --head fixtures/head-breaking.openapi.yaml
node dist/cli.js check --base fixtures/base.openapi.yaml --head fixtures/head-compatible.openapi.yaml
```

The breaking pair exits 1. The compatible pair exits 0.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Portfolio value

- Finished developer tool: library contract, CLI exit codes, and the same checker behind a GitHub Action and Dockerfile.
- Explicit request vs response compatibility model, not a line diff of YAML.
- Fixture-driven tests for every major breaking rule, plus loader and CLI failure cases.
- Packaging: `bin`, `exports`, MIT license, lint, typecheck, test, build, GitHub Pages landing.
