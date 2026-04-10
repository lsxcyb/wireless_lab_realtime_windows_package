@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Python，请先安装 Python 3.10+ 并加入 PATH。
  pause
  exit /b 1
)

echo [info] 工作目录: %cd%
echo [info] 检查并安装依赖...
python -m pip install --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo [错误] 依赖安装失败，请先确认网络、pip 和 Python 环境可用。
  pause
  exit /b 1
)

echo [info] 预检查访问地址...
python scripts\print_access_urls.py
if errorlevel 1 (
  echo [warn] 无法预检查访问地址，启动后请以控制台输出的地址为准。
)

echo [info] 启动服务中...
python run_server.py
set EXITCODE=%ERRORLEVEL%

if "%EXITCODE%"=="0" (
  echo [info] 服务已退出。
) else (
  echo [错误] 服务异常退出，退出码: %EXITCODE%
)
pause
exit /b %EXITCODE%
