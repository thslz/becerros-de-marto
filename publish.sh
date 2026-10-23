#!/bin/bash
# Publica el juego en GitHub Pages (repo público thslz/becerros-de-marto).
# Clona el repo en una carpeta temporal, copia esta carpeta, commitea y pushea.
# La primera vez crea el repo y activa Pages.
#
# Uso: ./publish.sh ["mensaje del commit"]

set -euo pipefail

REPO="thslz/becerros-de-marto"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MSG="${1:-Actualiza el juego}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Creando $REPO ..."
  gh repo create "$REPO" --public --description "Los Becerros de Marto: atrapá los becerros y esquivá a Clown"
  FIRST=1
fi

gh repo clone "$REPO" "$TMP/site" -- --quiet 2>/dev/null || git init --quiet -b main "$TMP/site"
cd "$TMP/site"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$REPO.git"
# misma identidad que el repo de Alpaca (no hay una global configurada)
git config user.name "$(git -C "$DIR" config user.name || echo tobiasalvarez-bot)"
git config user.email "$(git -C "$DIR" config user.email || echo 278489183+tobiasalvarez-bot@users.noreply.github.com)"

rsync -a --delete --exclude '.git' --exclude '.DS_Store' "$DIR/" ./
touch .nojekyll
# versión en las URLs del código: así los celulares no se quedan con un game.js viejo guardado
STAMP="$(date +%s)"
sed -i '' -E "s#(src=\"(game|config)\.js)(\?v=[0-9]+)?\"#\1?v=$STAMP\"#g" index.html

git add -A
if git diff --cached --quiet; then
  echo "No hay cambios para publicar."
else
  git commit --quiet -m "$MSG" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  git push --quiet -u origin HEAD:main
fi

if [ "${FIRST:-0}" = 1 ] || ! gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  echo "Activando GitHub Pages ..."
  gh api -X POST "repos/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null
fi

echo "Listo: https://${REPO%%/*}.github.io/${REPO#*/}/"
