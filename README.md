# 社区服务平台

## 项目结构

```
社区/
├── frontend/                 # 前端文件
│   ├── admin/               # 管理端
│   │   ├── index.html       # 管理系统主页
│   │   ├── script.js        # 管理系统脚本
│   │   └── styles.css       # 管理系统样式
│   └── user/                # 用户端
│       ├── index.html       # 用户系统主页
│       ├── script.js        # 用户系统脚本
│       └── styles.css       # 用户系统样式
├── backend/                 # 后端文件
│   ├── routes/              # API路由
│   │   ├── ai.js           # AI助手路由
│   │   ├── device.js       # 设备管理路由
│   │   ├── reservation.js  # 预约管理路由
│   │   ├── statistics.js   # 统计数据路由
│   │   ├── user.js         # 用户管理路由
│   │   └── venue.js        # 场地管理路由
│   ├── services/           # 业务服务
│   │   └── aiService.js    # AI服务
│   ├── database/           # 数据库相关
│   │   ├── community.db    # SQLite数据库文件
│   │   ├── db.js          # 数据库操作
│   │   └── init.js        # 数据库初始化
│   ├── config.js          # 配置文件
│   └── server.js          # 服务器入口
├── package.json           # 项目依赖配置
├── package-lock.json      # 依赖锁定文件
├── env.example           # 环境变量示例
└── README.md             # 项目说明文档
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动服务器
```bash
npm start
```

### 开发模式
```bash
npm run dev
```

## 访问地址

- 用户端：http://localhost:3000/user/
- 管理端：http://localhost:3000/admin/
- API接口：http://localhost:3000/api/
- 健康检查：http://localhost:3000/api/health

## API接口说明

### AI助手接口
- `POST /api/ai/chat` - 与AI对话
- `GET /api/ai/status` - 获取AI服务状态
- `GET /api/ai/test` - 测试AI连接

### 预约管理接口
- `POST /api/reservation/create` - 创建预约
- `GET /api/reservation/user/:userId` - 获取用户预约
- `GET /api/reservation/venue/:venueId` - 获取场地预约

### 场地管理接口
- `GET /api/venue/list` - 获取场地列表
- `GET /api/venue/:id` - 获取场地详情
- `GET /api/venue/:id/availability` - 查询可用时间

### 设备管理接口
- `GET /api/device/list` - 获取设备列表
- `PUT /api/device/:id/status` - 更新设备状态

### 统计接口
- `GET /api/statistics/overview` - 总体统计
- `GET /api/statistics/reservations` - 预约统计

**详细API文档**: 查看 `API接口文档.md` 文件

## 项目文档
- `docs/用户手册.md`：使用方法与常见问题
- `docs/作品应用场景.md`：应用场景与价值说明
- `docs/设计理念.md`：交互与架构设计取舍
- `docs/技术方案.md`：架构、模块、数据流与部署说明

## 功能模块

### 用户端功能
- AI智能助手对话
- 场地预约
- 个人信息管理
- 预约记录查看

### 管理端功能
- 用户管理
- 场地管理
- 设备监控
- 预约审核
- 数据统计
- 系统日志

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript (已优化)
- **后端**：Node.js + Express
- **数据库**：SQLite
- **AI服务**：阿里云DashScope API

## 开发说明

项目已重构为前后端分离的架构并完成代码优化：
- `frontend/` 目录包含所有前端文件
- `backend/` 目录包含所有后端文件
- 静态文件通过Express服务器提供服务
- API接口统一使用 `/api/` 前缀

## 性能优化

### 优化成果
- **总体文件大小**: 217.3KB → 98.7KB (**减少54.6%**)
- **JavaScript代码**: 大幅精简和优化
- **CSS样式**: 保留核心功能，删除冗余
- **删除冗余文件**: 12个不必要的文件
- **代码质量**: 移除调试代码，优化函数结构

### 具体优化
- ✅ 移除jQuery依赖，使用原生JavaScript
- ✅ 简化重复的功能函数，使用箭头函数
- ✅ 精简CSS样式，移除未使用的定义
- ✅ 清理重复代码和多余注释
- ✅ 移除所有console.log调试代码
- ✅ 删除重复和冗余文件
- ✅ 优化代码结构和可维护性
- ✅ 改进响应式设计

### 用户体验改进
- ✅ **页面内跳转** - 摒弃模态框，采用页面内容切换
- ✅ **直观导航** - 点击服务项目直接跳转到对应功能
- ✅ **返回按钮** - 每个功能页面都有返回主页按钮
- ✅ **完整流程** - 场地预约、AI助手等功能完整可用
- ✅ **实时交互** - 表单验证、数据加载、状态更新