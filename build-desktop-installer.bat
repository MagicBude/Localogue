@echo off
setlocal

rem Localogue Desktop Windows 安装程序构建脚本。
rem 此脚本会生成应用 EXE 和 NSIS 安装器。第一次运行时，Tauri 可能联网下载
rem NSIS 构建工具；下载完成后会保存在本机缓存，后续构建通常会更快。
cd /d "%~dp0"

echo [Localogue] 正在检查 Node、pnpm、Rust 和 Cargo...
call pnpm desktop:doctor
if errorlevel 1 goto :failed

echo.
echo [Localogue] 正在构建 Release EXE 与 NSIS 安装程序...
call pnpm desktop:build
if errorlevel 1 goto :failed

echo.
echo [Localogue] 构建成功。安装程序位于：
echo %~dp0apps\desktop\src-tauri\target\release\bundle\nsis\
goto :finished

:failed
echo.
echo [Localogue] 构建失败。请查看上方第一条错误；如果停在 Downloading，通常是 NSIS 首次下载超时，可再次运行。
exit /b 1

:finished
echo.
pause
endlocal
