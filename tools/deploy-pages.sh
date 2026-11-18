#!/bin/bash
# 發佈網站版到 GitHub Pages：https://ericckfeng.github.io/ziwei-study-pack/
# 網站版放在本倉庫的 gh-pages 分支（每次整個覆蓋，不留歷史），main 分支只放原始碼。
# 2026-11-18 起取代舊做法（複製到 ../ericckfeng.github.io/ziwei-study-pack）；個人網站倉庫不再放研習包。
set -e
cd "$(dirname "$0")/.."
ROOT="$PWD"
URL="$(git remote get-url origin)"
npm run build

# 暫存資料夾放在 dist/ 裡（已被 .gitignore 排除），git 身分才會自動套用
OUT="$ROOT/dist/gh-pages"
rm -rf "$OUT"
mkdir -p "$OUT"
cp -R "$ROOT/dist/site/." "$OUT/"
touch "$OUT/.nojekyll"
printf '這個分支是自動產生的網站版（npm run deploy），不要手動修改。原始碼在 main 分支。\n' > "$OUT/DEPLOY.txt"

cd "$OUT"
git init -q -b gh-pages
git add -A
git commit -qm "deploy: $(date '+%Y-%m-%d %H:%M') from $(git -C "$ROOT" rev-parse --short HEAD)"
git push -qf "$URL" gh-pages
cd "$ROOT" && rm -rf "$OUT"
echo "已發佈，約 1 分鐘後更新：https://ericckfeng.github.io/ziwei-study-pack/"
