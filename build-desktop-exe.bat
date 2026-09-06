@echo off
setlocal

rem Localogue Desktop 裸 EXE 构建脚本。
rem %~dp0 永远代表这个 BAT 自己所在的目录，所以无论从资源管理器双击，
rem 还是从其它目录调用，后续命令都会在仓库根目录执行。
cd /d "%~dp0"

echo [Localogue] 正在检查 Node、pnpm、Rust 和 Cargo...
call pnpm desktop:doctor
if errorlevel 1 goto :failed

echo.
echo [Localogue] 正在执行发布配置预检...
call pnpm desktop:release:check
if errorlevel 1 goto :failed

echo.
echo [Localogue] 正在构建 Windows 裸 EXE，不生成安装程序...
call pnpm --filter @localogue/desktop tauri build --no-bundle
if errorlevel 1 goto :failed

echo.
echo [Localogue] 构建成功：
echo %~dp0apps\desktop\src-tauri\target\release\localogue-desktop.exe
goto :finished

:failed
echo.
echo [Localogue] 构建失败。请查看上方第一条错误；常见原因是缺少 Rust 或 Microsoft C++ Build Tools。
exit /b 1

:finished
echo.
pause
endlocal
