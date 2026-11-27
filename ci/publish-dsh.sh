#!/usr/bin/env bash
# Runs after protected-main CI, with the verified tarball as its only input.
set -euo pipefail

archive=$(realpath "$1")
name=$(basename "$archive")
version=$(node -p "require('./apps/dsh-plugin/package.json').version")
tag="dsh-svg-editor-v$version"
test "$name" = "dsh-svg-editor-$version.tgz"
work=$(mktemp -d)
digest="$name.sha256"
(cd "$(dirname "$archive")" && sha256sum "$name") > "$work/$digest"
if git rev-parse --verify --quiet "$tag^{commit}" >/dev/null; then
  test "$(git rev-parse "$tag^{commit}")" = "$GITHUB_SHA"
fi

if ! gh release view "$tag" --json tagName > /dev/null; then
  gh release create "$tag" --draft --target "$GITHUB_SHA" --title "DSH SVG Editor $version" \
    --notes "Desktop SVG node and connector editing for DeepSeek Harness 0.2.2-rc.5. Download the archive and checksum below. See the [installation guide](https://github.com/$GITHUB_REPOSITORY/blob/$tag/apps/dsh-plugin/README.md)." --latest=false
fi
test "$(gh release view "$tag" --json targetCommitish --jq .targetCommitish)" = "$GITHUB_SHA"
assets=$(gh release view "$tag" --json assets --jq '.assets[].name')
for file in "$archive" "$work/$digest"; do
  if ! grep -Fxq "$(basename "$file")" <<<"$assets"; then
    gh release upload "$tag" "$file"
  fi
done

mkdir "$work/download"
gh release download "$tag" --pattern "$name" --pattern "$digest" --dir "$work/download"
cmp "$archive" "$work/download/$name"
cmp "$work/$digest" "$work/download/$digest"
if test "$(gh release view "$tag" --json isDraft --jq .isDraft)" = true; then
  gh release edit "$tag" --draft=false --latest=false
fi
