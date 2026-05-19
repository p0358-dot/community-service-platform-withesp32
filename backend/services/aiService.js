const axios = require('axios');
const config = require('../config');
const db = require('../database/db');

class AIService {
  constructor() {
    this.maxRetries = 3;
    this.timeout = 30000;
  }

  // 主要聊天方法
  async chat(message, history = [], userId = 1, sessionId = 'default', frontendContext = null) {
    const cleanedMessage = this.normalizeUserMessage(message);
    const safeHistory = this.normalizeHistory(history);
    const hasFrontendContext = Boolean(frontendContext && typeof frontendContext === 'object');
    const intent = this.analyzeIntent(cleanedMessage);
    const boundary = this.getBoundaryLevel(cleanedMessage, intent, hasFrontendContext);
    try {
      if (intent.type === 'booking' && boundary !== 'low') {
        const bookingResult = await this.handleBookingIntent(intent, userId, sessionId);
        return {
          ...bookingResult,
          speechText: bookingResult.speechText || bookingResult.message,
          meta: this.buildMeta(intent, boundary, false, hasFrontendContext, bookingResult.message)
        };
      }

      if (intent.type === 'query' && boundary !== 'low') {
        const queryResult = await this.handleQueryIntent(intent, userId, sessionId);
        return {
          ...queryResult,
          speechText: queryResult.speechText || queryResult.message,
          meta: this.buildMeta(intent, boundary, false, hasFrontendContext, queryResult.message)
        };
      }

      if (intent.type === 'cancel') {
        const cancelResult = await this.handleCancelIntent(intent, userId, sessionId);
        return {
          ...cancelResult,
          speechText: cancelResult.speechText || cancelResult.message,
          meta: this.buildMeta(intent, boundary, false, hasFrontendContext, cancelResult.message)
        };
      }

      const messages = this.buildMessages(cleanedMessage, safeHistory, frontendContext);
      const response = await this.callAI(messages);
      const formattedMessage = this.formatAssistantReply(response.content);

      return {
        message: formattedMessage,
        speechText: formattedMessage,
        usage: response.usage || {},
        type: 'chat',
        action: 'respond',
        meta: this.buildMeta(intent, boundary, false, hasFrontendContext, formattedMessage)
      };
    } catch (error) {
      return this.buildFallbackResponse(cleanedMessage, intent, boundary, hasFrontendContext, error.message);
    }
  }

  // 构建消息格式
  buildMessages(message, history, frontendContext) {
    const messages = [];

    messages.push({
      role: 'system',
      content: `你是社区服务中心的温柔工作人员，负责通过AI助手为居民提供准确、耐心、清晰的服务。请严格遵循：
1. 语气温和、礼貌、简洁，优先给出可执行步骤
2. 能直接回答就直接回答，不要冗长铺垫
3. 第一句必须给出结论，结论不超过30字
4. 涉及预约、报修、政策、便民服务时优先结合系统已有信息
5. 当用户询问“最近信息”时，优先解读社区业务数据并结构化返回，重点关注会议室/场地状态、最近公示、便民服务、预约与报修
6. 如果上下文有 venueAvailabilityDigest，先用一句汇报式结论输出，如“会议室有空，乒乓球室有空，健身房没空”
7. 回复中避免编造不存在的数据，无法确认时明确说明并给替代建议
8. 输出格式优先为“结论：...\\n依据：...\\n下一步：...”`
    });

    const normalizedContext = this.normalizeFrontendContext(frontendContext);
    if (normalizedContext) {
      messages.push({
        role: 'system',
        content: `当前社区最近信息（供你服务用户，优先用于会议室状态、公示与服务建议）：\n${normalizedContext}`
      });
    }

    history.forEach(item => {
      if (item.role && item.content) {
        messages.push({
          role: item.role,
          content: item.content
        });
      }
    });
    
    messages.push({
      role: 'user',
      content: message
    });
    
    return messages;
  }

