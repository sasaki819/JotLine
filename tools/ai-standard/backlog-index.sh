#!/usr/bin/env bash
# backlog-index.sh - Generate BACKLOG.md from the frontmatter of backlog/items and backlog/archive.
# Part of ai-dev-standard. Do not edit in the project; update ai-dev-standard and run sync.
#
# Usage: backlog-index.sh [--output FILE]
#   --output FILE  write to FILE instead of <project>/BACKLOG.md (used by check-docs)
set -euo pipefail
export LC_ALL=C

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
OUT="$ROOT/BACKLOG.md"

while [ $# -gt 0 ]; do
  case "$1" in
    --output)
      [ $# -ge 2 ] || { echo "backlog-index: --output requires a value" >&2; exit 2; }
      OUT=$2; shift 2 ;;
    -h|--help)
      sed -n '2,7p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)
      echo "backlog-index: unknown argument: $1" >&2; exit 2 ;;
  esac
done

# Parse the frontmatter of $1 into the associative array FM. Returns 1 if there is none.
# Values: "quoted" or 'quoted' -> inner text; [list] -> kept as is; otherwise a trailing
# " # comment" is removed. Leading and trailing blanks are trimmed.
declare -A FM
parse_frontmatter() {
  local file=$1 line n=0 key val
  FM=()
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    n=$((n + 1))
    if [ $n -eq 1 ]; then
      [ "$line" = "---" ] || return 1
      continue
    fi
    [ "$line" = "---" ] && return 0
    if [[ $line =~ ^([A-Za-z_][A-Za-z0-9_-]*):(.*)$ ]]; then
      key=${BASH_REMATCH[1]}
      val=${BASH_REMATCH[2]}
      val=${val#"${val%%[![:space:]]*}"}
      if [[ $val =~ ^\"([^\"]*)\" ]] || [[ $val =~ ^\'([^\']*)\' ]]; then
        val=${BASH_REMATCH[1]}
      elif [[ $val =~ ^(\[[^]]*\]) ]]; then
        val=${BASH_REMATCH[1]}
      else
        val=${val%%[[:space:]]#*}
        [[ $val == \#* ]] && val=""
        val=${val%"${val##*[![:space:]]}"}
      fi
      FM[$key]=$val
    fi
  done < "$file"
  return 1
}

status_rank() {
  case "$1" in in-progress) echo 1 ;; ready) echo 2 ;; backlog) echo 3 ;; *) echo 9 ;; esac
}
priority_rank() {
  case "$1" in high) echo 1 ;; medium) echo 2 ;; low) echo 3 ;; *) echo 9 ;; esac
}
cell() {
  local s=${1//|/\\|}
  printf '%s' "$s"
}

rows=()
done_count=0
dropped_count=0
for dir in backlog/items backlog/archive; do
  [ -d "$ROOT/$dir" ] || continue
  for f in "$ROOT/$dir"/*.md; do
    [ -f "$f" ] || continue
    rel="$dir/${f##*/}"
    if ! parse_frontmatter "$f"; then FM=(); fi
    status=${FM[status]:-}
    case "$status" in
      done) done_count=$((done_count + 1)); continue ;;
      dropped) dropped_count=$((dropped_count + 1)); continue ;;
    esac
    id=${FM[id]:-}
    priority=${FM[priority]:-}
    spec=${FM[spec]:-}
    speccell=""
    [ -n "$spec" ] && speccell="[$(cell "$spec")]($spec)"
    row="| [$(cell "${id:-?}")]($rel) | $(cell "${FM[title]:-}") | $(cell "$status") | $(cell "$priority") | $(cell "${FM[owner]:-}") | $speccell |"
    rows+=("$(status_rank "$status")"$'\t'"$(priority_rank "$priority")"$'\t'"$id"$'\t'"$rel"$'\t'"$row")
  done
done

{
  printf '# BACKLOG\n\n'
  printf '> **自動生成・手編集禁止**：このファイルは tools/ai-standard/backlog-index が backlog/ の Item から生成します。Item を変更したら backlog-index を再実行してください。\n\n'
  printf '## 未完了の Item（%d 件）\n\n' "${#rows[@]}"
  if [ ${#rows[@]} -eq 0 ]; then
    printf '未完了の Item はありません。\n'
  else
    printf '| ID | タイトル | status | priority | owner | Spec |\n'
    printf '|----|----------|--------|----------|-------|------|\n'
    printf '%s\n' "${rows[@]}" | sort | cut -f5-
  fi
  printf '\n## 完了・中止\n\n'
  printf -- '- done: %d 件\n' "$done_count"
  printf -- '- dropped: %d 件\n\n' "$dropped_count"
  printf '完了・中止の Item は [backlog/archive/](backlog/archive/) を参照してください。\n'
} > "$OUT.tmp.$$"
mv -f "$OUT.tmp.$$" "$OUT"
