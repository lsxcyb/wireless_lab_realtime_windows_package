from pathlib import Path
import threading
import webbrowser
import uvicorn
import sys
import os
import socket

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
from server.app import app

HOST = os.environ.get('WIRELESS_LAB_HOST', '0.0.0.0')
PREFERRED_PORT = int(os.environ.get('WIRELESS_LAB_PORT', '8765'))


def can_bind(host: str, port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((host, port))
        return True
    except OSError:
        return False

PORT = PREFERRED_PORT
DISPLAY_HOST = '127.0.0.1' if HOST == '0.0.0.0' else HOST
URL = f'http://{DISPLAY_HOST}:{PORT}/student'


def open_browser():
    webbrowser.open(URL, new=2)


if __name__ == '__main__':
    if not can_bind(HOST, PORT):
        print(f'[error] Port {PORT} is unavailable on host {HOST}.')
        print(f'[hint] Close the process using {PORT}, or set WIRELESS_LAB_PORT to another fixed port and restart.')
        raise SystemExit(1)
    print(f'[info] Open student page: http://{DISPLAY_HOST}:{PORT}/student')
    print(f'[info] Open teacher page: http://{DISPLAY_HOST}:{PORT}/teacher')
    # Headless Linux servers often cannot launch a browser.
    if os.name == 'nt' or os.environ.get('DISPLAY') or os.environ.get('WAYLAND_DISPLAY'):
        threading.Timer(1.2, open_browser).start()
    uvicorn.run(app, host=HOST, port=PORT, reload=False)
