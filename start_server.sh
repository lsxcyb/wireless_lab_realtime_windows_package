#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
PID_FILE="$SCRIPT_DIR/.server.pid"
LOG_FILE="$SCRIPT_DIR/.server.log"

PYTHON_BIN=""
for candidate in python3.14 python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [[ -z "$PYTHON_BIN" ]]; then
  echo "[错误] 未找到可用的 Python 3，请先安装 Python 3.10+。"
  exit 1
fi

echo "[info] 使用解释器: $PYTHON_BIN"
if ! "$PYTHON_BIN" -m pip --version >/dev/null 2>&1; then
  echo "[warn] 当前解释器未安装 pip，尝试自动修复..."
  if ! "$PYTHON_BIN" -m ensurepip --upgrade >/dev/null 2>&1; then
    echo "[错误] 无法为 $PYTHON_BIN 自动安装 pip。"
    echo "[提示] 如果你是 Debian/Ubuntu，可执行："
    echo "  apt update && apt install -y python3-pip python3-venv"
    echo "[提示] 如果你需要当前版本专用组件，也可尝试："
    echo "  apt install -y python3.12-venv"
    exit 1
  fi
fi

VENV_DIR="$SCRIPT_DIR/.venv"
if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  echo "[info] 创建虚拟环境: $VENV_DIR"
  if ! "$PYTHON_BIN" -m venv "$VENV_DIR"; then
    echo "[错误] 创建虚拟环境失败。"
    echo "[提示] 如果你是 Debian/Ubuntu，请先执行："
    echo "  apt update && apt install -y python3-venv"
    echo "[提示] 若使用 Python 3.12，也可补充："
    echo "  apt install -y python3.12-venv"
    exit 1
  fi
fi

echo "[info] 使用虚拟环境: $VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r requirements.txt

print_urls() {
  "$VENV_DIR/bin/python" scripts/print_access_urls.py
}

is_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

start_background() {
  if is_running; then
    echo "[warn] 服务已在运行，PID: $(cat "$PID_FILE")"
    return 0
  fi

  echo "[info] 后台启动服务..."
  nohup "$VENV_DIR/bin/python" run_server.py >"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" >"$PID_FILE"
  sleep 2

  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "[info] 后台启动成功，PID: $pid"
    echo "[info] 日志文件: $LOG_FILE"
    print_urls
  else
    echo "[错误] 后台启动失败，请检查日志: $LOG_FILE"
    rm -f "$PID_FILE"
    return 1
  fi
}

stop_background() {
  if ! is_running; then
    echo "[warn] 当前没有运行中的服务。"
    rm -f "$PID_FILE"
    return 0
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  echo "[info] 停止服务，PID: $pid"
  kill "$pid"
  rm -f "$PID_FILE"
}

show_status() {
  if is_running; then
    echo "[info] 服务运行中，PID: $(cat "$PID_FILE")"
    echo "[info] 日志文件: $LOG_FILE"
    print_urls
  else
    echo "[info] 服务未运行。"
  fi
}

MODE="${1:-run}"

case "$MODE" in
  run)
    print_urls
    exec "$VENV_DIR/bin/python" run_server.py
    ;;
  start)
    start_background
    ;;
  stop)
    stop_background
    ;;
  restart)
    stop_background || true
    start_background
    ;;
  status)
    show_status
    ;;
  logs)
    if [[ -f "$LOG_FILE" ]]; then
      tail -n 100 -f "$LOG_FILE"
    else
      echo "[warn] 日志文件不存在: $LOG_FILE"
    fi
    ;;
  *)
    echo "用法: ./start_server.sh [run|start|stop|restart|status|logs]"
    exit 1
    ;;
esac
