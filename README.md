![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![Express](https://img.shields.io/badge/Express-4.x-blue)
![SQLite](https://img.shields.io/badge/SQLite-3.x-lightgrey)
![ESP32](https://img.shields.io/badge/ESP32-MCP-red)

# 社区服务平台

一个支持 Web 端管理及 ESP32 硬件语音入口的社区服务管理系统。

## 核心亮点

- **软硬结合**：ESP32 基于小智AI开源项目实现语音交互，通过 MCP 协议与本项目后端 API 对接，支持设备端语音预约与查询。
- **AI 助手**：集成阿里云 DashScope（通义千问），实现自然语言意图识别（预约、查询、取消），自动完成场地匹配与冲突检测。
- **完整业务闭环**：包含用户端、管理端、预约审核、报修工单、通知公告等社区服务核心流程。
- **线上真实部署**：完整项目已部署于云 Linux 服务器，提供在线演示。

## 在线演示

- 用户端：http://180.76.177.247:3000/auth/login.html?role=user
- 管理端：http://180.76.177.247:3000/auth/login.html?role=admin
- 健康检查：http://180.76.177.247:3000/api/health

服务器配置：云 Linux 服务器，已配置服务保活。

## 功能概览

| 模块 | 核心功能 |
|------|----------|
| 用户端 | 场地查询/预约、AI 助手对话、报修提交、通知公告、便民服务、个人预约管理 |
| 管理端 | 场地/预约/用户/报修管理、设备监控、数据统计 |
| ESP32 硬件端 | 语音唤醒、对话交互，通过 MCP 工具调用后端 API 实现业务控制 |

## 技术栈

- 后端：Node.js + Express
- 前端：原生 HTML/CSS/JavaScript（已优化，总体积减少 54.6%）
- AI 服务：阿里云 DashScope API
- 数据库：SQLite（文件化持久化）
- 硬件方案：基于小智AI开源项目的 ESP32 固件，扩展自定义 MCP 工具集

## 系统架构与硬件接入

本项目核心在于打通语音硬件与业务系统的闭环。

**1. 语音入口**：ESP32 设备烧录小智AI固件，提供语音唤醒、ASR（语音识别）、LLM（大模型对话）和 TTS（语音合成）能力。

**2. 控制桥梁**：利用小智AI原生支持的 MCP（Model Context Protocol）协议，将语音指令解析为 `tools/call` 调用。

**3. 业务落地**：本项目作为 MCP 服务端，实现工具与后端 API 的映射：
   - `reservation.create` → `POST /api/reservation/create`（创建预约）
   - `device.query` → `GET /api/device/list`（查询设备）
   - `repair.create` → `POST /api/repair/create`（提交报修）

**硬件接入方案**：为 ESP32 烧录小智AI固件 → 配置本项目 API 网关地址 → 语音指令即可驱动社区业务。

## 项目结构
community-service-platform-withesp32/
├── frontend/ # 前端文件
│ ├── admin/ # 管理端
│ └── user/ # 用户端
├── backend/ # 后端文件
│ ├── routes/ # API路由
│ ├── services/ # 业务服务
│ └── database/ # 数据库相关
├── docs/ # 项目文档
├── mcp-communtiy/ # MCP协议相关
├── package.json
├── env.example
└── README.md

## 快速开始（本地运行）

**前提条件**：Node.js (v16+) 和 npm。

```bash
# 1. 克隆项目
git clone https://github.com/p0358-dot/community-service-platform-withesp32.git
cd community-service-platform-withesp32

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp env.example .env
# 编辑 .env 文件，填入你的 DASHSCOPE_API_KEY

# 4. 启动服务
npm start

# 开发模式（自动重启）
npm run dev
本地访问地址：

用户端：http://localhost:3000/user/

管理端：http://localhost:3000/admin/

API接口：http://localhost:3000/api/

健康检查：http://localhost:3000/api/health

API接口说明
AI助手接口
POST /api/ai/chat - 与AI对话

GET /api/ai/status - 获取AI服务状态

GET /api/ai/test - 测试AI连接

预约管理接口
POST /api/reservation/create - 创建预约

GET /api/reservation/user/:userId - 获取用户预约

GET /api/reservation/venue/:venueId - 获取场地预约

场地管理接口
GET /api/venue/list - 获取场地列表

GET /api/venue/:id - 获取场地详情

GET /api/venue/:id/availability - 查询可用时间

设备管理接口
GET /api/device/list - 获取设备列表

PUT /api/device/:id/status - 更新设备状态

详细API文档请查看 API接口文档.md 文件。

性能优化成果
文件总体积：217.3KB → 98.7KB（减少 54.6%）

代码重构：移除 jQuery 依赖，采用原生 JavaScript

用户体验：页面内切换、返回导航、实时表单验证

项目文档
docs/用户手册.md：使用方法与常见问题

docs/技术方案.md：架构、模块与数据流

docs/设计理念.md：交互与架构设计取舍

docs/作品应用场景.md：应用场景与价值说明

开发说明
项目采用前后端分离架构：

frontend/ 目录包含所有前端文件

backend/ 目录包含所有后端文件

静态文件通过 Express 服务器提供服务

API 接口统一使用 /api/ 前缀

开源协议
MIT License

致谢
    语音硬件方案基于 小智AI (xiaozhi-esp32) 开源项目(https://github.com/78/xiaozhi-esp32)

    AI 能力由阿里云 DashScope 提供