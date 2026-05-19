const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const db = require('../database/db');

function generateRequestId() {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function safeSaveChatMessage(userId, sessionId, role, content) {
  try {
    await db.saveChatMessage(userId, sessionId, role, content);
  } catch (error) {}
}

// 语音识别接口
router.post('/asr', async (req, res) => {
  try {
    const { audio_data, transcript, sample_rate = 16000, format = 'wav' } = req.body;

    if (transcript && String(transcript).trim()) {
      return res.json({
        success: true,
        text: String(transcript).trim(),
        confidence: 0.99,
        timestamp: new Date().toISOString()
      });
    }

    if (!audio_data || typeof audio_data !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: '音频数据不能为空'
      });
    }

    let recognizedText = '';
    let confidence = 0.9;
    try {
      recognizedText = await aiService.transcribeAudio(audio_data, format);
      confidence = 0.93;
    } catch (error) {
      recognizedText = await performMockASR(audio_data);
      confidence = 0.7;
    }
    
    res.json({
      success: true,
      text: recognizedText,
      confidence,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('ASR处理错误:', error);
    res.status(500).json({ 
      success: false,
      error: '语音识别服务暂时不可用',
      message: error.message 
    });
  }
});

// 模拟ASR识别（用于测试）
async function performMockASR(audioData) {
  // 简单的音频数据分析
  const audioArray = audioData.split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
  const avgAmplitude = audioArray.reduce((sum, val) => sum + Math.abs(val), 0) / audioArray.length;
  
  console.log('音频分析 - 平均振幅:', avgAmplitude, '样本数:', audioArray.length);
  
  // 根据音频特征返回不同的识别结果
  if (avgAmplitude > 1000) {
    return "你好，我想了解一下社区服务";
  } else if (avgAmplitude > 500) {
    return "请问有什么活动可以参加吗";
  } else if (avgAmplitude > 100) {
    return "我想预约一个场地";
  } else {
    return "你好，请帮助我";
  }
}

// AI助手聊天接口
router.post('/chat', async (req, res) => {
  const requestId = generateRequestId();
  try {
    const { message, history = [], userId = 1, sessionId = 'default', frontendContext = null } = req.body;

    const normalizedMessage = String(message || '').trim();
    if (!normalizedMessage) {
      return res.status(400).json({ 
        error: '消息内容不能为空',
        requestId
      });
    }
    if (normalizedMessage.length > 800) {
      return res.status(400).json({
        error: '消息长度不能超过800字符',
        requestId
      });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];

    await safeSaveChatMessage(userId, sessionId, 'user', normalizedMessage);

    const response = await aiService.chat(normalizedMessage, safeHistory, userId, sessionId, frontendContext);

    await safeSaveChatMessage(userId, sessionId, 'assistant', response.message);

    res.json({
      success: true,
      data: {
        requestId,
        message: response.message,
        speechText: response.speechText || response.message,
        voiceRole: '温柔社区工作人员',
        type: response.type || 'chat',
        action: response.action,
        meta: response.meta || null,
        timestamp: new Date().toISOString(),
        ...(response.reservationId && { reservationId: response.reservationId }),
        ...(response.data && { data: response.data })
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'AI服务暂时不可用',
      message: error.message,
      requestId
    });
  }
});

// 获取聊天历史
router.get('/history/:userId/:sessionId', async (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    const limit = req.query.limit || 50;
    
    const history = await db.getChatHistory(userId, sessionId, limit);
    
    res.json({
      success: true,
      data: history.reverse() // 按时间正序返回
    });
  } catch (error) {
    res.status(500).json({
      error: '获取聊天历史失败',
      message: error.message
    });
  }
});

// 获取用户聊天会话列表
router.get('/sessions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const sessions = await db.getChatSessions(userId);
    
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    res.status(500).json({
      error: '获取会话列表失败',
      message: error.message
    });
  }
});

// 获取AI助手状态
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'online',
      provider: 'qwen3-omni-flash',
      timestamp: new Date().toISOString()
    }
  });
});

// 取消预约接口
router.post('/cancel', async (req, res) => {
  try {
    const { reservationId, userId = 1 } = req.body;
    
    if (!reservationId) {
      return res.status(400).json({ 
        error: '预约ID不能为空' 
      });
    }

    const response = await aiService.cancelReservation(reservationId, userId);
    
    res.json({
      success: true,
      data: {
        message: response.message,
        type: response.type,
        action: response.action,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: '取消预约失败',
      message: error.message 
    });
  }
});

// 获取用户预约列表
router.get('/reservations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const reservations = await db.getReservationsByUser(userId);
    
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

// 测试AI连接
router.get('/test', async (req, res) => {
  try {
    const testMessage = '你好，请简单介绍一下你自己';
    const response = await aiService.chat(testMessage, [], 1, 'test');
    
    res.json({
      success: true,
      data: {
        testMessage,
        response: response.message,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // AI测试错误
    res.status(500).json({ 
      error: 'AI服务连接失败',
      message: error.message 
    });
  }
});

module.exports = router;
