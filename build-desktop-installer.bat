@echo off
setlocal

rem Localogue Desktop Windows installer build script.
rem This script builds the app EXE and an NSIS installer. On the first run,
rem Tauri may download the NSIS build tools over the network; once downloaded
rem they are cached locally, so later builds are usually faster.
cd /d "%~dp0"

echo [Localogue] Checking Node, pnpm, Rust and Cargo...
call pnpm desktop:doctor
if errorlevel 1 goto :failed

echo.
echo [Localogue] Building Release EXE and NSIS installer...
call pnpm desktop:build
if errorlevel 1 goto :failed

echo.
echo [Localogue] Build succeeded. Installer is at:
echo %~dp0apps\desktop\src-tauri\target\release\bundle\nsis\
goto :finished

:failed
echo.
echo [Localogue] Build failed. See the first error above; if it stops at "Downloading", the NSIS first-time download usually timed out, just run again.
exit /b 1

:finished
echo.
pause
endlocal