  async callAI(messages) {
    let lastError = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.callDashScope(messages);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await this.sleep(250 * attempt);
        }
      }
    }
    throw lastError || new Error('AI调用失败');
  }

  normalizeFrontendContext(frontendContext) {
    if (!frontendContext || typeof frontendContext !== 'object') {
      return '';
    }
    const safeContext = {
      currentView: frontendContext.currentView || '',
      userName: frontendContext.userName || '',
      visibleCardCount: frontendContext.visibleCardCount || 0,
      quickFacts: Array.isArray(frontendContext.quickFacts) ? frontendContext.quickFacts.slice(0, 12) : [],
      visibleTexts: Array.isArray(frontendContext.visibleTexts) ? frontendContext.visibleTexts.slice(0, 20) : [],
      venueAvailabilityDigest: Array.isArray(frontendContext.venueAvailabilityDigest) ? frontendContext.venueAvailabilityDigest.slice(0, 12) : [],
      venueStatusList: Array.isArray(frontendContext.venueStatusList) ? frontendContext.venueStatusList.slice(0, 12) : [],
      latestNotices: Array.isArray(frontendContext.latestNotices) ? frontendContext.latestNotices.slice(0, 12) : [],
      topServices: Array.isArray(frontendContext.topServices) ? frontendContext.topServices.slice(0, 12) : [],
      reservationHighlights: Array.isArray(frontendContext.reservationHighlights) ? frontendContext.reservationHighlights.slice(0, 12) : [],
      repairHighlights: Array.isArray(frontendContext.repairHighlights) ? frontendContext.repairHighlights.slice(0, 12) : []
    };
    return JSON.stringify(safeContext, null, 2);
  }

  // 调用阿里云DashScope
  async callDashScope(messages) {
    try {
      const headers = {
        'Authorization': `Bearer ${config.dashscope.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-DataInspection': 'enable'
      };

      // 如果有工作空间ID，添加到请求头
      if (config.dashscope.workspaceId) {
        headers['X-DashScope-WorkSpace'] = config.dashscope.workspaceId;
      }

      const response = await axios.post(
        `${config.dashscope.apiUrl}/chat/completions`,
        {
          model: config.dashscope.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
          stream: false
        },
        {
          headers: headers,
          timeout: this.timeout
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        return {
          content: this.extractResponseText(response.data.choices[0].message.content),
          usage: response.data.usage || {}
        };
      } else {
        throw new Error('阿里云DashScope响应格式错误');
      }
    } catch (error) {
      if (error.response) {
        // 阿里云DashScope API错误
        throw new Error(`阿里云DashScope API错误: ${error.response.data.error?.message || error.response.statusText}`);
      } else {
        throw new Error(`阿里云DashScope连接错误: ${error.message}`);
      }
    }
  }

  extractResponseText(content) {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (typeof item === 'string') {
            return item;
          }
          if (item && typeof item.text === 'string') {
            return item.text;
          }
          if (item && typeof item.content === 'string') {
            return item.content;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n')
        .trim();
    }
    return '';
  }

  async transcribeAudio(audioData, format = 'wav') {
    try {
      const response = await axios.post(
        `${config.dashscope.apiUrl}/chat/completions`,
        {
          model: config.dashscope.model,
          messages: [
            {
              role: 'system',
              content: '你是语音识别助手。请将输入音频转成简体中文文本，只输出转写结果，不要解释。'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: '请将这段音频转写成文字。' },
                { type: 'input_audio', input_audio: { data: audioData, format } }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 600,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${config.dashscope.apiKey}`,
            'Content-Type': 'application/json',
            'X-DashScope-DataInspection': 'enable'
          },
          timeout: this.timeout
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const transcript = this.extractResponseText(response.data.choices[0].message.content);
        if (!transcript) {
          throw new Error('语音识别结果为空');
        }
        return transcript;
      } else {
        throw new Error('语音识别响应格式错误');
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`语音识别API错误: ${error.response.data.error?.message || error.response.statusText}`);
      } else {
        throw new Error(`语音识别连接错误: ${error.message}`);
      }
    }
  }

  // 分析用户意图
  analyzeIntent(message) {
    const lowerMessage = message.toLowerCase();

    const bookingKeywords = ['预约', '预订', '预定', 'book', 'reserve'];
    const queryKeywords = ['查询', '查看', '问', '什么', '哪里', '如何', '怎么', '时间', '状态', '可用', '空闲', '情况'];
    const cancelKeywords = ['取消', '删除', '取消预约', '取消预订'];
    const frontendKeywords = ['最近信息', '最近情况', '最新情况', '社区动态', '会议室情况', '会议室状态', '公示', '公告', '通知', '便民服务', '社区服务', '近期安排'];
    const venue = this.extractVenue(message);
    const time = this.extractTime(message);
    const date = this.extractDate(message);
    const hasBookingKeyword = bookingKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasQueryKeyword = queryKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasCancelKeyword = cancelKeywords.some(keyword => lowerMessage.includes(keyword));
    const isRecentInfo = frontendKeywords.some(keyword => lowerMessage.includes(keyword));

    if (hasCancelKeyword) {
      return {
        type: 'cancel',
        confidence: 0.9
      };
    }

    if (isRecentInfo) {
      return {
        type: 'chat',
        confidence: 0.95
      };
    }

    if (hasBookingKeyword || ((venue || time) && /(帮我|我要|请|麻烦)/.test(message))) {
      return {
        type: 'booking',
        venue,
        time,
        date,
        confidence: venue || time ? 0.9 : 0.72
      };
    }

    if (hasQueryKeyword && (venue || lowerMessage.includes('场地') || lowerMessage.includes('会议室'))) {
      return {
        type: 'query',
        venue,
        time,
        date,
        confidence: venue ? 0.78 : 0.68
      };
    }

    return {
      type: 'chat',
      confidence: 0.5
    };
  }

  // 提取场地信息
  extractVenue(message) {
    const venues = ['乒乓球室', '健身房', '会议室A', '会议室B', '图书阅览室'];
    for (const venue of venues) {
      if (message.includes(venue)) {
        return venue;
      }
    }
    // 处理通用的"会议室"
    if (message.includes('会议室') && !message.includes('会议室A') && !message.includes('会议室B')) {
      return '会议室A'; // 默认返回会议室A
    }
    return null;
  }

  // 提取时间信息
  extractTime(message) {
    const timePattern = /(\d{1,2}):?(\d{0,2})/;
    const match = message.match(timePattern);
    if (match) {
      const hour = parseInt(match[1]);
      const minute = match[2] ? parseInt(match[2]) : 0;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
    
    // 处理文字时间
    if (message.includes('上午')) return '09:00';
    if (message.includes('下午')) return '14:00';
    if (message.includes('晚上')) return '19:00';
    
    return null;
  }

  // 提取日期信息
  extractDate(message) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    
    if (message.includes('今天')) {
      return today.toISOString().split('T')[0];
    } else if (message.includes('明天')) {
      return tomorrow.toISOString().split('T')[0];
    } else if (message.includes('后天')) {
      return dayAfter.toISOString().split('T')[0];
    }
    
    // 默认返回明天
    return tomorrow.toISOString().split('T')[0];
  }

  // 处理预约意图
  async handleBookingIntent(intent, userId, sessionId) {
    try {
      const { venue, time, date } = intent;
      
      if (!venue) {
        return {
          message: '请告诉我您想预约哪个场地？我们有乒乓球室、健身房、会议室A、会议室B和图书阅览室。',
          type: 'booking',
          action: 'ask_venue'
        };
      }
      
      if (!time) {
        return {
          message: `您想预约${venue}的什么时间？请告诉我具体的时间，比如"14:00"或"下午2点"。`,
          type: 'booking',
          action: 'ask_time'
        };
      }
      
      // 查找场地
      const venues = await db.getAllVenues();
      const targetVenue = venues.find(v => v.name.includes(venue));
      
      if (!targetVenue) {
        return {
          message: `抱歉，没有找到"${venue}"这个场地。请选择：乒乓球室、健身房、会议室A、会议室B或图书阅览室。`,
          type: 'booking',
          action: 'venue_not_found'
        };
      }
      
      // 检查时间冲突
      const existingReservations = await db.getReservationsByVenue(targetVenue.id, date);
      const timeSlot = `${time}-${this.getEndTime(time)}`;
      
      const conflict = existingReservations.find(r => r.time_slot === timeSlot);
      if (conflict) {
        return {
          message: `抱歉，${venue}在${date} ${timeSlot}已经被预约了。请选择其他时间。`,
          type: 'booking',
          action: 'time_conflict'
        };
      }
      
      // 创建预约
      const reservationId = await db.createReservation({
        userId,
        venueId: targetVenue.id,
        date,
        timeSlot,
        notes: '通过AI助手预约'
      });
      
      return {
        message: `✅ 预约成功！\n\n场地：${venue}\n日期：${date}\n时间：${timeSlot}\n预约编号：${reservationId}\n\n请按时到达场地，如有变更请提前联系管理员。`,
        type: 'booking',
        action: 'success',
        reservationId,
        data: {
          venue: targetVenue.name,
          date,
          timeSlot
        }
      };
      
    } catch (error) {
      return {
        message: `预约失败：${error.message}`,
        type: 'booking',
        action: 'error'
      };
    }
  }

  // 处理查询意图
  async handleQueryIntent(intent, userId, sessionId) {
    try {
      const { venue, date } = intent;
      
      if (venue) {
        // 查询特定场地
        const venues = await db.getAllVenues();
        const targetVenue = venues.find(v => v.name.includes(venue));
        
        if (!targetVenue) {
          return {
            message: `抱歉，没有找到"${venue}"这个场地。`,
            type: 'query',
            action: 'venue_not_found'
          };
        }
        
        const queryDate = date || new Date().toISOString().split('T')[0];
        const reservations = await db.getReservationsByVenue(targetVenue.id, queryDate);
        
        if (reservations.length === 0) {
          return {
            message: `${venue}在${queryDate}没有预约记录，全天可用。`,
            type: 'query',
            action: 'available'
          };
        }
        
        const timeSlots = reservations.map(r => r.time_slot).join('、');
        return {
          message: `${venue}在${queryDate}的预约情况：\n\n已预约时段：${timeSlots}\n\n其他时间可以预约。`,
          type: 'query',
          action: 'schedule'
        };
      } else {
        // 查询所有场地
        const venues = await db.getAllVenues();
        const venueList = venues.map(v => `• ${v.name} (${v.status === 'available' ? '可用' : '维护中'})`).join('\n');
        
        return {
          message: `📋 社区场地列表：\n\n${venueList}\n\n您可以说"预约乒乓球室"来预约特定场地。`,
          type: 'query',
          action: 'venue_list'
        };
      }
      
    } catch (error) {
      return {
        message: `查询失败：${error.message}`,
        type: 'query',
        action: 'error'
      };
    }
  }

  // 处理取消意图
  async handleCancelIntent(intent, userId, sessionId) {
    try {
      const reservations = await db.getReservationsByUser(userId);
      const activeReservations = reservations.filter(r => r.status === 'pending' || r.status === 'confirmed');
      
      if (activeReservations.length === 0) {
        return {
          message: '您当前没有待处理的预约。',
          type: 'cancel',
          action: 'no_reservations'
        };
      }
      
      const reservationList = activeReservations.map(r => 
        `• ${r.venue_name} - ${r.date} ${r.time_slot} (编号: ${r.id})`
      ).join('\n');
      
      return {
        message: `您当前的预约：\n\n${reservationList}\n\n请告诉我您想取消哪个预约的编号。`,
        type: 'cancel',
        action: 'list_reservations',
        reservations: activeReservations
      };
      
    } catch (error) {
      return {
        message: `查询预约失败：${error.message}`,
        type: 'cancel',
        action: 'error'
      };
    }
  }

  // 获取结束时间
  getEndTime(startTime) {
    const [hour, minute] = startTime.split(':').map(Number);
    const endHour = hour + 2; // 默认2小时
    return `${endHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  // 取消预约
  async cancelReservation(reservationId, userId) {
    try {
      const reservation = await db.getReservationsByUser(userId);
      const targetReservation = reservation.find(r => r.id === parseInt(reservationId));
      
      if (!targetReservation) {
        throw new Error('预约不存在或不属于您');
      }
      
      await db.updateReservationStatus(reservationId, 'cancelled', '用户通过AI助手取消');
      
      return {
        message: `✅ 预约已取消！\n\n场地：${targetReservation.venue_name}\n日期：${targetReservation.date}\n时间：${targetReservation.time_slot}`,
        type: 'cancel',
        action: 'success'
      };
      
    } catch (error) {
      return {
        message: `取消预约失败：${error.message}`,
        type: 'cancel',
        action: 'error'
      };
    }
  }

  normalizeUserMessage(message) {
    return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 800);
  }

  normalizeHistory(history) {
    if (!Array.isArray(history)) {
      return [];
    }
    return history
      .filter(item => item && typeof item.role === 'string' && typeof item.content === 'string')
      .map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content.slice(0, 600)
      }))
      .slice(-10);
  }

  getBoundaryLevel(message, intent, hasFrontendContext) {
    if (!message) {
      return 'low';
    }
    if (intent.type === 'cancel') {
      return 'high';
    }
    if (intent.type === 'booking') {
      if (intent.venue && intent.time) {
        return 'high';
      }
      return 'medium';
    }
    if (intent.type === 'query') {
      if (intent.venue) {
        return 'high';
      }
      return 'medium';
    }
    if (hasFrontendContext) {
      return 'medium';
    }
    return 'low';
  }

  buildMeta(intent, boundary, fallbackUsed, usedFrontendContext, messageText) {
    return {
      intentType: intent.type,
      confidence: intent.confidence,
      boundary,
      fallbackUsed,
      usedFrontendContext,
      summary: this.buildSummary(messageText)
    };
  }

  buildSummary(message) {
    const text = String(message || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      return '';
    }
    const firstLine = text.split('\n').find(line => line.trim()) || text;
    return firstLine.slice(0, 50);
  }

  formatAssistantReply(content) {
    const text = String(content || '').trim();
    if (!text) {
      return '结论：当前服务繁忙。\n下一步：请稍后再试，或直接告诉我您要查询的场地与日期。';
    }
    if (/^结论[:：]/.test(text)) {
      return text;
    }
    const sentenceMatch = text.match(/^[^。！？!?]{1,60}[。！？!?]?/);
    const firstSentence = sentenceMatch ? sentenceMatch[0].replace(/[。！？!?]$/, '') : text.slice(0, 40);
    const remaining = text.slice(sentenceMatch ? sentenceMatch[0].length : firstSentence.length).trim();
    if (!remaining) {
      return `结论：${firstSentence}`;
    }
    return `结论：${firstSentence}\n下一步：${remaining}`;
  }

  buildFallbackResponse(message, intent, boundary, hasFrontendContext, errorMessage) {
    const fallbackMessage = `结论：系统已切换稳定回复。\n下一步：请直接提供“场地+日期+时间”，例如“预约会议室A 明天14:00”。如果您要看最近信息，我可以先汇总场地、公示和便民服务。`;
    return {
      message: fallbackMessage,
      speechText: fallbackMessage,
      type: 'chat',
      action: 'fallback',
      meta: {
        ...this.buildMeta(intent, boundary, true, hasFrontendContext, fallbackMessage),
        error: String(errorMessage || '').slice(0, 120),
        userMessage: this.buildSummary(message)
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new AIService();
