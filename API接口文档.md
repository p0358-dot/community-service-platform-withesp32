# 社区服务平台 API 接口文档

## 📋 接口概览

**基础URL**: `http://localhost:3000/api` (本地开发) 或 `http://你的服务器IP:3000/api` (网络访问)

**认证方式**: 目前无需认证，所有接口公开访问

**响应格式**: 统一使用 JSON 格式

---

## 🔧 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 具体数据内容
  },
  "message": "操作成功",
  "timestamp": "2025-01-03T03:00:00.000Z"
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误类型",
  "message": "具体错误信息"
}
```

---

## 🤖 AI助手接口 (/api/ai)

### 1. 与AI对话
**接口**: `POST /api/ai/chat`

**功能**: 与AI助手进行对话，支持自然语言交互

**请求参数**:
```json
{
  "message": "你好，请介绍一下社区服务",  // 必需：用户消息
  "userId": 1,                          // 可选：用户ID，默认1
  "sessionId": "default",               // 可选：会话ID，默认"default"
  "history": []                         // 可选：历史对话记录
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "message": "您好！我是XX社区服务平台的AI助手，专门帮助居民解决社区相关问题...",
    "type": "chat",
    "action": null,
    "timestamp": "2025-01-03T03:00:00.000Z"
  }
}
```

**curl示例**:
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"预约乒乓球室明天下午2点","userId":1}'
```

### 2. 获取AI服务状态
**接口**: `GET /api/ai/status`

**功能**: 检查AI服务的运行状态

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "online",
    "provider": "阿里云DashScope",
    "timestamp": "2025-01-03T03:00:00.000Z"
  }
}
```

### 3. 获取聊天历史
**接口**: `GET /api/ai/history/:userId/:sessionId`

**功能**: 获取指定用户和会话的聊天历史

**路径参数**:
- `userId`: 用户ID
- `sessionId`: 会话ID

**查询参数**:
- `limit`: 限制返回条数，默认50

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "role": "user",
      "content": "你好",
      "timestamp": "2025-01-03T03:00:00.000Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "您好！我是AI助手...",
      "timestamp": "2025-01-03T03:00:01.000Z"
    }
  ]
}
```

### 4. 获取会话列表
**接口**: `GET /api/ai/sessions/:userId`

**功能**: 获取指定用户的所有会话列表

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "default",
      "lastMessage": "你好",
      "messageCount": 10,
      "lastActivity": "2025-01-03T03:00:00.000Z"
    }
  ]
}
```

### 5. 取消预约
**接口**: `POST /api/ai/cancel`

**功能**: 通过AI助手取消预约

**请求参数**:
```json
{
  "reservationId": 123,  // 必需：预约ID
  "userId": 1            // 可选：用户ID，默认1
}
```

### 6. 测试AI连接
**接口**: `GET /api/ai/test`

**功能**: 测试AI服务连接是否正常

**响应示例**:
```json
{
  "success": true,
  "data": {
    "testMessage": "你好，请简单介绍一下你自己",
    "response": "您好！我是XX社区服务平台的AI助手...",
    "timestamp": "2025-01-03T03:00:00.000Z"
  }
}
```

---

## 👥 用户管理接口 (/api/user)

### 1. 获取用户列表
**接口**: `GET /api/user/list`

**功能**: 获取所有用户列表

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "张三",
      "phone": "13800138000",
      "email": "zhangsan@example.com",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 2. 获取用户详情
**接口**: `GET /api/user/:id`

**功能**: 获取指定用户的详细信息

**路径参数**:
- `id`: 用户ID

---

## 🏢 场地管理接口 (/api/venue)

### 1. 获取场地列表
**接口**: `GET /api/venue/list`

**功能**: 获取所有可用场地列表

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "乒乓球室",
      "capacity": 4,
      "status": "available",
      "description": "标准乒乓球台，可容纳4人",
      "facilities": ["乒乓球台", "空调", "照明"]
    },
    {
      "id": 2,
      "name": "健身房",
      "capacity": 20,
      "status": "available",
      "description": "专业健身设备，24小时开放",
      "facilities": ["跑步机", "哑铃", "瑜伽垫"]
    }
  ]
}
```

