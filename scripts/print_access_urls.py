from __future__ import annotations

import socket
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))
import run_server


def get_local_ipv4_addresses() -> list[str]:
    addresses: set[str] = set()
    try:
        for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = item[4][0]
            if not ip.startswith("127."):
                addresses.add(ip)
    except OSError:
        return []
    return sorted(addresses)


def main() -> None:
    print(f"[info] 学生端(本机): http://127.0.0.1:{run_server.PORT}/student")
    print(f"[info] 教师端(本机): http://127.0.0.1:{run_server.PORT}/teacher")
    for ip in get_local_ipv4_addresses():
        print(f"[info] 学生端(局域网): http://{ip}:{run_server.PORT}/student")
        print(f"[info] 教师端(局域网): http://{ip}:{run_server.PORT}/teacher")


if __name__ == "__main__":
    main()
