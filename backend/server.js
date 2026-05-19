require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('./config');
const aiRoutes = require('./routes/ai');
const initDatabase = require('./database/init');

const app = express();

// 中间件
app.use(cors({
  origin: '*', // 允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// 前端入口路由
app.get('/', (req, res) => {
  res.redirect('/user/');
});

app.get('/user', (req, res) => {
  res.redirect('/user/');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/');
});

app.get('/login', (req, res) => {
  res.redirect('/auth/login.html');
});

// 路由
app.use('/api/ai', aiRoutes);
app.use('/api/user', require('./routes/user'));
app.use('/api/reservation', require('./routes/reservation'));
app.use('/api/venue', require('./routes/venue'));
app.use('/api/device', require('./routes/device'));
app.use('/api/statistics', require('./routes/statistics'));
app.use('/api/notice', require('./routes/notice'));
app.use('/api/repair', require('./routes/repair'));
app.use('/api/service', require('./routes/service'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: '社区服务平台后端运行正常',
    timestamp: new Date().toISOString()
  });
});

// 处理常见的浏览器请求，避免404错误
app.get('/favicon.ico', (req, res) => {
  res.status(204).send(); // No Content
});

app.get('/.well-known/*', (req, res) => {
  res.status(404).send(); // 明确返回404给开发者工具相关请求
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: err.message 
  });
});

// API 404处理 - 只处理API路径
app.use('/api', (req, res) => {
  res.status(404).json({ 
    error: '接口不存在',
    path: req.path 
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    // 启动HTTP服务器
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 社区服务平台后端启动成功！`);
      console.log(`📡 服务地址: http://localhost:${config.port}`);
      console.log(`🌍 环境: ${config.nodeEnv}`);
      console.log(`🤖 AI助手接口: http://localhost:${config.port}/api/ai`);
      console.log(`💾 数据库: MySQL (${config.mysql.host}:${config.mysql.port}/${config.mysql.database})`);
      console.log(`🔗 外部访问: http://10.8.214.253:${config.port}`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
