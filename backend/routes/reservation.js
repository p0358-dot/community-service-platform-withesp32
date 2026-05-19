const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 获取预约列表
router.get('/list', async (req, res) => {
  try {
    const { status, date, service } = req.query;
    const reservations = await db.getAllReservations({ status, date, service });
    
    res.json({
      success: true,
      data: reservations
    });
  } catch (error) {
    res.status(500).json({
      error: '获取预约列表失败',
      message: error.message
    });
  }
});

// 创建预约
router.post('/create', async (req, res) => {
  try {
    const { userId, venueId, date, timeSlot, notes } = req.body;
    
    if (!userId || !venueId || !date || !timeSlot) {
      return res.status(400).json({
        error: '缺少必要参数'
      });
    }
    
    // 检查时间冲突
    const existingReservations = await db.getReservationsByVenue(venueId, date);
    const hasConflict = existingReservations.some(r =>
      r.time_slot === timeSlot && !['cancelled', 'rejected'].includes(r.status)
    );
    
    if (hasConflict) {
      return res.status(400).json({
        error: '该时间段已被预约'
      });
    }
    
    const reservationId = await db.createReservation({
      userId,
      venueId,
      date,
      timeSlot,
      notes
    });
    
    res.json({
      success: true,
      data: {
        id: reservationId,
        message: '预约创建成功'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '创建预约失败',
      message: error.message
    });
  }
});

// 更新预约状态
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({
        error: '状态不能为空'
      });
    }
    
    await db.updateReservationStatus(id, status, notes);
    
    res.json({
      success: true,
      data: {
        message: '预约状态更新成功'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '更新预约状态失败',
      message: error.message
    });
  }
});

// 取消预约
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.updateReservationStatus(id, 'cancelled', '用户取消');
    
    res.json({
      success: true,
      data: {
        message: '预约已取消'
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '取消预约失败',
      message: error.message
    });
  }
});

// 获取可用时间段
router.get('/available/:venueId/:date', async (req, res) => {
  try {
    const { venueId, date } = req.params;
    
    // 获取该场地的预约记录
    const reservations = await db.getReservationsByVenue(venueId, date);
    
    // 定义所有可能的时间段
    const allTimeSlots = [
      '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
      '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
      '16:00-17:00', '17:00-18:00', '18:00-19:00', '19:00-20:00',
      '20:00-21:00', '21:00-22:00'
    ];
    
    // 获取已预约的时间段
    const bookedSlots = reservations
      .filter(r => !['cancelled', 'rejected'].includes(r.status))
      .map(r => r.time_slot);
    
    // 计算可用时间段
    const availableSlots = allTimeSlots.filter(slot => !bookedSlots.includes(slot));
    
    res.json({
      success: true,
      data: {
        available: availableSlots,
        booked: bookedSlots
      }
    });
  } catch (error) {
    res.status(500).json({
      error: '获取可用时间段失败',
      message: error.message
    });
  }
});

// 获取用户预约记录
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const reservations = await db.getReservationsByUser(userId);
    
    res.json({
      success: true,
      data: reservations
    });
  } catch (error) {
    res.status(500).json({
      error: '获取用户预约记录失败',
      message: error.message
    });
  }
});

module.exports = router;
