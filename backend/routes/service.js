const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 统一错误处理
const handleError = (res, error, message = '操作失败') => {
  console.error(message + ':', error);
  res.status(500).json({
    success: false,
    error: message,
    message: error.message
  });
};

// 统一成功响应
const successResponse = (res, data, message = '操作成功') => {
  res.json({
    success: true,
    data,
    message
  });
};

// 获取所有服务
router.get('/list', async (req, res) => {
  try {
    const { status } = req.query;
    let services = await db.getAllServices();
    
    // 过滤条件
    if (status) {
      services = services.filter(service => service.status === status);
    }
    
    successResponse(res, services);
  } catch (error) {
    handleError(res, error, '获取服务列表失败');
  }
});

// 获取活跃服务（用户端使用）
router.get('/active', async (req, res) => {
  try {
    const services = await db.getAllServices();
    const activeServices = services.filter(service => service.status === 'active');
    successResponse(res, activeServices);
  } catch (error) {
    handleError(res, error, '获取服务失败');
  }
});

// 获取服务详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const service = await db.getServiceById(id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: '服务不存在'
      });
    }
    
    successResponse(res, service);
  } catch (error) {
    handleError(res, error, '获取服务详情失败');
  }
});

// 创建服务
router.post('/create', async (req, res) => {
  try {
    const { name, provider, description, rating } = req.body;
    
    if (!name || !provider) {
      return res.status(400).json({
        success: false,
        error: '服务名称和提供商不能为空'
      });
    }
    
    const serviceId = await db.createService({
      name,
      provider,
      description: description || '',
      rating: rating || 0
    });
    
    successResponse(res, { id: serviceId }, '服务创建成功');
  } catch (error) {
    handleError(res, error, '创建服务失败');
  }
});

// 更新服务状态
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: '状态不能为空'
      });
    }
    
    await db.updateServiceStatus(id, status);
    successResponse(res, null, '服务状态更新成功');
  } catch (error) {
    handleError(res, error, '更新服务状态失败');
  }
});

module.exports = router;
