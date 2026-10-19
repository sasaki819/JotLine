#!/usr/bin/env bash
# check-docs.sh - Check the consistency of ai-dev-standard documents in the project.
# Part of ai-dev-standard. Do not edit in the project; update ai-dev-standard and run sync.
#
# Usage: check-docs.sh
# Exit code: 0 = no problems, 1 = problems found (listed on stdout).
set -uo pipefail
export LC_ALL=C

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)

case "${1:-}" in
  "") ;;
  -h|--help) sed -n '2,6p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "check-docs: unknown argument: $1" >&2; exit 2 ;;
esac

ERRORS=0
err() {
  echo "ERROR [$1] $2"
  ERRORS=$((ERRORS + 1))
}

# Same parser as backlog-index.sh: frontmatter of $1 -> associative array FM.
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

# Print the body of $1 (everything after the frontmatter, or the whole file if there is none).
body_of() {
  local file=$1 line n=0 infm=0
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    n=$((n + 1))
    if [ $n -eq 1 ] && [ "$line" = "---" ]; then infm=1; continue; fi
    if [ $infm -eq 1 ]; then
      [ "$line" = "---" ] && infm=0
      continue
    fi
    printf '%s\n' "$line"
  done < "$file"
}

# Print "<lineno>" for each unchecked checkbox ("- [ ]") in the body of $1.
unchecked_lines() {
  local file=$1 line n=0 infm=0
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    n=$((n + 1))
    if [ $n -eq 1 ] && [ "$line" = "---" ]; then infm=1; continue; fi
    if [ $infm -eq 1 ]; then
      [ "$line" = "---" ] && infm=0
      continue
    fi
    [[ $line =~ ^[[:space:]]*[-*+][[:space:]]+\[[[:space:]]\] ]] && echo "$n"
  done < "$file"
}

