# backlog-index.ps1 - Generate BACKLOG.md from the frontmatter of backlog/items and backlog/archive.
# Part of ai-dev-standard. Do not edit in the project; update ai-dev-standard and run sync.
# PowerShell version of backlog-index.sh; both must produce the same output.
#
# Usage: backlog-index.ps1 [-Output <file>]
#   -Output <file>  write to <file> instead of <project>/BACKLOG.md (used by check-docs)
# This file must contain ASCII characters only (Windows PowerShell 5.1 compatibility).
param(
    [string]$Output = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

$Root = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($PSScriptRoot, '..', '..'))
if ($Output.Length -eq 0) { $Output = [System.IO.Path]::Combine($Root, 'BACKLOG.md') }
$Utf8 = New-Object System.Text.UTF8Encoding($false)
$Ws = "[ `t`n`v`f`r]"

function U([string]$s) { return [regex]::Unescape($s) }
# Ordinal string comparison (-eq / -ceq are culture-sensitive and ignore characters such as U+FEFF).
function Eq([string]$a, [string]$b) { return [string]::Equals($a, $b, [System.StringComparison]::Ordinal) }
$Ord = [System.StringComparison]::Ordinal

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

# Parse the frontmatter (same rules as backlog-index.sh). Returns $null if there is none.
function Read-Frontmatter([string]$path) {
    $lines = Get-Lines $path
    if ($lines.Count -eq 0 -or -not (Eq $lines[0] '---')) { return $null }
    $fm = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ((Eq $line '---')) { return ,$fm }
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
    if ($null -ne $fm -and $fm.ContainsKey($key)) { return $fm[$key] }
    return ''
}

function Get-StatusRank([string]$s) {
    if ((Eq $s 'in-progress')) { return '1' }
    if ((Eq $s 'ready')) { return '2' }
    if ((Eq $s 'backlog')) { return '3' }
    return '9'
}
function Get-PriorityRank([string]$s) {
    if ((Eq $s 'high')) { return '1' }
    if ((Eq $s 'medium')) { return '2' }
    if ((Eq $s 'low')) { return '3' }
    return '9'
}
function Format-Cell([string]$s) { return $s.Replace('|', '\|') }

# *.md files directly under $dir (relative to Root), sorted ordinally; dot files excluded.
function Get-MdFiles([string]$dir) {
    $full = [System.IO.Path]::Combine($Root, $dir)
    $names = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $full -PathType Container) {
        foreach ($f in Get-ChildItem -LiteralPath $full -File -Force) {
            if ($f.Name.EndsWith('.md', $Ord) -and -not $f.Name.StartsWith('.', $Ord)) { $names.Add($f.Name) }
        }
    }
    $arr = $names.ToArray()
    [Array]::Sort($arr, [StringComparer]::Ordinal)
    return ,$arr
}

$keys = New-Object System.Collections.Generic.List[string]
$rows = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
$doneCount = 0
$droppedCount = 0
foreach ($dir in @('backlog/items', 'backlog/archive')) {
    foreach ($name in (Get-MdFiles $dir)) {
        $rel = "$dir/$name"
        $fm = Read-Frontmatter ([System.IO.Path]::Combine($Root, $dir, $name))
        $status = Get-Field $fm 'status'
        if ((Eq $status 'done')) { $doneCount++; continue }
        if ((Eq $status 'dropped')) { $droppedCount++; continue }
        $id = Get-Field $fm 'id'
        $priority = Get-Field $fm 'priority'
        $spec = Get-Field $fm 'spec'
        $specCell = ''
        if ($spec.Length -gt 0) { $specCell = '[' + (Format-Cell $spec) + '](' + $spec + ')' }
        $idText = $id
        if ($idText.Length -eq 0) { $idText = '?' }
        $row = '| [' + (Format-Cell $idText) + '](' + $rel + ') | ' + (Format-Cell (Get-Field $fm 'title')) + ' | ' + (Format-Cell $status) + ' | ' + (Format-Cell $priority) + ' | ' + (Format-Cell (Get-Field $fm 'owner')) + ' | ' + $specCell + ' |'
        $key = (Get-StatusRank $status) + "`t" + (Get-PriorityRank $priority) + "`t" + $id + "`t" + $rel + "`t" + $row
        $keys.Add($key)
        $rows[$key] = $row
    }
}
$sorted = $keys.ToArray()
[Array]::Sort($sorted, [StringComparer]::Ordinal)

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append("# BACKLOG`n`n")
[void]$sb.Append((U '> **\u81ea\u52d5\u751f\u6210\u30fb\u624b\u7de8\u96c6\u7981\u6b62**\uff1a\u3053\u306e\u30d5\u30a1\u30a4\u30eb\u306f tools/ai-standard/backlog-index \u304c backlog/ \u306e Item \u304b\u3089\u751f\u6210\u3057\u307e\u3059\u3002Item \u3092\u5909\u66f4\u3057\u305f\u3089 backlog-index \u3092\u518d\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002') + "`n`n")
[void]$sb.Append(((U '## \u672a\u5b8c\u4e86\u306e Item\uff08{0} \u4ef6\uff09') -f $sorted.Length) + "`n`n")
if ($sorted.Length -eq 0) {
    [void]$sb.Append((U '\u672a\u5b8c\u4e86\u306e Item \u306f\u3042\u308a\u307e\u305b\u3093\u3002') + "`n")
} else {
    [void]$sb.Append((U '| ID | \u30bf\u30a4\u30c8\u30eb | status | priority | owner | Spec |') + "`n")
    [void]$sb.Append("|----|----------|--------|----------|-------|------|`n")
    foreach ($k in $sorted) { [void]$sb.Append($rows[$k] + "`n") }
}
[void]$sb.Append("`n" + (U '## \u5b8c\u4e86\u30fb\u4e2d\u6b62') + "`n`n")
[void]$sb.Append(((U '- done: {0} \u4ef6') -f $doneCount) + "`n")
[void]$sb.Append(((U '- dropped: {0} \u4ef6') -f $droppedCount) + "`n`n")
[void]$sb.Append((U '\u5b8c\u4e86\u30fb\u4e2d\u6b62\u306e Item \u306f [backlog/archive/](backlog/archive/) \u3092\u53c2\u7167\u3057\u3066\u304f\u3060\u3055\u3044\u3002') + "`n")

[System.IO.File]::WriteAllText($Output, $sb.ToString(), $Utf8)