### 2. 获取场地详情
**接口**: `GET /api/venue/:id`

**功能**: 获取指定场地的详细信息

### 3. 获取场地可用时间
**接口**: `GET /api/venue/:id/availability`

**功能**: 查询指定场地在特定日期的可用时间

**查询参数**:
- `date`: 查询日期 (YYYY-MM-DD格式)

---

## 📅 预约管理接口 (/api/reservation)

### 1. 创建预约
**接口**: `POST /api/reservation/create`

**功能**: 创建新的场地预约

**请求参数**:
```json
{
  "userId": 1,
  "venueId": 1,
  "date": "2025-01-04",
  "timeSlot": "14:00-16:00",
  "notes": "团队活动"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "userId": 1,
    "venueId": 1,
    "venueName": "乒乓球室",
    "date": "2025-01-04",
    "timeSlot": "14:00-16:00",
    "status": "pending",
    "notes": "团队活动",
    "createdAt": "2025-01-03T03:00:00.000Z"
  }
}
```

### 2. 获取用户预约列表
**接口**: `GET /api/reservation/user/:userId`

**功能**: 获取指定用户的所有预约记录

**查询参数**:
- `status`: 按状态筛选 (pending/confirmed/cancelled)
- `limit`: 限制返回条数

### 3. 获取场地预约记录
**接口**: `GET /api/reservation/venue/:venueId`

**功能**: 获取指定场地的预约记录

**查询参数**:
- `date`: 查询特定日期
- `status`: 按状态筛选

### 4. 更新预约状态
**接口**: `PUT /api/reservation/:id/status`

**功能**: 更新预约状态 (管理员功能)

**请求参数**:
```json
{
  "status": "confirmed",
  "notes": "预约已确认"
}
```

### 5. 取消预约
**接口**: `DELETE /api/reservation/:id`

**功能**: 取消指定预约

---

## 📱 设备管理接口 (/api/device)

### 1. 获取设备列表
**接口**: `GET /api/device/list`

**功能**: 获取所有设备及其状态

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "空调A",
      "type": "air_conditioner",
      "location": "乒乓球室",
      "status": "online",
      "lastCheck": "2025-01-03T03:00:00.000Z",
      "battery": 85,
      "temperature": 22.5
    }
  ]
}
```

### 2. 获取设备详情
**接口**: `GET /api/device/:id`

**功能**: 获取指定设备的详细信息

### 3. 更新设备状态
**接口**: `PUT /api/device/:id/status`

**功能**: 更新设备状态

**请求参数**:
```json
{
  "status": "online",
  "data": {
    "temperature": 23.0,
    "battery": 90
  }
}
```

---

## 🔧 维修服务接口 (/api/repair)

### 1. 提交维修申请
**接口**: `POST /api/repair/submit`

**功能**: 提交设备维修申请

**请求参数**:
```json
{
  "userId": 1,
  "deviceId": 1,
  "title": "空调不制冷",
  "description": "乒乓球室的空调制冷效果不好",
  "priority": "medium",
  "location": "乒乓球室"
}
```

### 2. 获取维修记录
**接口**: `GET /api/repair/list`

**功能**: 获取维修申请记录

**查询参数**:
- `status`: 按状态筛选
- `userId`: 按用户筛选

---

## 📢 通知公告接口 (/api/notice)

### 1. 获取公告列表
**接口**: `GET /api/notice/list`

**功能**: 获取所有公告列表

**查询参数**:
- `type`: 公告类型 (general/urgent/maintenance)
- `limit`: 限制返回条数

### 2. 获取公告详情
**接口**: `GET /api/notice/:id`

**功能**: 获取指定公告的详细内容

---

## 🛠️ 社区服务接口 (/api/service)

### 1. 获取服务列表
**接口**: `GET /api/service/list`

**功能**: 获取所有社区服务项目

**查询参数**:
- `status`: 按状态筛选 (active/inactive)

### 2. 获取活跃服务
**接口**: `GET /api/service/active`

**功能**: 获取当前可用的服务项目

---

## 📊 统计接口 (/api/statistics)

### 1. 获取总体统计
**接口**: `GET /api/statistics/overview`

**功能**: 获取平台总体统计数据

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "totalReservations": 1250,
    "activeVenues": 5,
    "totalDevices": 25,
    "onlineDevices": 23,
    "pendingRepairs": 3,
    "todayReservations": 15
  }
}
```

