const API_BASE_URL = `${window.location.origin}/api`;
const AUTH_STORAGE_KEY = "community_auth_session";

const Auth = {
    getSession() {
        try {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    },
    saveSession(session) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    },
    clearSession() {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    },
    getToken() {
        return this.getSession()?.token || "";
    },
    getUser() {
        return this.getSession()?.user || null;
    },
    ensureUserAccess() {
        const session = this.getSession();
        if (!session?.token || !session?.user) {
            window.location.href = `/auth/login.html?role=user&redirect=${encodeURIComponent(window.location.pathname)}`;
            return false;
        }
        if (session.user.role !== "user" && session.user.role !== "admin") {
            this.clearSession();
            window.location.href = `/auth/login.html?role=user&redirect=${encodeURIComponent(window.location.pathname)}`;
            return false;
        }
        return true;
    }
};

const state = {
    currentUser: null,
    voiceRecognition: null,
    chatVoiceRecognition: null,
    chatVoiceRecording: false,
    speakingEnabled: true,
    activeContentId: "home",
    lastFrontendSnapshotAt: 0,
    venues: [],
    notices: [],
    services: [],
    reservations: [],
    repairs: [],
    chatHistory: [],
    chatRequestPending: false
};

class ApiService {
    static async request(path, options = {}) {
        const token = Auth.getToken();
        const mergedHeaders = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };
        if (token) {
            mergedHeaders.Authorization = `Bearer ${token}`;
        }
        const response = await fetch(`${API_BASE_URL}${path}`, {
            headers: mergedHeaders,
            ...options
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            Auth.clearSession();
            window.location.href = `/auth/login.html?role=user&redirect=${encodeURIComponent(window.location.pathname)}`;
            throw new Error("登录已过期，请重新登录");
        }
        if (!response.ok) {
            throw new Error(data.error || "请求失败");
        }
        return data;
    }

    static get(path) {
        return this.request(path);
    }

    static post(path, payload) {
        return this.request(path, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }

    static delete(path) {
        return this.request(path, { method: "DELETE" });
    }
}

const Utils = {
    toast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2600);
    },

    showContent(contentId) {
        const mainContent = document.querySelector(".main-content");
        if (mainContent) {
            mainContent.style.display = "none";
        }
        document.querySelectorAll(".content-area").forEach((el) => (el.style.display = "none"));
        let target = document.getElementById(contentId);
        if (!target) {
            target = document.createElement("div");
            target.id = contentId;
            target.className = "content-area";
            document.body.insertBefore(target, document.querySelector(".footer"));
        }
        target.style.display = "block";
        state.activeContentId = contentId;
        this.ensureBackButton();
    },

    showHome() {
        const mainContent = document.querySelector(".main-content");
        if (mainContent) {
            mainContent.style.display = "grid";
        }
        document.querySelectorAll(".content-area").forEach((el) => (el.style.display = "none"));
        state.activeContentId = "home";
        const btn = document.querySelector(".back-button");
        if (btn) {
            btn.remove();
        }
    },

    ensureBackButton() {
        let btn = document.querySelector(".back-button");
        if (!btn) {
            btn = document.createElement("button");
            btn.className = "back-button";
            btn.innerHTML = '<i class="fas fa-arrow-left"></i> 返回主页';
            btn.onclick = () => this.showHome();
            document.body.appendChild(btn);
        }
    },

    statusText(status) {
        const map = {
            pending: "待审核",
            approved: "已通过",
            rejected: "已拒绝",
            completed: "已完成",
            cancelled: "已取消",
            confirmed: "已确认",
            processing: "处理中"
        };
        return map[status] || status;
    }
};

async function bootstrap() {
    if (!Auth.ensureUserAccess()) {
        return;
    }
    const cachedUser = Auth.getUser();
    if (cachedUser) {
        state.currentUser = { id: cachedUser.id, name: cachedUser.name || cachedUser.username || "用户", role: cachedUser.role };
    }
    bindStaticEvents();
    initVoiceRecognition();
    await loadCurrentUser();
}

function bindStaticEvents() {
    document.querySelectorAll(".service-item").forEach((item) => {
        item.addEventListener("click", (event) => {
            if (event.target.closest("button")) {
                return;
            }
            const service = item.dataset.service;
            dispatchByService(service);
        });
    });

    document.querySelectorAll(".action-btn").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            const action = button.dataset.action;
            dispatchByService(action);
        });
    });
}

