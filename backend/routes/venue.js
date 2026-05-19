const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 统一错误处理
const handleError = (res, error, message) => {
  console.error(message, error);
  res.status(500).json({
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

// 获取所有场地
router.get('/list', async (req, res) => {
  try {
    const venues = await db.getAllVenues();
    successResponse(res, venues);
  } catch (error) {
    handleError(res, error, '获取场地列表失败');
  }
});

// 获取场地详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await db.getVenueById(id);
    
    if (!venue) {
      return res.status(404).json({
        error: '场地不存在'
      });
    }
    
    successResponse(res, venue);
  } catch (error) {
    handleError(res, error, '获取场地详情失败');
  }
});

// 创建新场地
router.post('/create', async (req, res) => {
  try {
    const { name, type, capacity, location, description, status } = req.body;
    
    if (!name || !type || !capacity || !location) {
      return res.status(400).json({
        error: '场地名称、类型、容量、位置不能为空'
      });
    }
    
    const venueData = {
      name,
      type,
      capacity: parseInt(capacity),
      location,
      description: description || '',
      status: status || 'available'
    };
    
    const venueId = await db.createVenue(venueData);
    successResponse(res, { id: venueId }, '场地创建成功');
  } catch (error) {
    handleError(res, error, '创建场地失败');
  }
});

// 更新场地状态
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        error: '状态不能为空'
      });
    }
    
    await db.updateVenueStatus(id, status);
    
    res.json({
      success: true,
      data: {
        message: '场地状态更新成功'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '更新场地状态失败',
      message: error.message
    });
  }
});

// 更新场地信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, capacity, location, description, status } = req.body;
    
    if (!name || !type || !capacity || !location) {
      return res.status(400).json({
        error: '场地名称、类型、容量、位置不能为空'
      });
    }
    
    const venueData = {
      name,
      type,
      capacity: parseInt(capacity),
      location,
      description: description || '',
      status: status || 'available'
    };
    
    await db.updateVenue(id, venueData);
    
    res.json({
      success: true,
      data: {
        message: '场地信息更新成功'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '更新场地信息失败',
      message: error.message
    });
  }
});

// 删除场地
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.deleteVenue(id);
    
    res.json({
      success: true,
      data: {
        message: '场地删除成功'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '删除场地失败',
      message: error.message
    });
  }
});

module.exports = router;
