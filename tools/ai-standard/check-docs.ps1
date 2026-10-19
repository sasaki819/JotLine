# check-docs.ps1 - Check the consistency of ai-dev-standard documents in the project.
# Part of ai-dev-standard. Do not edit in the project; update ai-dev-standard and run sync.
# PowerShell version of check-docs.sh; both must report the same problems and exit codes.
#
# Usage: check-docs.ps1
# Exit code: 0 = no problems, 1 = problems found (listed on stdout).
# This file must contain ASCII characters only (Windows PowerShell 5.1 compatibility).
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$Here = $PSScriptRoot
$Root = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Here, '..', '..'))
$Utf8 = New-Object System.Text.UTF8Encoding($false)
$Ord = [System.StringComparison]::Ordinal
$Ws = "[ `t`n`v`f`r]"

$script:Errors = 0
function Write-Problem([string]$check, [string]$message) {
    Write-Output "ERROR [$check] $message"
    $script:Errors++
}

# Ordinal string comparison (-eq / -ceq are culture-sensitive and ignore characters such as U+FEFF).
function Eq([string]$a, [string]$b) { return [string]::Equals($a, $b, $Ord) }

function Get-FullPath([string]$rel) { return [System.IO.Path]::Combine($Root, $rel) }

# Split text into lines like bash "read": LF separated, one trailing CR removed per line.
function Get-Lines([string]$path) {
    # GetString does not strip a BOM, matching bash (a BOM before "---" means no frontmatter).
    $text = $Utf8.GetString([System.IO.File]::ReadAllBytes($path))
    $parts = $text.Split([char]"`n")
    $n = $parts.Length
    if ($text.EndsWith("`n", $Ord)) { $n = $n - 1 }
    $lines = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $n; $i++) {
        $l = $parts[$i]
        if ($l.EndsWith("`r", $Ord)) { $l = $l.Substring(0, $l.Length - 1) }
        $lines.Add($l)
    }
    return ,$lines
}

# Same parser as backlog-index. Returns $null if there is no frontmatter.
function Read-Frontmatter([string]$path) {
    $lines = Get-Lines $path
    if ($lines.Count -eq 0 -or -not (Eq $lines[0] '---')) { return $null }
    $fm = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if (Eq $line '---') { return ,$fm }
        $m = [regex]::Match($line, '^([A-Za-z_][A-Za-z0-9_-]*):(.*)$')
        if (-not $m.Success) { continue }
        $key = $m.Groups[1].Value
        $val = [regex]::Replace($m.Groups[2].Value, "^$Ws+", '')
        $q = [regex]::Match($val, '^"([^"]*)"')
        if (-not $q.Success) { $q = [regex]::Match($val, "^'([^']*)'") }
        $l = [regex]::Match($val, '^(\[[^\]]*\])')
        if ($q.Success) {
            $val = $q.Groups[1].Value
        } elseif ($l.Success) {
            $val = $l.Groups[1].Value
        } else {
            $c = [regex]::Match($val, "$Ws#")
            if ($c.Success) { $val = $val.Substring(0, $c.Index) }
            if ($val.StartsWith('#', $Ord)) { $val = '' }
            $val = [regex]::Replace($val, "$Ws+$", '')
        }
        $fm[$key] = $val
    }
    return $null
}

function Get-Field($fm, [string]$key) {
    if ($fm.ContainsKey($key)) { return $fm[$key] }
    return ''
}

# Body lines as objects with Number (1-based line number in the file) and Text.
function Get-Body([string]$path) {
    $lines = Get-Lines $path
    $body = New-Object System.Collections.Generic.List[object]
    $inFm = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($i -eq 0 -and (Eq $line '---')) { $inFm = $true; continue }
        if ($inFm) {
            if (Eq $line '---') { $inFm = $false }
            continue
        }
        $body.Add((New-Object PSObject -Property @{ Number = $i + 1; Text = $line }))
    }
    return ,$body
}

