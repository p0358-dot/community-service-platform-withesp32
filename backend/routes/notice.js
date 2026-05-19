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

// 获取所有通知
router.get('/list', async (req, res) => {
  try {
    const { status, type } = req.query;
    let notices = await db.getAllNotices();
    
    // 过滤条件
    if (status) {
      notices = notices.filter(notice => notice.status === status);
    }
    
    if (type) {
      notices = notices.filter(notice => notice.type === type);
    }
    
    successResponse(res, notices);
  } catch (error) {
    handleError(res, error, '获取通知列表失败');
  }
});

// 获取已发布的通知（用户端使用）
router.get('/published', async (req, res) => {
  try {
    const notices = await db.getAllNotices();
    const publishedNotices = notices.filter(notice => notice.status === 'published');
    successResponse(res, publishedNotices);
  } catch (error) {
    handleError(res, error, '获取通知失败');
  }
});

// 获取通知详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await db.getNoticeById(id);
    
    if (!notice) {
      return res.status(404).json({
        success: false,
        error: '通知不存在'
      });
    }
    
    successResponse(res, notice);
  } catch (error) {
    handleError(res, error, '获取通知详情失败');
  }
});

// 创建通知
router.post('/create', async (req, res) => {
  try {
    const { title, content, type, author } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容不能为空'
      });
    }
    
    const noticeId = await db.createNotice({
      title,
      content,
      type: type || 'announcement',
      author: author || 'admin'
    });
    
    successResponse(res, { id: noticeId }, '通知创建成功');
  } catch (error) {
    handleError(res, error, '创建通知失败');
  }
});

// 更新通知状态
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
    
    await db.updateNoticeStatus(id, status);
    successResponse(res, null, '通知状态更新成功');
  } catch (error) {
    handleError(res, error, '更新通知状态失败');
  }
});

module.exports = router;
