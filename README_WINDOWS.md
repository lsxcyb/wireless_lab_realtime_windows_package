# Windows 可双击启动版

## 标准目录
- `start_server.bat`：双击启动，自动安装依赖并打开浏览器
- `start_server_noinstall.bat`：已装依赖时快速启动
- `start_server.sh`：Linux 启动脚本，自动创建 `.venv` 并安装依赖，支持后台管理
- `run_server.py`：程序化启动 Uvicorn，避免模块路径报错
- `requirements.txt`：依赖列表
- `server/app.py`：FastAPI + WebSocket 服务端
- `client/index.html`：学生端前端
- `client/teacher.html`：教师台前端

## 使用方法
1. 解压整个文件夹。
2. 双击 `start_server.bat`。
3. 浏览器默认会打开学生端；默认固定使用 `8765` 端口，如果该端口被占用会直接报错退出，不会自动切换。
4. 教师端使用启动日志中显示的 `/teacher` 地址，学生端使用启动日志中显示的 `/student` 地址。
5. 教师与学生填写同一个教室代号后即可自动联机。

## 跨设备使用
- 教师机运行服务后，教师台访问启动日志里打印的 `http://教师机IP:端口/teacher`。
- 学生机访问启动日志里打印的 `http://教师机IP:端口/student`。
- 页面中的服务器地址会自动使用当前访问地址生成 WebSocket 地址。

## 说明
- 这个部署版通过 `run_server.py` 直接导入 `server.app:app`，避免了 `uvicorn output.xxx:app` 这种模块路径错误。
- 如果学校电脑限制安装依赖，可先由管理员运行一次 `start_server.bat` 完成依赖安装，之后用 `start_server_noinstall.bat` 即可。
- Linux 环境建议使用 `./start_server.sh`，会自动选择最新可用的 `python3.x` 并在项目内创建虚拟环境。
- Linux 常用命令：
  - `./start_server.sh run`：前台运行
  - `./start_server.sh start`：后台运行
  - `./start_server.sh stop`：停止后台服务
  - `./start_server.sh status`：查看状态
  - `./start_server.sh logs`：查看日志


## 本次新增
- 学生端与教师台已拆分为两个独立页面。
- 设备拓扑已调整为电脑、无线路由器、光猫、分光器和学生平板。
- 光猫端口已改为 `LAN1`、`LAN2`、`LAN4`、`ITV` 和 `光口`。
- 学生端可将当前成绩与测试结果提交到教师台汇总表。
