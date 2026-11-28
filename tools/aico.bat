@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
set "AICO_DEFAULT_MANAGEMENT_ROOT=management"

if defined AICO_MANAGEMENT_ROOT (
    set "MGMT_ROOT=%AICO_MANAGEMENT_ROOT%"
) else (
    set "MGMT_ROOT=%AICO_DEFAULT_MANAGEMENT_ROOT%"
)

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
set "LAUNCHER=%REPO_ROOT%\%MGMT_ROOT%\scripts\_launcher.py"

if not exist "%LAUNCHER%" (
    echo Error: AIco launcher not found: %LAUNCHER% 1>&2
    exit /b 1
)

(
    where uv >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        uv run "%LAUNCHER%" %*
        exit /b !ERRORLEVEL!
    )
    where py >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        py -3 "%LAUNCHER%" %*
        exit /b !ERRORLEVEL!
    )
    where python >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        python "%LAUNCHER%" %*
        exit /b !ERRORLEVEL!
    )
    echo Error: Neither 'uv' nor Python 3.11+ ^('py -3'/'python'^) was found in PATH. 1>&2
    echo Please install uv ^(https://docs.astral.sh/uv/^) or Python 3.11+. 1>&2
    exit /b 1
)
