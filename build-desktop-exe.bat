@echo off
setlocal

rem Localogue Desktop bare EXE build script.
rem %~dp0 always points to this BAT's own directory, so whether you
rem double-click it from Explorer or call it from another folder,
rem all following commands run in the repository root.
cd /d "%~dp0"

echo [Localogue] Checking Node, pnpm, Rust and Cargo...
call pnpm desktop:doctor
if errorlevel 1 goto :failed

echo.
echo [Localogue] Running release config precheck...
call pnpm desktop:release:check
if errorlevel 1 goto :failed

echo.
echo [Localogue] Building Windows bare EXE (no installer)...
call pnpm --filter @localogue/desktop tauri build --no-bundle
if errorlevel 1 goto :failed

echo.
echo [Localogue] Build succeeded:
echo %~dp0apps\desktop\src-tauri\target\release\localogue-desktop.exe
goto :finished

:failed
echo.
echo [Localogue] Build failed. See the first error above; common causes are missing Rust or Microsoft C++ Build Tools.
exit /b 1

:finished
echo.
pause
endlocal
