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

// 获取所有报修记录
router.get('/list', async (req, res) => {
  try {
    const { status, priority, user_id } = req.query;
    let repairs = await db.getAllRepairs();
    
    // 过滤条件
    if (status) {
      repairs = repairs.filter(repair => repair.status === status);
    }
    
    if (priority) {
      repairs = repairs.filter(repair => repair.priority === priority);
    }
    
    if (user_id) {
      repairs = repairs.filter(repair => repair.user_id === parseInt(user_id));
    }
    
    // 关联用户和场地信息
    const users = await db.getAllUsers();
    const venues = await db.getAllVenues();
    
    const repairsWithDetails = repairs.map(repair => {
      const user = users.find(u => u.id === repair.user_id);
      const venue = venues.find(v => v.id === repair.venue_id);
      
      return {
        ...repair,
        user_name: user ? user.name : '未知用户',
        venue_name: venue ? venue.name : '未知场地'
      };
    });
    
    successResponse(res, repairsWithDetails);
  } catch (error) {
    handleError(res, error, '获取报修列表失败');
  }
});

// 获取用户的报修记录
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const repairs = await db.getAllRepairs();
    const userRepairs = repairs.filter(repair => repair.user_id === parseInt(userId));
    
    // 关联场地信息
    const venues = await db.getAllVenues();
    const repairsWithVenue = userRepairs.map(repair => {
      const venue = venues.find(v => v.id === repair.venue_id);
      return {
        ...repair,
        venue_name: venue ? venue.name : '未知场地'
      };
    });
    
    successResponse(res, repairsWithVenue);
  } catch (error) {
    handleError(res, error, '获取用户报修记录失败');
  }
});

// 获取报修详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const repair = await db.getRepairById(id);
    
    if (!repair) {
      return res.status(404).json({
        success: false,
        error: '报修记录不存在'
      });
    }
    
    // 获取关联信息
    const user = await db.getUserById(repair.user_id);
    const venue = await db.getVenueById(repair.venue_id);
    
    const repairWithDetails = {
      ...repair,
      user_name: user ? user.name : '未知用户',
      venue_name: venue ? venue.name : '未知场地'
    };
    
    successResponse(res, repairWithDetails);
  } catch (error) {
    handleError(res, error, '获取报修详情失败');
  }
});

// 创建报修记录
router.post('/create', async (req, res) => {
  try {
    const { title, description, user_id, venue_id, priority } = req.body;
    
    if (!title || !description || !user_id || !venue_id) {
      return res.status(400).json({
        success: false,
        error: '必填字段不能为空'
      });
    }
    
    const repairId = await db.createRepair({
      title,
      description,
      user_id: parseInt(user_id),
      venue_id: parseInt(venue_id),
      priority: priority || 'medium'
    });
    
    successResponse(res, { id: repairId }, '报修记录创建成功');
  } catch (error) {
    handleError(res, error, '创建报修记录失败');
  }
});

// 更新报修状态
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
    
    await db.updateRepairStatus(id, status);
    successResponse(res, null, '报修状态更新成功');
  } catch (error) {
    handleError(res, error, '更新报修状态失败');
  }
});

module.exports = router;
