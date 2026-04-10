from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
STUDENT_HTML_FILE = ROOT / "client" / "index.html"
TEACHER_HTML_FILE = ROOT / "client" / "teacher.html"
STUDENT_JS_FILE = ROOT / "client" / "assets" / "student-app.js"
TEACHER_JS_FILE = ROOT / "client" / "assets" / "teacher-app.js"
LAB_DATA_JS_FILE = ROOT / "client" / "assets" / "lab-data.js"
APP_CSS_FILE = ROOT / "client" / "assets" / "app.css"


def extract_script(html: str) -> str:
    match = re.search(r"<script>([\s\S]*)</script>", html, re.IGNORECASE)
    if not match:
        raise AssertionError("index.html does not contain an inline <script> block")
    return match.group(1)


def main() -> int:
    student_html = STUDENT_HTML_FILE.read_text(encoding="utf-8")
    teacher_html = TEACHER_HTML_FILE.read_text(encoding="utf-8")

    if 'id="dnsServer"' not in student_html and "id='dnsServer'" not in student_html:
        raise AssertionError("Missing dnsServer input element in client/index.html")

    if '/client/assets/app.css' not in student_html or '/client/assets/student-app.js' not in student_html:
        raise AssertionError("client/index.html does not reference external app.css/student-app.js assets")

    if '/client/assets/teacher-app.js' not in teacher_html:
        raise AssertionError("client/teacher.html does not reference external teacher-app.js asset")

    if '/client/assets/lab-data.js' not in student_html or '/client/assets/lab-data.js' not in teacher_html:
        raise AssertionError("student/teacher pages must reference shared lab-data.js")

    if "__ROUTE_ROLE__" not in student_html or "__AUTO_CONNECT__" not in student_html or "__DEFAULT_ROOM__" not in student_html:
        raise AssertionError("client/index.html is missing route bootstrap placeholders")

    if "https://pplx-res.cloudinary.com" in student_html or "https://upload.wikimedia.org" in student_html:
        raise AssertionError("client/index.html still references remote device images")

    if not STUDENT_JS_FILE.exists():
        raise AssertionError("client/assets/student-app.js does not exist")

    if not TEACHER_JS_FILE.exists():
        raise AssertionError("client/assets/teacher-app.js does not exist")

    if not LAB_DATA_JS_FILE.exists():
        raise AssertionError("client/assets/lab-data.js does not exist")

    if not APP_CSS_FILE.exists():
        raise AssertionError("client/assets/app.css does not exist")

    for script_file in (LAB_DATA_JS_FILE, STUDENT_JS_FILE, TEACHER_JS_FILE):
        script = script_file.read_text(encoding="utf-8")
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as temp:
            temp.write(script)
            temp_path = Path(temp.name)
        try:
            result = subprocess.run(
                ["node", "--check", str(temp_path)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            temp_path.unlink(missing_ok=True)
        if result.returncode != 0:
            message = (result.stdout + result.stderr).strip()
            raise AssertionError(f"Script syntax check failed for {script_file.name}:\n{message}")

    print("client/index.html checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