# Line numbers of unchecked checkboxes ("- [ ]") in the body.
function Get-UncheckedLines([string]$path) {
    $result = New-Object System.Collections.Generic.List[int]
    foreach ($b in (Get-Body $path)) {
        if ([regex]::IsMatch($b.Text, "^$Ws*[-*+]$Ws+\[$Ws\]")) { $result.Add($b.Number) }
    }
    return ,$result
}

# Findings of a review file: table rows with at least 5 cells
# (ID | severity | finding | status | response) that are neither the header ("ID") nor the separator.
function Get-Findings([string]$path) {
    $result = New-Object System.Collections.Generic.List[object]
    foreach ($b in (Get-Body $path)) {
        $line = [regex]::Replace([regex]::Replace($b.Text, "^$Ws+", ''), "$Ws+$", '')
        if (-not $line.StartsWith('|', $Ord)) { continue }
        $line = $line.Replace('\|', [string][char]1)
        $line = $line.Substring(1)
        if ($line.EndsWith('|', $Ord)) { $line = $line.Substring(0, $line.Length - 1) }
        $cells = $line.Split([char]'|')
        if ($cells.Length -lt 5) { continue }
        for ($i = 0; $i -lt $cells.Length; $i++) {
            $c = $cells[$i].Replace([string][char]1, '|')
            $cells[$i] = [regex]::Replace([regex]::Replace($c, "^$Ws+", ''), "$Ws+$", '')
        }
        if (Eq $cells[0] 'ID') { continue }
        if ([regex]::IsMatch($cells[0], '^:?-+:?$')) { continue }
        $result.Add((New-Object PSObject -Property @{ Id = $cells[0]; Status = $cells[3]; Response = $cells[4] }))
    }
    return ,$result
}

# Files matching "<dir>/*.md" (dot files excluded), relative to Root, sorted ordinally.
function Get-MdFiles([string]$dir) {
    $names = New-Object System.Collections.Generic.List[string]
    $full = Get-FullPath $dir
    if (Test-Path -LiteralPath $full -PathType Container) {
        foreach ($f in Get-ChildItem -LiteralPath $full -File -Force) {
            if ($f.Name.EndsWith('.md', $Ord) -and -not $f.Name.StartsWith('.', $Ord)) { $names.Add("$dir/" + $f.Name) }
        }
    }
    $arr = $names.ToArray()
    [Array]::Sort($arr, [StringComparer]::Ordinal)
    return ,$arr
}

# Review files "specs/*/reviews/*.md", sorted ordinally by the whole path (like a bash glob).
function Get-AllReviewFiles {
    $all = New-Object System.Collections.Generic.List[string]
    $specs = Get-FullPath 'specs'
    if (Test-Path -LiteralPath $specs -PathType Container) {
        foreach ($d in Get-ChildItem -LiteralPath $specs -Directory -Force) {
            if ($d.Name.StartsWith('.', $Ord)) { continue }
            foreach ($r in (Get-MdFiles ('specs/' + $d.Name + '/reviews'))) { $all.Add($r) }
        }
    }
    $arr = $all.ToArray()
    [Array]::Sort($arr, [StringComparer]::Ordinal)
    return ,$arr
}

function Test-SameFile([string]$a, [string]$b) {
    $x = [System.IO.File]::ReadAllBytes($a)
    $y = [System.IO.File]::ReadAllBytes($b)
    if ($x.Length -ne $y.Length) { return $false }
    for ($i = 0; $i -lt $x.Length; $i++) { if ($x[$i] -ne $y[$i]) { return $false } }
    return $true
}

