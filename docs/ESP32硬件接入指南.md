# ESP32 硬件接入指南（语音入口 + 物联网控制）

> 说明：你新增的 `esp32/` 是一个基于 MCP 的语音交互硬件项目（通信协议与工具控制能力见 `esp32/docs/*`）。
> 本仓库当前的社区服务后端（`backend/`）主要提供 HTTP API 与 DashScope AI 对话接口，并不直接实现 WebSocket/MQTT/MCP 的“流式语音/工具回调”。
> 因此，本指南重点回答两件事：
> 1. ESP32 硬件端如何与“服务器/网关”通信（协议层）。
> 2. 如果你希望 ESP32 最终能控制本仓库的预约/报修/设备管理，后端需要怎样做映射（集成层）。

## 1. 一句话架构

ESP32 设备端先建立底层连接（`websocket` 或 `mqtt + udp`），再在会话中通过 `type: "mcp"` 消息进行工具调用。

当你要把“工具调用”落到本仓库业务时，需要一个“适配网关”把 MCP 的 `tools/call` 映射到本后端已有的 HTTP 接口（如 `/api/reservation/create`、`/api/repair/create`、`/api/device/...`）。

## 2. 通信方式选择

ESP32 端支持两种底层通信方式，详细内容来自 `esp32/docs/`：

### 2.1 WebSocket（推荐用于快速验证）

- 握手与鉴权（请求头）：`Authorization`（Bearer token）、`Protocol-Version`、`Device-Id`（网卡 MAC）、`Client-Id`（固件侧生成的 UUID）。
- 设备端会发送 `type: "hello"` JSON，字段关键点：
  - `transport: "websocket"`
  - `features: { "mcp": true }`（表示支持 MCP 工具）
  - `audio_params`（如 `format: opus`、`sample_rate`、`frame_duration`）
- 服务端回复 `type: "hello"` 且 `transport: "websocket"`，可选携带 `session_id`。
- 音频：通过二进制帧发送 Opus 编码数据。
- 业务控制：通过 JSON 消息发送/接收 `listen/abort/stt/tts/mcp/system/custom` 等消息类型。

协议细节：见 `esp32/docs/websocket.md`。

### 2.2 MQTT + UDP（更偏实时音频传输）

- MQTT：用于控制消息与 JSON 交换（hello/listen/tos 等）。
- UDP：用于实时音频数据传输（示例中使用 AES-CTR 加密、带序列号保护）。
- 典型流程：
  1. 设备通过 MQTT 连接并发 `type: "hello"`（`transport: "udp"`）
  2. 服务端回复 UDP 连接参数（`server/port/key/nonce`）
  3. 设备建立 UDP 音频通道并持续发送加密 Opus 包

协议细节：见 `esp32/docs/mqtt-udp.md`。

## 3. MCP（物联网控制）怎么用

ESP32 端作为 MCP “服务器”（提供工具），而你的“后台/网关”作为 MCP “客户端”进行发现与调用。

典型流程（来自 `esp32/docs/mcp-usage.md` 与 `esp32/docs/mcp-protocol.md`）：

1. 客户端发送 `initialize`
2. 客户端发送 `tools/list` 获取工具列表与参数 schema
3. 客户端发送 `tools/call` 调用指定工具（`name` + `arguments`）
4. 设备返回 `result`（成功）或 `error`（失败）

注意：MCP 消息会被封装在上面的底层协议中（WebSocket/MQTT）。

## 4. 把 ESP32 工具映射到本仓库后端

本仓库社区服务后端当前路由（节选）：

- 预约
  - `POST /api/reservation/create`：创建预约（请求体：`userId, venueId, date, timeSlot, notes?`）
  - `GET /api/reservation/available/:venueId/:date`：查询可用时间段
  - `DELETE /api/reservation/:id`：取消预约
- AI 取消预约（由 AI 服务层执行）
  - `POST /api/ai/cancel`：请求体：`reservationId, userId?`
- 报修
  - `POST /api/repair/create`：请求体：`title, description, user_id, venue_id, priority?`
- 设备管理（示例控制/状态）
  - `PUT /api/device/systems/air-conditioning`：请求体：`temperature?, mode?, fanSpeed?`
  - `PUT /api/device/systems/lighting`：请求体：`brightness?, mode?`
  - `PUT /api/device/rooms/:roomId/status`：请求体：`status`（open/closed）
  - `PUT /api/device/batch-control`：请求体：`action, devices: []`
  - `POST /api/device/emergency`：请求体：`action`（`shutdown`/`reset`）
- 对话（如果你把语音识别结果文本化后走 AI）
  - `POST /api/ai/chat`：请求体：`message, history?, userId?, sessionId?`

因此，当你实现“适配网关”时，可以采用如下映射策略：

- MCP `tools/call` 的 `name`（工具名） -> 对应 HTTP 接口
- MCP `arguments` -> 拼出 HTTP 请求体/参数（path/query/body）
- MCP 执行结果 -> 回填到 MCP 的 `result/content`，让设备侧继续后续流程

## 5. 目前的能力边界（必须明确）

从代码与现有文档看，本仓库后端并不直接承担以下职责：

- 不提供 WebSocket/MQTT 的底层会话处理（用于 Opus 流式上传/下发）。
- 不提供设备端 MCP 的客户端能力（`initialize/tools/list/tools/call` 这套流程）。

所以实际落地集成通常分两种路线：

1. 使用 ESP32 端默认/外部语音服务器（例如硬件项目 README 中提到的官方服务器）：ESP32 语音交互先跑通，工具控制再通过网关映射到本后端 HTTP API。
2. 自建“协议网关”（推荐做法更可控）：实现 MCP 客户端 + 音频会话（或对接现成语音服务器），再把 MCP 工具映射到本仓库业务 API。

## 6. 快速检查清单

在你开始联调前，建议先确认：

- 设备能否连到你的网关（WebSocket 可达 / MQTT broker 可达 / UDP 端口可达）。
- 你的网关是否能识别并返回 `hello`（并正确处理 `session_id`）。
- `tools/list` 返回的工具名与你网关里的映射表一致。
- 每个工具调用是否有明确的错误处理（例如预约冲突会被后端返回 400）。

