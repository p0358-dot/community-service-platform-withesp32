// 配置文件
module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'community_service'
  },

  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY || 'sk-5d7dd76c3e8545e9b798b3ea6dbc8a14',
    apiUrl: process.env.DASHSCOPE_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.DASHSCOPE_MODEL || 'qwen3-omni-flash',
    workspaceId: process.env.DASHSCOPE_WORKSPACE_ID || '',
    websocketUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'
  },

  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://'],
    credentials: true
  }
};