# ---------------------------------------------------------------------------
# 1. Managed skills: .claude/skills and .agents/skills must be identical.
# ---------------------------------------------------------------------------
$manifest = Get-FullPath 'tools/ai-standard/manifest.txt'
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
    Write-Problem 'skills' 'tools/ai-standard/manifest.txt not found'
} else {
    foreach ($line in (Get-Lines $manifest)) {
        if ($line.Length -eq 0 -or $line.StartsWith('#', $Ord)) { continue }
        $path = [regex]::Replace($line, "$Ws.*$", '')
        if (-not $path.StartsWith('.claude/skills/', $Ord)) { continue }
        $other = '.agents/skills/' + $path.Substring('.claude/skills/'.Length)
        if (-not (Test-Path -LiteralPath (Get-FullPath $path) -PathType Leaf)) {
            Write-Problem 'skills' "$path is missing"
        } elseif (-not (Test-Path -LiteralPath (Get-FullPath $other) -PathType Leaf)) {
            Write-Problem 'skills' "$other is missing"
        } elseif (-not (Test-SameFile (Get-FullPath $path) (Get-FullPath $other))) {
            Write-Problem 'skills' "$other differs from $path (do not edit skills directly; run sync)"
        }
    }
}

# ---------------------------------------------------------------------------
# 2. Item frontmatter: required fields, allowed values, unique IDs.
# 4. Items with status done: all tasks checked, no open/accepted Findings.
# ---------------------------------------------------------------------------
$required = @('id', 'title', 'status', 'priority', 'owner', 'created', 'spec', 'discussions')
$nonEmpty = @('id', 'title', 'status', 'priority', 'created')
$statuses = @('', 'backlog', 'ready', 'in-progress', 'done', 'dropped')
$priorities = @('', 'high', 'medium', 'low')
$idFiles = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
$idOrder = New-Object System.Collections.Generic.List[string]
$doneItems = New-Object System.Collections.Generic.List[object]

function Test-In([string]$value, $list) {
    foreach ($x in $list) { if (Eq $value $x) { return $true } }
    return $false
}

$itemFiles = New-Object System.Collections.Generic.List[string]
foreach ($f in (Get-MdFiles 'backlog/items')) { $itemFiles.Add($f) }
foreach ($f in (Get-MdFiles 'backlog/archive')) { $itemFiles.Add($f) }
foreach ($rel in $itemFiles) {
    $fm = Read-Frontmatter (Get-FullPath $rel)
    if ($null -eq $fm) {
        Write-Problem 'items' "${rel}: frontmatter not found"
        continue
    }
    foreach ($k in $required) {
        if (-not $fm.ContainsKey($k)) { Write-Problem 'items' "${rel}: missing field '$k'" }
    }
    foreach ($k in $nonEmpty) {
        if ($fm.ContainsKey($k) -and $fm[$k].Length -eq 0) { Write-Problem 'items' "${rel}: field '$k' is empty" }
    }
    $id = Get-Field $fm 'id'
    if ($id.Length -gt 0) {
        if (-not [regex]::IsMatch($id, '^[0-9]{4}$')) {
            Write-Problem 'items' "${rel}: invalid id '$id' (must be 4 digits)"
        }
        if (-not $idFiles.ContainsKey($id)) {
            $idOrder.Add($id)
            $idFiles[$id] = $rel
        } else {
            $idFiles[$id] = $idFiles[$id] + ', ' + $rel
        }
    }
    $status = Get-Field $fm 'status'
    if (-not (Test-In $status $statuses)) {
        Write-Problem 'items' "${rel}: invalid status '$status' (allowed: backlog, ready, in-progress, done, dropped)"
    }
    $priority = Get-Field $fm 'priority'
    if (-not (Test-In $priority $priorities)) {
        Write-Problem 'items' "${rel}: invalid priority '$priority' (allowed: high, medium, low)"
    }
    if (Eq $status 'done') {
        $doneItems.Add((New-Object PSObject -Property @{ Rel = $rel; Spec = (Get-Field $fm 'spec') }))
    }
}

