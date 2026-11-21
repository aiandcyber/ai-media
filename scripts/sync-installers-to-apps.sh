#!/usr/bin/env bash
# After Media Translate GitHub Actions publishes a release, copy installers into ai-forall-org/apps.
set -euo pipefail

TAG="${1:-app-v0.1.0}"
APPS_DIR="${APPS_DIR:-$HOME/ai-forall-download}"
OUT="$APPS_DIR/desktop/media-translate"
BASE="https://github.com/aiandcyber/media-translate/releases/download/${TAG}"

mkdir -p "$OUT"
cd "$OUT"

# Tauri names follow productName + version (spaces → dots).
FILES=(
  "Media.Translate_0.1.0_x64-setup.exe"
  "Media.Translate_0.1.0_aarch64.dmg"
)

echo "Downloading from $BASE ..."
for f in "${FILES[@]}"; do
  echo "  $f"
  curl -fL -o "$f" "$BASE/$f" || {
    echo "Failed: $f — list assets at https://github.com/aiandcyber/media-translate/releases/tag/$TAG" >&2
    exit 1
  }
done

rm -f .gitkeep
cd "$APPS_DIR"
git add desktop/media-translate
git status -sb
echo
echo "Next:"
echo "  cd $APPS_DIR && git commit -m 'Add Media Translate v0.1.0 installers' && git push"
