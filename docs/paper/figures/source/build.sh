#!/usr/bin/env bash
# Build every figure: specs/*.json -> out/<id>.drawio, ERDs from schema, manual figures; then PNG (3x, editable diagram embedded).
set -e
cd "$(dirname "$0")"
D="$LOCALAPPDATA/Programs/draw.io/draw.io.exe"
SCALE="${SCALE:-3}"
mkdir -p out
for s in specs/Figure*.json; do
  python -I gen/gen.py flow "$s" "out/$(basename "$s" .json).drawio"
done
python -I gen/gen.py erd "${SCHEMA:-D:/Documents/Projects/thesis/supabase/schema_clean_install.sql}" t/erd-groups.json out
python -I gen/cycle.py "out/Iterative Development Model.drawio"
for f in out/*.drawio; do
  "$D" -x -f png -e -s "$SCALE" -b 12 -o "$(cygpath -w "$PWD/${f%.drawio}.png")" "$(cygpath -w "$PWD/$f")" >/dev/null 2>&1
done
ls out | wc -l