function dispatchByService(service) {
    const actions = {
        场地查询: showVenueList,
        场地预约: showVenueBooking,
        公共设施报修: showRepairReport,
        政策通知查询: showPolicyQuery,
        便民服务查询: showConvenienceServices,
        便民网点: showConvenienceStores,
        个人中心: showUserCenter
    };
    const action = actions[service];
    if (action) {
        action();
    }
}

async function loadCurrentUser() {
    try {
        const res = await ApiService.get("/user/me");
        if (res.data) {
            state.currentUser = { id: res.data.id, name: res.data.name || res.data.username || "用户", role: res.data.role };
            Auth.saveSession({ token: Auth.getToken(), user: res.data });
        }
    } catch (error) {
        Auth.clearSession();
        window.location.href = `/auth/login.html?role=user&redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
    }
    const userName = document.querySelector(".user-name");
    if (userName) {
        userName.textContent = state.currentUser.name;
    }
}

function renderCardGrid(items, renderItem) {
    if (!items.length) {
        return '<div class="empty-state">暂无数据</div>';
    }
    return items.map(renderItem).join("");
}

async function showVenueList() {
    Utils.showContent("venue-list-content");
    const container = document.getElementById("venue-list-content");
    container.innerHTML = '<div class="page-header"><h2><i class="fas fa-building"></i> 场地查询</h2><p>查看场地实时状态</p></div><div id="venue-grid" class="venue-grid"><div class="loading">加载中...</div></div>';
    const res = await ApiService.get("/venue/list");
    state.venues = Array.isArray(res.data) ? res.data : [];
    const grid = document.getElementById("venue-grid");
    grid.innerHTML = renderCardGrid(state.venues, (v) => `
        <div class="venue-card">
            <div class="venue-header">
                <h3>${v.name}</h3>
                <span class="venue-status status-${v.status}">${v.status === "available" ? "可用" : "不可用"}</span>
            </div>
            <div class="venue-info">
                <p><i class="fas fa-map-marker-alt"></i> ${v.location}</p>
                <p><i class="fas fa-users"></i> 容量 ${v.capacity} 人</p>
                <p><i class="fas fa-info-circle"></i> ${v.description || "暂无描述"}</p>
            </div>
            <button class="venue-book-btn" onclick="quickBookVenue(${v.id})" ${v.status !== "available" ? "disabled" : ""}>${v.status === "available" ? "预约该场地" : "暂不可预约"}</button>
        </div>
    `);
}

async function showVenueBooking() {
    Utils.showContent("venue-booking-content");
    const today = new Date().toISOString().slice(0, 10);
    const container = document.getElementById("venue-booking-content");
    container.innerHTML = `
        <div class="page-header"><h2><i class="fas fa-calendar-alt"></i> 场地预约</h2><p>请选择场地、日期和时间段</p></div>
        <div class="booking-container">
            <div class="booking-form">
                <div class="form-group"><label>场地</label><select id="venue-select"></select></div>
                <div class="form-group"><label>日期</label><input id="booking-date" type="date" min="${today}" value="${today}"></div>
                <div class="form-group"><label>时间段</label><select id="time-slot"></select></div>
                <div class="form-group"><label>备注</label><textarea id="booking-notes" placeholder="选填，例如：需要投影仪和白板"></textarea></div>
                <button class="submit-btn" onclick="submitBooking()">提交预约</button>
            </div>
            <div class="venue-preview" id="venue-preview"><h3>场地信息</h3><p>请选择场地查看详情</p></div>
        </div>
    `;
    const res = await ApiService.get("/venue/list");
    state.venues = Array.isArray(res.data) ? res.data : [];
    const select = document.getElementById("venue-select");
    select.innerHTML = '<option value="">请选择场地</option>' + state.venues.map((v) => `<option value="${v.id}">${v.name}</option>`).join("");
    select.onchange = async () => {
        const venue = state.venues.find((v) => v.id === Number(select.value));
        if (!venue) {
            return;
        }
        document.getElementById("venue-preview").innerHTML = `<h3>${venue.name}</h3><p><strong>位置：</strong>${venue.location}</p><p><strong>容量：</strong>${venue.capacity} 人</p><p><strong>状态：</strong>${venue.status}</p><p><strong>说明：</strong>${venue.description || "暂无说明"}</p>`;
        await loadAvailableSlots();
    };
    document.getElementById("booking-date").onchange = loadAvailableSlots;
}

async function loadAvailableSlots() {
    const venueId = document.getElementById("venue-select").value;
    const date = document.getElementById("booking-date").value;
    if (!venueId || !date) {
        return;
    }
    const res = await ApiService.get(`/reservation/available/${venueId}/${date}`);
    const available = res.data?.available || [];
    const select = document.getElementById("time-slot");
    select.innerHTML = available.map((slot) => `<option value="${slot}">${slot}</option>`).join("");
}

async function submitBooking() {
    const venueId = Number(document.getElementById("venue-select").value);
    const date = document.getElementById("booking-date").value;
    const timeSlot = document.getElementById("time-slot").value;
    const notes = document.getElementById("booking-notes").value.trim();
    if (!venueId || !date || !timeSlot) {
        Utils.toast("请先填写完整预约信息", "warning");
        return;
    }
    await ApiService.post("/reservation/create", {
        userId: state.currentUser.id,
        venueId,
        date,
        timeSlot,
        notes
    });
    Utils.toast("预约提交成功", "success");
    showUserCenter();
}

function quickBookVenue(venueId) {
    showVenueBooking().then(() => {
        setTimeout(async () => {
            const select = document.getElementById("venue-select");
            if (!select) {
                return;
            }
            select.value = String(venueId);
            await select.onchange();
        }, 80);
    });
}

async function showRepairReport() {
    Utils.showContent("repair-content");
    const container = document.getElementById("repair-content");
    const repairsRes = await ApiService.get(`/repair/user/${state.currentUser.id}`);
    const venuesRes = await ApiService.get("/venue/list");
    const repairs = Array.isArray(repairsRes.data) ? repairsRes.data : [];
    const venues = Array.isArray(venuesRes.data) ? venuesRes.data : [];
    container.innerHTML = `
        <div class="page-header"><h2><i class="fas fa-tools"></i> 设备报修</h2><p>提交报修并查看处理进度</p></div>
        <div class="booking-container">
            <div class="booking-form">
                <div class="form-group"><label>标题</label><input id="repair-title" type="text" placeholder="例如：健身房跑步机无法启动"></div>
                <div class="form-group"><label>描述</label><textarea id="repair-description" placeholder="请描述故障现象"></textarea></div>
                <div class="form-group"><label>场地</label><select id="repair-venue">${venues.map((v) => `<option value="${v.id}">${v.name}</option>`).join("")}</select></div>
                <div class="form-group"><label>优先级</label><select id="repair-priority"><option value="low">低</option><option value="medium" selected>中</option><option value="high">高</option></select></div>
                <button class="submit-btn" onclick="submitRepair()">提交报修</button>
            </div>
            <div class="venue-preview"><h3>我的报修记录</h3>${renderCardGrid(repairs, (r) => `<p style="margin-bottom:10px;"><strong>${r.title}</strong><br>${Utils.statusText(r.status)} · ${r.venue_name || "未知场地"}</p>`)}</div>
        </div>
    `;
}

async function submitRepair() {
    await ApiService.post("/repair/create", {
        title: document.getElementById("repair-title").value.trim(),
        description: document.getElementById("repair-description").value.trim(),
        user_id: state.currentUser.id,
        venue_id: Number(document.getElementById("repair-venue").value),
        priority: document.getElementById("repair-priority").value
    });
    Utils.toast("报修提交成功", "success");
    showRepairReport();
}

async function showPolicyQuery() {
    Utils.showContent("notice-content");
    const container = document.getElementById("notice-content");
    const res = await ApiService.get("/notice/published");
    state.notices = Array.isArray(res.data) ? res.data : [];
    container.innerHTML = `<div class="page-header"><h2><i class="fas fa-bullhorn"></i> 政策通知</h2><p>已发布公告与活动通知</p></div><div>${renderCardGrid(state.notices, (n) => `<div class="venue-card"><h3>${n.title}</h3><p>${n.content}</p><p style="margin-top:8px;color:#6b7280;">${n.author} · ${n.type}</p></div>`)}</div>`;
}

async function showConvenienceServices() {
    Utils.showContent("service-content");
    const container = document.getElementById("service-content");
    const res = await ApiService.get("/service/list");
    state.services = Array.isArray(res.data) ? res.data : [];
    container.innerHTML = `<div class="page-header"><h2><i class="fas fa-concierge-bell"></i> 便民服务</h2><p>社区可用服务列表</p></div><div>${renderCardGrid(state.services, (s) => `<div class="venue-card"><h3>${s.name}</h3><p>${s.description || "暂无描述"}</p><p style="margin-top:8px;color:#6b7280;">提供方：${s.provider} · 评分：${s.rating} · 状态：${s.status === "active" ? "可用" : "暂停"}</p></div>`)}</div>`;
}

function showConvenienceStores() {
    Utils.showContent("store-content");
    const container = document.getElementById("store-content");
    container.innerHTML = `<div class="page-header"><h2><i class="fas fa-store"></i> 便民网点</h2><p>附近网点信息</p></div><div class="venue-grid"><div class="venue-card"><h3>快递代收点</h3><p>位置：北门便民站</p><p>营业：09:00 - 21:00</p></div><div class="venue-card"><h3>社区便利超市</h3><p>位置：2号楼一层</p><p>营业：08:00 - 23:00</p></div><div class="venue-card"><h3>家政服务站</h3><p>位置：物业大厅旁</p><p>营业：09:30 - 18:30</p></div></div>`;
}

async function showUserCenter() {
    Utils.showContent("user-center-content");
    const container = document.getElementById("user-center-content");
    const [userRes, reservationRes] = await Promise.all([
        ApiService.get(`/user/${state.currentUser.id}`),
        ApiService.get(`/reservation/user/${state.currentUser.id}`)
    ]);
    const user = userRes.data;
    const reservations = Array.isArray(reservationRes.data) ? reservationRes.data : [];
    container.innerHTML = `<div class="page-header"><h2><i class="fas fa-user-cog"></i> 个人中心</h2><p>个人信息与预约记录</p></div><div class="booking-container"><div class="booking-form"><div class="form-group"><label>姓名</label><input value="${user.name || ""}" readonly></div><div class="form-group"><label>用户名</label><input value="${user.username || ""}" readonly></div><div class="form-group"><label>手机号</label><input value="${user.phone || ""}" readonly></div><div class="form-group"><label>邮箱</label><input value="${user.email || ""}" readonly></div><button class="submit-btn" onclick="logoutCurrentUser()" style="margin-top: 12px;background:#dc2626;">退出登录</button></div><div class="venue-preview"><h3>我的预约</h3>${renderCardGrid(reservations, (r) => `<p style="margin-bottom:10px;"><strong>${r.venue_name || "未知场地"}</strong><br>${r.date} ${r.time_slot} · ${Utils.statusText(r.status)} ${r.status === "pending" ? `<button class="action-btn" style="margin-left:8px;" onclick="cancelReservation(${r.id})">取消</button>` : ""}</p>`)}</div></div>`;
}

async function cancelReservation(id) {
    await ApiService.delete(`/reservation/${id}`);
    Utils.toast("预约已取消", "success");
    showUserCenter();
}

async function logoutCurrentUser() {
    try {
        await ApiService.post("/user/logout", {});
    } catch (error) {}
    Auth.clearSession();
    window.location.href = `/auth/login.html?role=user&redirect=${encodeURIComponent("/user/")}`;
}

async function showAIAssistant() {
    Utils.showContent("ai-content");
    const container = document.getElementById("ai-content");
    container.innerHTML = `<div class="page-header"><h2><i class="fas fa-robot"></i> AI 助手</h2><p>已优化为结论优先、可追溯、失败可兜底的社区服务助手</p></div><div class="ai-chat-container"><div class="chat-toolbar"><button id="chat-voice-btn" class="chat-tool-btn" onclick="toggleChatVoiceInput()"><i class="fas fa-microphone"></i> 语音输入</button><button class="chat-tool-btn" onclick="askFrontendInfo()"><i class="fas fa-display"></i> 最近信息</button><button class="chat-tool-btn" onclick="stopSpeaking()"><i class="fas fa-volume-mute"></i> 静音停止播报</button></div><div class="chat-messages" id="chat-messages"></div><div class="chat-input-container"><input id="chat-input" placeholder="例如：请给我会议室和最近通知的结论与下一步" onkeypress="handleChatKeyPress(event)"><button id="chat-send-btn" class="send-btn" onclick="sendMessage()"><i class="fas fa-paper-plane"></i></button></div></div>`;
    if (!state.chatHistory.length) {
        addChatMessage("您好，我是社区服务中心工作人员。您可以直接说“预约会议室A 明天14:00”或“请汇总最近信息并给下一步建议”。", "ai");
    } else {
        state.chatHistory.forEach((item) => addChatMessage(item.content, item.role === "assistant" ? "ai" : "user"));
    }
    initChatVoiceRecognition();
}

function handleChatKeyPress(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}

async function sendMessage(contentFromVoice = "", forceFrontendContext = false) {
    if (state.chatRequestPending) {
        return;
    }
    const input = document.getElementById("chat-input");
    if (!input) {
        return;
    }
    const content = (contentFromVoice || input.value || "").trim();
    if (!content) {
        return;
    }
    if (content.length > 800) {
        Utils.toast("消息最多 800 字，请精简后重试", "warning");
        return;
    }
    input.value = "";
    addChatMessage(content, "user");
    state.chatHistory.push({ role: "user", content });
    state.chatHistory = state.chatHistory.slice(-20);
    const pendingMessageId = addChatMessage("正在分析您的需求，请稍候...", "ai", { pending: true });
    setChatPendingState(true);
    try {
        const shouldSendFrontendContext = forceFrontendContext || /最近|信息|会议室|场地|公示|公告|通知|便民|服务|社区情况|总结|重点/.test(content);
        let frontendContext = null;
        let enhancedMessage = content;
        let fixedDigestMessage = "";
        if (shouldSendFrontendContext) {
            await refreshFrontendContentSnapshot();
            frontendContext = collectFrontendContext();
            const digestSentence = buildVenueAvailabilitySentence(frontendContext.venueAvailabilityDigest || []);
            if (digestSentence) {
                fixedDigestMessage = `【最近信息速报】${digestSentence}`;
                addChatMessage(fixedDigestMessage, "ai");
                enhancedMessage = `${content}\n前端已固定展示场地速报：${digestSentence}。请不要重复这句，直接补充最近公示、便民服务建议与下一步办理建议。`;
            }
        }
        const res = await ApiService.post("/ai/chat", {
            message: enhancedMessage,
            userId: state.currentUser.id,
            sessionId: "default",
            frontendContext,
            history: state.chatHistory.slice(-10)
        });
        removeChatMessage(pendingMessageId);
        const aiText = res.data?.message || "AI 当前不可用";
        addChatMessage(aiText, "ai");
        state.chatHistory.push({ role: "assistant", content: aiText });
        state.chatHistory = state.chatHistory.slice(-20);
        if (res.data?.meta?.fallbackUsed) {
            Utils.toast("已切换稳定兜底回复", "warning");
        }
        const speechBody = fixedDigestMessage ? `${fixedDigestMessage}。${res.data?.speechText || aiText}` : (res.data?.speechText || aiText);
        speakText(speechBody);
    } catch (error) {
        removeChatMessage(pendingMessageId);
        addChatMessage(error.message || "AI 服务暂时不可用，请稍后重试。", "ai");
    } finally {
        setChatPendingState(false);
    }
}

function addChatMessage(content, role, options = {}) {
    const wrapper = document.getElementById("chat-messages");
    if (!wrapper) {
        return "";
    }
    const messageId = options.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const node = document.createElement("div");
    node.className = `message ${role === "ai" ? "ai-message" : "user-message"}${options.pending ? " ai-pending" : ""}`;
    node.dataset.messageId = messageId;
    node.style.width = "100%";
    node.style.display = "flex";
    node.style.justifyContent = role === "ai" ? "flex-start" : "flex-end";
    node.innerHTML = role === "ai"
        ? `<div class="message-avatar"><i class="fas fa-robot"></i></div><div class="message-content">${formatMessageText(content)}</div>`
        : `<div class="message-content">${formatMessageText(content)}</div><div class="message-avatar"><i class="fas fa-user"></i></div>`;
    wrapper.appendChild(node);
    wrapper.scrollTop = wrapper.scrollHeight;
    return messageId;
}

function removeChatMessage(messageId) {
    if (!messageId) {
        return;
    }
    const wrapper = document.getElementById("chat-messages");
    const node = wrapper?.querySelector(`.message[data-message-id="${messageId}"]`);
    if (node) {
        node.remove();
    }
}

function formatMessageText(content) {
    const escaped = String(content || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    return escaped.replace(/\n/g, "<br>");
}

function setChatPendingState(pending) {
    state.chatRequestPending = pending;
    const input = document.getElementById("chat-input");
    const sendButton = document.getElementById("chat-send-btn");
    if (input) {
        input.disabled = pending;
    }
    if (sendButton) {
        sendButton.disabled = pending;
        sendButton.innerHTML = pending ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
    }
}


async function refreshFrontendContentSnapshot() {
    const now = Date.now();
    if (now - state.lastFrontendSnapshotAt < 45000) {
        return;
    }
    const [venueRes, noticeRes, serviceRes, reservationRes, repairRes] = await Promise.allSettled([
        ApiService.get("/venue/list"),
        ApiService.get("/notice/published"),
        ApiService.get("/service/list"),
        ApiService.get("/reservation/list"),
        ApiService.get("/repair/list")
    ]);
    if (venueRes.status === "fulfilled") {
        state.venues = Array.isArray(venueRes.value.data) ? venueRes.value.data : [];
    }
    if (noticeRes.status === "fulfilled") {
        state.notices = Array.isArray(noticeRes.value.data) ? noticeRes.value.data : [];
    }
    if (serviceRes.status === "fulfilled") {
        state.services = Array.isArray(serviceRes.value.data) ? serviceRes.value.data : [];
    }
    if (reservationRes.status === "fulfilled") {
        state.reservations = Array.isArray(reservationRes.value.data) ? reservationRes.value.data : [];
    }
    if (repairRes.status === "fulfilled") {
        state.repairs = Array.isArray(repairRes.value.data) ? repairRes.value.data : [];
    }
    state.lastFrontendSnapshotAt = now;
}
function collectFrontendContext() {
    const currentView = state.activeContentId || "home";
    const activeContainer = currentView === "home" ? document.querySelector(".main-content") : document.getElementById(currentView);
    if (!activeContainer) {
        return {
            currentView,
            userName: state.currentUser.name,
            visibleCardCount: 0,
            quickFacts: [],
            visibleTexts: []
        };
    }
    const visibleCards = activeContainer.querySelectorAll(".venue-card, .service-item, .repair-card").length;
    const quickFacts = [];
    if (state.venues.length) {
        quickFacts.push(`场地数量:${state.venues.length}`);
    }
    if (state.notices.length) {
        quickFacts.push(`通知数量:${state.notices.length}`);
    }
    if (state.services.length) {
        quickFacts.push(`服务数量:${state.services.length}`);
    }
    if (state.reservations.length) {
        quickFacts.push(`预约记录:${state.reservations.length}`);
    }
    if (state.repairs.length) {
        quickFacts.push(`报修记录:${state.repairs.length}`);
    }
    const visibleTexts = Array.from(activeContainer.querySelectorAll("h2, h3, p"))
        .map((el) => el.textContent?.trim() || "")
        .filter(Boolean)
        .slice(0, 12);
    const venueAvailabilityDigest = buildVenueAvailabilityDigest(state.venues);
    return {
        currentView,
        userName: state.currentUser.name,
        visibleCardCount: visibleCards,
        quickFacts,
        visibleTexts,
        venueAvailabilityDigest,
        venueStatusList: state.venues.slice(0, 8).map((v) => ({
            name: v.name,
            status: v.status,
            location: v.location
        })),
        latestNotices: state.notices.slice(0, 5).map((n) => ({
            title: n.title,
            author: n.author,
            type: n.type
        })),
        topServices: state.services.slice(0, 6).map((s) => ({
            name: s.name,
            provider: s.provider,
            status: s.status,
            rating: s.rating
        })),
        reservationHighlights: state.reservations.slice(0, 8).map((r) => ({
            venue_name: r.venue_name,
            date: r.date,
            time_slot: r.time_slot,
            status: r.status
        })),
        repairHighlights: state.repairs.slice(0, 8).map((r) => ({
            title: r.title,
            venue_name: r.venue_name,
            status: r.status,
            priority: r.priority
        }))
    };
}

function buildVenueAvailabilityDigest(venues = []) {
    if (!Array.isArray(venues) || venues.length === 0) {
        return [];
    }
    const groups = {};
    const normalizeName = (name = "") => {
        if (name.includes("会议室")) return "会议室";
        if (name.includes("乒乓")) return "乒乓球室";
        if (name.includes("健身")) return "健身房";
        if (name.includes("图书")) return "图书阅览室";
        return name;
    };
    const toAvailability = (status = "") => {
        return status === "available" ? "有空" : "没空";
    };
    venues.forEach((venue) => {
        const key = normalizeName(venue.name || "场地");
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(toAvailability(venue.status));
    });
    return Object.entries(groups).map(([name, statuses]) => {
        const hasAvailable = statuses.includes("有空");
        return `${name}${hasAvailable ? "有空" : "没空"}`;
    });
}

function buildVenueAvailabilitySentence(digestList = []) {
    if (!Array.isArray(digestList) || digestList.length === 0) {
        return "";
    }
    return digestList.join("，");
}

function initChatVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        state.chatVoiceRecognition = null;
        return;
    }
    if (state.chatVoiceRecognition) {
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const input = document.getElementById("chat-input");
        if (input) {
            input.value = text;
        }
        stopChatVoiceInput();
        sendMessage(text);
    };
    recognition.onerror = () => {
        stopChatVoiceInput();
    };
    recognition.onend = () => {
        stopChatVoiceInput();
    };
    state.chatVoiceRecognition = recognition;
}

function toggleChatVoiceInput() {
    if (state.chatVoiceRecording) {
        stopChatVoiceInput();
        return;
    }
    if (!state.chatVoiceRecognition) {
        Utils.toast("当前浏览器不支持语音识别", "warning");
        return;
    }
    try {
        state.chatVoiceRecognition.start();
        state.chatVoiceRecording = true;
        const btn = document.getElementById("chat-voice-btn");
        if (btn) {
            btn.classList.add("recording");
            btn.innerHTML = '<i class="fas fa-circle"></i> 识别中...';
        }
    } catch (error) {
        Utils.toast("语音识别启动失败，请重试", "warning");
    }
}

function stopChatVoiceInput() {
    state.chatVoiceRecording = false;
    if (state.chatVoiceRecognition) {
        try {
            state.chatVoiceRecognition.stop();
        } catch (error) {}
    }
    const btn = document.getElementById("chat-voice-btn");
    if (btn) {
        btn.classList.remove("recording");
        btn.innerHTML = '<i class="fas fa-microphone"></i> 语音输入';
    }
}

function speakText(text) {
    if (!state.speakingEnabled || !window.speechSynthesis || !text) {
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    Utils.toast("已停止语音播报", "info");
}

async function askFrontendInfo() {
    await sendMessage("请基于最近信息先做汇报式播报，例如“会议室有空、乒乓球室有空、健身房没空”，再补充最近公示和便民服务建议。", true);
}

function handleSearch(event) {
    if (event.key !== "Enter") {
        return;
    }
    const keyword = event.target.value.trim();
    if (!keyword) {
        return;
    }
    if (keyword.includes("预约") || keyword.includes("场地")) {
        showVenueBooking();
        return;
    }
    if (keyword.includes("报修")) {
        showRepairReport();
        return;
    }
    if (keyword.includes("通知") || keyword.includes("政策")) {
        showPolicyQuery();
        return;
    }
    showConvenienceServices();
}

function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const input = document.getElementById("search-input");
        if (!input) {
            return;
        }
        input.value = text;
        handleSearch({ key: "Enter", target: input });
    };
    state.voiceRecognition = recognition;
}

function startVoiceSearch() {
    if (!state.voiceRecognition) {
        Utils.toast("当前浏览器不支持语音识别", "warning");
        return;
    }
    state.voiceRecognition.start();
}

window.handleSearch = handleSearch;
window.startVoiceSearch = startVoiceSearch;
window.showAIAssistant = showAIAssistant;
window.askFrontendInfo = askFrontendInfo;
window.toggleChatVoiceInput = toggleChatVoiceInput;
window.stopSpeaking = stopSpeaking;
window.showPolicyQuery = showPolicyQuery;
window.showConvenienceServices = showConvenienceServices;
window.showConvenienceStores = showConvenienceStores;
window.showUserCenter = showUserCenter;
window.quickBookVenue = quickBookVenue;
window.submitBooking = submitBooking;
window.submitRepair = submitRepair;
window.handleChatKeyPress = handleChatKeyPress;
window.sendMessage = sendMessage;
window.cancelReservation = cancelReservation;
window.logoutCurrentUser = logoutCurrentUser;

document.addEventListener("DOMContentLoaded", () => {
    bootstrap().catch((error) => Utils.toast(error.message || "页面初始化失败", "error"));
});
