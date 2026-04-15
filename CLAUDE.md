# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

无线网络实验室实时教学系统 - 一个基于 WebSocket 的师生互动网络拓扑实验平台。

**技术栈：**
- 后端：FastAPI + WebSocket (Python 3.x)
- 前端：原生 JavaScript (无框架依赖)
- 服务器：Uvicorn

## 常用命令

### 启动服务

```bash
# Windows (自动安装依赖)
start_server.bat

# Windows (已安装依赖)
start_server_noinstall.bat

# Linux/Mac (前台运行)
./start_server.sh run

# Linux/Mac (后台运行)
./start_server.sh start
./start_server.sh stop
./start_server.sh status
./start_server.sh logs

# 直接运行
python run_server.py
```

### 环境变量

```bash
# 自定义主机和端口
export WIRELESS_LAB_HOST=0.0.0.0
export WIRELESS_LAB_PORT=8765
```

### 测试

```bash
# 测试链接工具函数
node scripts/test_link_utils.js

# 检查客户端 HTML
python scripts/check_client_html.py
```

## 架构设计

### 双端分离架构

- **学生端** (`/student`): 拖放设备、连接端口、配置网络、提交实验结果
- **教师端** (`/teacher`): 实时查看学生提交、统计分析、导出数据

### 实时通信机制

**WebSocket 路由：** `/ws/{room}/{role}/{client_id}`

**消息类型：**
- `state_sync`: 全局状态同步（教师端发送，所有客户端接收）
- `board_update`: 教师端更新汇总表
- `board_submit`: 学生端提交实验结果
- `control`: 教师端控制指令
- `presence`: 客户端上线/离线通知
- `ping/pong`: 心跳检测

### 房间隔离机制

- 每个房间 (`room`) 维护独立状态：拓扑、配置、教师控制、学生提交板
- 默认房间：`classroom-101`
- 房间状态存储在内存中 (`rooms` 字典)

### 状态管理

**服务端状态结构** (`server/app.py:rooms`):
```python
{
  'topology': {'devices': [], 'links': []},
  'config': {},
  'teacher': {'mode': 'demo', 'fault': 'none', 'note': ''},
  'board': []  # 学生提交汇总
}
```

**学生端状态** (`client/assets/student-app.js:state`):
- `mode`: 当前操作模式 (place/link/config)
- `links`: 已连接的端口对
- `placedDeviceIds`: 已放置的设备 ID
- `config`: 网络配置
- `joined`: 是否已加入房间

**教师端状态** (`client/assets/teacher-app.js:state`):
- `board`: 学生提交结果数组
- `socket`: WebSocket 连接
- `room`: 当前房间代号

### 设备与链接规则

**设备定义** (`client/assets/lab-data.js:deviceBlueprints`):
- 电脑 (pc): NIC 端口
- 无线路由器 (router): WAN, LAN1, LAN2, WLAN 端口
- 光猫 (modem): LAN1, LAN2, LAN4, ITV, 光口
- 分光器 (splitter): PON 端口
- 学生平板 (tablet): WiFi 端口

**链接规则** (`client/assets/lab-data.js:linkGroups`):
- 必需连接：pc-router, router-modem, modem-splitter
- 可选连接：tablet-wlan
- 链接验证逻辑在 `client/assets/link-utils.js` 中实现

### 评分机制

学生端总分 100 分：
- 正确连接所有必需链接：45 分
- 完成网络配置：25 分
- 成功加入房间：15 分
- 测试通过：15 分

## 关键文件说明

### 服务端

- `run_server.py`: 启动入口，处理端口绑定和浏览器自动打开
- `server/app.py`: FastAPI 应用，WebSocket 处理，房间状态管理

### 客户端

- `client/index.html`: 学生端页面模板
- `client/teacher.html`: 教师端页面模板
- `client/home.html`: 首页（未使用）
- `client/assets/lab-data.js`: 设备蓝图、链接规则、网络配置定义
- `client/assets/link-utils.js`: 链接验证工具函数（UMD 模块）
- `client/assets/student-app.js`: 学生端交互逻辑（拖放、连接、配置、提交）
- `client/assets/teacher-app.js`: 教师端交互逻辑（汇总表、统计、导出）
- `client/assets/app.css`: 全局样式

### 脚本

- `scripts/test_link_utils.js`: Node.js 测试脚本，验证链接工具函数
- `scripts/check_client_html.py`: 检查客户端 HTML 文件
- `scripts/print_access_urls.py`: 打印访问地址

## 开发注意事项

### 前端开发

- **无框架依赖**：使用原生 JavaScript，避免引入 React/Vue 等框架
- **UMD 模块**：`lab-data.js` 和 `link-utils.js` 使用 UMD 模式，支持浏览器和 Node.js
- **不可变更新**：状态更新使用展开运算符，避免直接修改对象
- **DOM 操作**：使用 `document.getElementById` 简写为 `$` 函数

### WebSocket 通信

- **权限控制**：只有教师端可以发送 `state_sync` 和 `board_update`
- **自动重连**：客户端需实现 WebSocket 断线重连逻辑
- **消息格式**：所有消息必须包含 `type` 字段，`payload` 字段存放数据

### 状态同步

- **教师端主导**：教师端发送的 `state_sync` 会覆盖所有客户端状态
- **学生端提交**：学生端通过 `board_submit` 提交结果，服务端合并到 `board` 数组
- **合并策略**：相同 (班级, 小组, 姓名) 的提交会覆盖旧记录

### 端口配置

- **固定端口**：默认使用 8765，端口被占用时直接报错退出（不自动切换）
- **跨设备访问**：学生机访问教师机 IP + 端口，WebSocket 地址自动生成

### 测试

- 修改 `link-utils.js` 后运行 `node scripts/test_link_utils.js` 验证逻辑
- 测试跨设备连接时，确保防火墙允许 8765 端口

## 部署说明

- 这是 Windows 可双击启动版，适合学校机房部署
- 如果学校电脑限制安装依赖，管理员先运行 `start_server.bat` 完成依赖安装
- 后续使用 `start_server_noinstall.bat` 快速启动
- Linux 环境使用 `./start_server.sh` 自动创建虚拟环境