$ids = $idOrder.ToArray()
[Array]::Sort($ids, [StringComparer]::Ordinal)
foreach ($id in $ids) {
    if ($idFiles[$id].Contains(', ')) { Write-Problem 'items' ("duplicate id ${id}: " + $idFiles[$id]) }
}

# ---------------------------------------------------------------------------
# 3. BACKLOG.md must be up to date.
# ---------------------------------------------------------------------------
$backlog = Get-FullPath 'BACKLOG.md'
if (-not (Test-Path -LiteralPath $backlog -PathType Leaf)) {
    Write-Problem 'backlog' 'BACKLOG.md not found (run tools/ai-standard/backlog-index)'
} else {
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        & ([System.IO.Path]::Combine($Here, 'backlog-index.ps1')) -Output $tmp
        if (-not (Test-SameFile $tmp $backlog)) {
            Write-Problem 'backlog' 'BACKLOG.md is out of date (run tools/ai-standard/backlog-index; do not edit it by hand)'
        }
    } catch {
        Write-Problem 'backlog' 'backlog-index failed'
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# 4. (continued) Done items.
# ---------------------------------------------------------------------------
foreach ($item in $doneItems) {
    $rel = $item.Rel
    $spec = $item.Spec
    if ($spec.Length -eq 0) {
        foreach ($n in (Get-UncheckedLines (Get-FullPath $rel))) {
            Write-Problem 'done' "$rel line ${n}: unchecked task in a done item"
        }
        continue
    }
    if ($spec.EndsWith('/', $Ord)) { $spec = $spec.Substring(0, $spec.Length - 1) }
    if (-not (Test-Path -LiteralPath (Get-FullPath $spec) -PathType Container)) {
        Write-Problem 'done' "${rel}: spec directory $spec/ not found"
        continue
    }
    $tasks = "$spec/tasks.md"
    if (-not (Test-Path -LiteralPath (Get-FullPath $tasks) -PathType Leaf)) {
        Write-Problem 'done' "${rel}: $tasks not found"
    } else {
        foreach ($n in (Get-UncheckedLines (Get-FullPath $tasks))) {
            Write-Problem 'done' "$tasks line ${n}: unchecked task in a done item ($rel)"
        }
    }
    foreach ($review in (Get-MdFiles "$spec/reviews")) {
        foreach ($f in (Get-Findings (Get-FullPath $review))) {
            if ((Eq $f.Status 'open') -or (Eq $f.Status 'accepted')) {
                Write-Problem 'done' ("${review}: finding " + $f.Id + " is '" + $f.Status + "' in a done item ($rel)")
            }
        }
    }
}

# ---------------------------------------------------------------------------
# 5. AGENTS.md must not contain placeholders.
# ---------------------------------------------------------------------------
$agents = Get-FullPath 'AGENTS.md'
if (-not (Test-Path -LiteralPath $agents -PathType Leaf)) {
    Write-Problem 'agents' 'AGENTS.md not found'
} else {
    $lines = Get-Lines $agents
    for ($i = 0; $i -lt $lines.Count; $i++) {
        foreach ($m in [regex]::Matches($lines[$i], '\{\{[^{}]*\}\}')) {
            Write-Problem 'agents' ("AGENTS.md line " + ($i + 1) + ": placeholder " + $m.Value + " remains")
        }
    }
}

# ---------------------------------------------------------------------------
# 6. Findings with status wontfix must have a response (reason).
# ---------------------------------------------------------------------------
foreach ($review in (Get-AllReviewFiles)) {
    foreach ($f in (Get-Findings (Get-FullPath $review))) {
        if ((Eq $f.Status 'wontfix') -and $f.Response.Length -eq 0) {
            Write-Problem 'reviews' ("${review}: finding " + $f.Id + " is 'wontfix' but the response (reason) is empty")
        }
    }
}

if ($script:Errors -gt 0) {
    Write-Output "check-docs: $($script:Errors) problem(s) found."
    exit 1
}
Write-Output 'check-docs: OK'
exit 0