# Print the Findings of review file $1 as "<id>US<status>US<response>" (US = \x1f).
# A Finding is a table row with at least 5 cells (ID | severity | finding | status | response)
# that is neither the header row ("ID") nor the separator row.
findings_of() {
  local line cells c i
  body_of "$1" | while IFS= read -r line; do
    line=${line#"${line%%[![:space:]]*}"}
    line=${line%"${line##*[![:space:]]}"}
    [[ $line == \|* ]] || continue
    line=${line//\\|/$'\x01'}
    line=${line#|}
    line=${line%|}
    # The extra "|" keeps a trailing empty cell (read drops one trailing empty field).
    IFS='|' read -r -a cells <<< "$line|"
    [ ${#cells[@]} -ge 5 ] || continue
    for i in "${!cells[@]}"; do
      c=${cells[$i]//$'\x01'/|}
      c=${c#"${c%%[![:space:]]*}"}
      c=${c%"${c##*[![:space:]]}"}
      cells[$i]=$c
    done
    [ "${cells[0]}" = "ID" ] && continue
    [[ ${cells[0]} =~ ^:?-+:?$ ]] && continue
    printf '%s\x1f%s\x1f%s\n' "${cells[0]}" "${cells[3]}" "${cells[4]}"
  done
}

# Print "<file>" for each existing file matching the glob $1 (relative to ROOT), sorted.
list_files() {
  local f
  for f in "$ROOT"/$1; do
    [ -f "$f" ] && printf '%s\n' "${f#"$ROOT"/}"
  done
}

# ---------------------------------------------------------------------------
# 1. Managed skills: .claude/skills and .agents/skills must be identical.
# ---------------------------------------------------------------------------
MANIFEST="$ROOT/tools/ai-standard/manifest.txt"
if [ ! -f "$MANIFEST" ]; then
  err skills "tools/ai-standard/manifest.txt not found"
else
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    case "$line" in ""|\#*) continue ;; esac
    path=${line%%[[:space:]]*}
    case "$path" in
      .claude/skills/*)
        other=".agents/skills/${path#.claude/skills/}"
        if [ ! -f "$ROOT/$path" ]; then
          err skills "$path is missing"
        elif [ ! -f "$ROOT/$other" ]; then
          err skills "$other is missing"
        elif ! cmp -s "$ROOT/$path" "$ROOT/$other"; then
          err skills "$other differs from $path (do not edit skills directly; run sync)"
        fi
        ;;
    esac
  done < "$MANIFEST"
fi

# ---------------------------------------------------------------------------
# 2. Item frontmatter: required fields, allowed values, unique IDs.
# 4. Items with status done: all tasks checked, no open/accepted Findings.
# ---------------------------------------------------------------------------
REQUIRED="id title status priority owner created spec discussions"
declare -A ID_FILES
ID_ORDER=()
DONE_ITEMS=()
DONE_SPECS=()
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  if ! parse_frontmatter "$ROOT/$rel"; then
    err items "$rel: frontmatter not found"
    continue
  fi
  for k in $REQUIRED; do
    [ -n "${FM[$k]+x}" ] || err items "$rel: missing field '$k'"
  done
  for k in id title status priority created; do
    if [ -n "${FM[$k]+x}" ] && [ -z "${FM[$k]}" ]; then
      err items "$rel: field '$k' is empty"
    fi
  done
  id=${FM[id]:-}
  if [ -n "$id" ]; then
    if [[ ! $id =~ ^[0-9]{4}$ ]]; then
      err items "$rel: invalid id '$id' (must be 4 digits)"
    fi
    if [ -z "${ID_FILES[$id]+x}" ]; then
      ID_ORDER+=("$id")
      ID_FILES[$id]=$rel
    else
      ID_FILES[$id]="${ID_FILES[$id]}, $rel"
    fi
  fi
  status=${FM[status]:-}
  case "$status" in
    ""|backlog|ready|in-progress|done|dropped) ;;
    *) err items "$rel: invalid status '$status' (allowed: backlog, ready, in-progress, done, dropped)" ;;
  esac
  priority=${FM[priority]:-}
  case "$priority" in
    ""|high|medium|low) ;;
    *) err items "$rel: invalid priority '$priority' (allowed: high, medium, low)" ;;
  esac
  if [ "$status" = "done" ]; then
    DONE_ITEMS+=("$rel")
    DONE_SPECS+=("${FM[spec]:-}")
  fi
done < <(list_files 'backlog/items/*.md'; list_files 'backlog/archive/*.md')

while IFS= read -r id; do
  [ -n "$id" ] || continue
  case "${ID_FILES[$id]}" in
    *", "*) err items "duplicate id $id: ${ID_FILES[$id]}" ;;
  esac
done < <(printf '%s\n' "${ID_ORDER[@]+"${ID_ORDER[@]}"}" | sort)

# ---------------------------------------------------------------------------
# 3. BACKLOG.md must be up to date.
# ---------------------------------------------------------------------------
if [ ! -f "$ROOT/BACKLOG.md" ]; then
  err backlog "BACKLOG.md not found (run tools/ai-standard/backlog-index)"
else
  TMP=$(mktemp)
  if bash "$HERE/backlog-index.sh" --output "$TMP"; then
    cmp -s "$TMP" "$ROOT/BACKLOG.md" || err backlog "BACKLOG.md is out of date (run tools/ai-standard/backlog-index; do not edit it by hand)"
  else
    err backlog "backlog-index failed"
  fi
  rm -f "$TMP"
fi

# ---------------------------------------------------------------------------
# 4. (continued) Done items.
# ---------------------------------------------------------------------------
for i in "${!DONE_ITEMS[@]}"; do
  rel=${DONE_ITEMS[$i]}
  spec=${DONE_SPECS[$i]}
  if [ -z "$spec" ]; then
    for n in $(unchecked_lines "$ROOT/$rel"); do
      err done "$rel line $n: unchecked task in a done item"
    done
    continue
  fi
  spec=${spec%/}
  if [ ! -d "$ROOT/$spec" ]; then
    err done "$rel: spec directory $spec/ not found"
    continue
  fi
  if [ ! -f "$ROOT/$spec/tasks.md" ]; then
    err done "$rel: $spec/tasks.md not found"
  else
    for n in $(unchecked_lines "$ROOT/$spec/tasks.md"); do
      err done "$spec/tasks.md line $n: unchecked task in a done item ($rel)"
    done
  fi
  while IFS= read -r review; do
    [ -n "$review" ] || continue
    while IFS=$'\x1f' read -r fid fstatus fresp; do
      case "$fstatus" in
        open|accepted) err done "$review: finding $fid is '$fstatus' in a done item ($rel)" ;;
      esac
    done < <(findings_of "$ROOT/$review")
  done < <(list_files "$spec/reviews/*.md")
done

# ---------------------------------------------------------------------------
# 5. AGENTS.md must not contain placeholders.
# ---------------------------------------------------------------------------
if [ ! -f "$ROOT/AGENTS.md" ]; then
  err agents "AGENTS.md not found"
else
  while IFS= read -r m; do
    [ -n "$m" ] || continue
    err agents "AGENTS.md line ${m%%:*}: placeholder ${m#*:} remains"
  done < <(grep -no '{{[^{}]*}}' "$ROOT/AGENTS.md")
fi

# ---------------------------------------------------------------------------
# 6. Findings with status wontfix must have a response (reason).
# ---------------------------------------------------------------------------
while IFS= read -r review; do
  [ -n "$review" ] || continue
  while IFS=$'\x1f' read -r fid fstatus fresp; do
    if [ "$fstatus" = "wontfix" ] && [ -z "$fresp" ]; then
      err reviews "$review: finding $fid is 'wontfix' but the response (reason) is empty"
    fi
  done < <(findings_of "$ROOT/$review")
done < <(list_files 'specs/*/reviews/*.md')

if [ $ERRORS -gt 0 ]; then
  echo "check-docs: $ERRORS problem(s) found."
  exit 1
fi
echo "check-docs: OK"
exit 0