### 2. 获取预约统计
**接口**: `GET /api/statistics/reservations`

**功能**: 获取预约相关统计数据

**查询参数**:
- `period`: 统计周期 (day/week/month/year)

### 3. 获取设备统计
**接口**: `GET /api/statistics/devices`

**功能**: 获取设备状态统计数据

---

## 🏥 健康检查接口

### 1. 服务健康检查
**接口**: `GET /api/health`

**功能**: 检查服务整体健康状态

**响应示例**:
```json
{
  "status": "ok",
  "message": "社区服务平台后端运行正常",
  "timestamp": "2025-01-03T03:00:00.000Z"
}
```

---

## 🔧 ESP32设备调用示例

### Python示例
```python
import requests
import json

# 基础配置
BASE_URL = "http://192.168.1.58:3000/api"

def chat_with_ai(message):
    """与AI助手对话"""
    url = f"{BASE_URL}/ai/chat"
    data = {
        "message": message,
        "userId": 1,
        "sessionId": "esp32_device"
    }
    
    response = requests.post(url, json=data)
    if response.status_code == 200:
        result = response.json()
        return result['data']['message']
    else:
        return f"错误: {response.status_code}"

# 使用示例
ai_response = chat_with_ai("预约乒乓球室明天下午2点")
print(f"AI回复: {ai_response}")
```

### JavaScript示例
```javascript
const BASE_URL = "http://192.168.1.58:3000/api";

async function chatWithAI(message) {
    try {
        const response = await fetch(`${BASE_URL}/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                userId: 1,
                sessionId: 'web_client'
            })
        });
        
        const result = await response.json();
        return result.data.message;
    } catch (error) {
        return `连接失败: ${error.message}`;
    }
}

// 使用示例
chatWithAI("你好，请介绍一下社区服务").then(response => {
    console.log("AI回复:", response);
});
```

### Arduino/ESP32示例
```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

String chatWithAI(String message) {
    HTTPClient http;
    http.begin("http://192.168.1.58:3000/api/ai/chat");
    http.addHeader("Content-Type", "application/json");
    
    String jsonData = "{";
    jsonData += "\"message\":\"" + message + "\",";
    jsonData += "\"userId\":1,";
    jsonData += "\"sessionId\":\"esp32_" + String(random(10000)) + "\"";
    jsonData += "}";
    
    int httpResponseCode = http.POST(jsonData);
    
    if (httpResponseCode > 0) {
        String response = http.getString();
        DynamicJsonDocument doc(2048);
        deserializeJson(doc, response);
        
        if (doc["success"]) {
            return doc["data"]["message"];
        }
    }
    
    return "连接失败";
}
```

---

## ⚠️ 注意事项

1. **网络访问**: 确保服务器和客户端在同一网络或可互相访问
2. **请求频率**: 避免过于频繁的请求，建议间隔1秒以上
3. **超时设置**: 建议设置10-15秒的请求超时时间
4. **错误处理**: 始终检查响应状态码和success字段
5. **数据格式**: 所有POST请求必须使用JSON格式，Content-Type为application/json

---

## 🧪 测试工具

使用提供的测试脚本验证API连接：

```bash
python test_esp32_connection.py
```

该脚本会测试所有主要API接口的连接性和功能。

