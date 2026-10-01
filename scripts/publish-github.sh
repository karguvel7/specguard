#!/usr/bin/env bash
set -euo pipefail
# Optional helper: push tags and create a GitHub release after npm publish.
REPO="https://github.com/karguvel7/specguard"
VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>" >&2
  exit 1
fi
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"
gh release create "v${VERSION}" --repo karguvel7/specguard --generate-notes
echo "Release created for ${REPO}/releases/tag/v${VERSION}"
