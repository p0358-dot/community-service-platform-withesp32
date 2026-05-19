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
    clearSession() {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    },
    getToken() {
        return this.getSession()?.token || "";
    },
    ensureAdminAccess() {
        const session = this.getSession();
        if (!session?.token || !session?.user || session.user.role !== "admin") {
            this.clearSession();
            window.location.href = `/auth/login.html?role=admin&redirect=${encodeURIComponent(window.location.pathname)}`;
            return false;
        }
        return true;
    }
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
            window.location.href = `/auth/login.html?role=admin&redirect=${encodeURIComponent(window.location.pathname)}`;
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

    static put(path, payload) {
        return this.request(path, {
            method: "PUT",
            body: JSON.stringify(payload)
        });
    }

    static post(path, payload) {
        return this.request(path, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }
}

const adminState = {
    aiHistory: [],
    aiPending: false
};

const Utils = {
    toast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<div class="toast-content"><span>${message}</span></div>`;
        const container = document.querySelector(".toast-container");
        if (!container) {
            return;
        }
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    },

    showContent(contentId) {
        const dashboard = document.getElementById("dashboard-content");
        if (dashboard) {
            dashboard.style.display = "none";
        }
        document.querySelectorAll(".content-area").forEach((el) => (el.style.display = "none"));
        const target = document.getElementById(contentId);
        if (target) {
            target.style.display = "block";
        }
        const backButton = document.querySelector(".back-button");
        if (backButton) {
            backButton.style.display = "flex";
        }
        this.updateBreadcrumb(contentId);
        this.updateNav(contentId);
    },

    showMainPage() {
        document.querySelectorAll(".content-area").forEach((el) => (el.style.display = "none"));
        const dashboard = document.getElementById("dashboard-content");
        if (dashboard) {
            dashboard.style.display = "block";
        }
        const backButton = document.querySelector(".back-button");
        if (backButton) {
            backButton.style.display = "none";
        }
        this.updateBreadcrumb("dashboard");
        this.updateNav("dashboard");
    },

    updateBreadcrumb(contentId) {
        const textMap = {
            dashboard: "仪表盘",
            "venue-management": "场地管理",
            "user-management": "用户管理",
            "reservation-management": "预约管理",
            "repair-management": "报修管理",
            "notice-management": "通知管理",
            "service-management": "服务管理",
            statistics: "数据统计",
            "admin-ai-assistant": "AI助手"
        };
        const el = document.querySelector(".breadcrumb-item");
        if (el) {
            el.textContent = textMap[contentId] || "管理系统";
        }
    },

    updateNav(contentId) {
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
        const map = {
            dashboard: "showDashboard()",
            "venue-management": "showVenueManagement()",
            "user-management": "showUserManagement()",
            "reservation-management": "showReservationManagement()",
            "repair-management": "showRepairManagement()",
            "notice-management": "showNoticeManagement()",
            "service-management": "showServiceManagement()",
            statistics: "showStatistics()",
            "admin-ai-assistant": "showAdminAIAssistant()"
        };
        const onclick = map[contentId];
        if (!onclick) {
            return;
        }
        const active = document.querySelector(`.nav-item[onclick="${onclick}"]`);
        if (active) {
            active.classList.add("active");
        }
    },

    statusText(status) {
        const map = {
            pending: "待处理",
            processing: "处理中",
            approved: "已通过",
            rejected: "已拒绝",
            completed: "已完成",
            cancelled: "已取消",
            active: "可用",
            inactive: "暂停",
            published: "已发布",
            draft: "草稿",
            archived: "已归档",
            available: "可用",
            occupied: "占用",
            maintenance: "维护中",
            closed: "关闭"
        };
        return map[status] || status;
    }
};

async function refreshDashboard() {
    const [overviewRes, venueRes, reservationRes, repairRes] = await Promise.all([
        ApiService.get("/statistics/overview"),
        ApiService.get("/venue/list"),
        ApiService.get("/reservation/list"),
        ApiService.get("/repair/list")
    ]);
    const overview = overviewRes.data || {};
    const venues = venueRes.data || [];
    const reservations = reservationRes.data || [];
    const repairs = repairRes.data || [];
    const cards = document.querySelectorAll(".stats-grid .stat-card");
    if (cards[0]) {
        const h3 = cards[0].querySelector("h3");
        if (h3) h3.textContent = overview.totalUsers ?? 0;
    }
    if (cards[1]) {
        const h3 = cards[1].querySelector("h3");
        if (h3) h3.textContent = overview.totalVenues ?? venues.length;
    }
    if (cards[2]) {
        const h3 = cards[2].querySelector("h3");
        if (h3) h3.textContent = overview.todayReservations ?? reservations.length;
    }
    if (cards[3]) {
        const h3 = cards[3].querySelector("h3");
        if (h3) h3.textContent = repairs.filter((r) => r.status === "pending").length;
    }
}

async function showDashboard() {
    Utils.showMainPage();
    try {
        await refreshDashboard();
    } catch (error) {
        Utils.toast(error.message || "加载仪表盘失败", "error");
    }
}

async function showVenueManagement() {
    Utils.showContent("venue-management");
    try {
        const res = await ApiService.get("/venue/list");
        const venues = res.data || [];
        const el = document.getElementById("venue-management");
        el.innerHTML = `<div class="page-header"><h2><i class="fas fa-building"></i> 场地管理</h2><p>更新场地状态</p></div><div class="repairs-grid">${venues.map((v) => `
            <div class="repair-card">
                <div class="repair-header"><h4>${v.name}</h4><span class="status-badge status-${v.status}">${Utils.statusText(v.status)}</span></div>
                <div class="repair-info"><p>类型：${v.type}</p><p>容量：${v.capacity} 人</p><p>位置：${v.location}</p></div>
                <div class="repair-actions"><select class="status-select" onchange="updateVenueStatus(${v.id}, this.value)"><option value="available" ${v.status === "available" ? "selected" : ""}>可用</option><option value="occupied" ${v.status === "occupied" ? "selected" : ""}>占用</option><option value="maintenance" ${v.status === "maintenance" ? "selected" : ""}>维护中</option><option value="closed" ${v.status === "closed" ? "selected" : ""}>关闭</option></select></div>
            </div>
        `).join("")}</div>`;
    } catch (error) {
        Utils.toast(error.message || "加载场地数据失败", "error");
    }
}

async function showUserManagement() {
    Utils.showContent("user-management");
    try {
        const res = await ApiService.get("/user/list");
        const users = res.data || [];
        const el = document.getElementById("user-management");
        el.innerHTML = `<div class="page-header"><h2><i class="fas fa-users"></i> 用户管理</h2><p>查看平台注册用户</p></div><div class="reservations-table"><table class="data-table"><thead><tr><th>ID</th><th>用户名</th><th>姓名</th><th>电话</th><th>邮箱</th></tr></thead><tbody>${users.map((u) => `<tr><td>${u.id}</td><td>${u.username}</td><td>${u.name}</td><td>${u.phone || "-"}</td><td>${u.email || "-"}</td></tr>`).join("")}</tbody></table></div>`;
    } catch (error) {
        Utils.toast(error.message || "加载用户数据失败", "error");
    }
}

async function showReservationManagement() {
    Utils.showContent("reservation-management");
    try {
        const res = await ApiService.get("/reservation/list");
        const reservations = res.data || [];
        const el = document.getElementById("reservation-management");
        el.innerHTML = `<div class="page-header"><h2><i class="fas fa-calendar-alt"></i> 预约管理</h2><p>审核与更新预约状态</p></div><div class="reservations-table"><table class="data-table"><thead><tr><th>ID</th><th>场地</th><th>用户</th><th>日期</th><th>时间段</th><th>状态</th><th>操作</th></tr></thead><tbody>${reservations.map((r) => `<tr><td>${r.id}</td><td>${r.venue_name || "-"}</td><td>${r.username || "-"}</td><td>${r.date}</td><td>${r.time_slot}</td><td>${Utils.statusText(r.status)}</td><td><select class="status-select" onchange="updateReservationStatus(${r.id}, this.value)"><option value="pending" ${r.status === "pending" ? "selected" : ""}>待审核</option><option value="approved" ${r.status === "approved" ? "selected" : ""}>已通过</option><option value="rejected" ${r.status === "rejected" ? "selected" : ""}>已拒绝</option><option value="completed" ${r.status === "completed" ? "selected" : ""}>已完成</option><option value="cancelled" ${r.status === "cancelled" ? "selected" : ""}>已取消</option></select></td></tr>`).join("")}</tbody></table></div>`;
    } catch (error) {
        Utils.toast(error.message || "加载预约数据失败", "error");
    }
}

async function showRepairManagement() {
    Utils.showContent("repair-management");
    try {
        const res = await ApiService.get("/repair/list");
        const repairs = res.data || [];
        const el = document.getElementById("repair-management");
        el.innerHTML = `<div class="page-header"><h2><i class="fas fa-tools"></i> 报修管理</h2><p>处理居民报修工单</p></div><div class="repairs-grid">${repairs.map((r) => `<div class="repair-card"><div class="repair-header"><h4>${r.title}</h4><span class="status-badge status-${r.status}">${Utils.statusText(r.status)}</span></div><div class="repair-info"><p>用户：${r.user_name || "-"}</p><p>场地：${r.venue_name || "-"}</p><p>优先级：${r.priority}</p><p>${r.description}</p></div><div class="repair-actions"><select class="status-select" onchange="updateRepairStatus(${r.id}, this.value)"><option value="pending" ${r.status === "pending" ? "selected" : ""}>待处理</option><option value="processing" ${r.status === "processing" ? "selected" : ""}>处理中</option><option value="completed" ${r.status === "completed" ? "selected" : ""}>已完成</option><option value="cancelled" ${r.status === "cancelled" ? "selected" : ""}>已取消</option></select></div></div>`).join("")}</div>`;
    } catch (error) {
        Utils.toast(error.message || "加载报修数据失败", "error");
    }
}

async function showNoticeManagement() {
    Utils.showContent("notice-management");
    try {
        const res = await ApiService.get("/notice/list");
        const notices = res.data || [];
        const el = document.getElementById("notice-management");
        el.innerHTML = `<div class="page-header"><h2><i class="fas fa-bullhorn"></i> 通知管理</h2><p>管理通知发布状态</p></div><div class="notices-grid">${notices.map((n) => `<div class="notice-card"><div class="notice-header"><h4>${n.title}</h4><span class="type-badge type-${n.type}">${n.type}</span></div><div class="notice-content"><p>${n.content}</p><div class="notice-meta"><span>${n.author || "-"}</span></div></div><div class="notice-actions"><select class="status-select" onchange="updateNoticeStatus(${n.id}, this.value)"><option value="draft" ${n.status === "draft" ? "selected" : ""}>草稿</option><option value="published" ${n.status === "published" ? "selected" : ""}>已发布</option><option value="archived" ${n.status === "archived" ? "selected" : ""}>已归档</option></select></div></div>`).join("")}</div>`;
    } catch (error) {
        Utils.toast(error.message || "加载通知数据失败", "error");
    }
}

async function showServiceManagement() {
    Utils.showContent("service-management");
    try {
        const res = await ApiService.get("/service/list");
        const services = res.data || [];
        const el = document.getElementById("service-management");
        el.innerHTML = `<div class="page-header"><h2><i class="fas fa-concierge-bell"></i> 服务管理</h2><p>管理便民服务状态</p></div><div class="services-grid">${services.map((s) => `<div class="service-card"><div class="service-header"><h4>${s.name}</h4><span class="rating">${s.rating}</span></div><div class="service-info"><p>提供方：${s.provider}</p><p>${s.description || ""}</p></div><div class="service-actions"><select class="status-select" onchange="updateServiceStatus(${s.id}, this.value)"><option value="active" ${s.status === "active" ? "selected" : ""}>可用</option><option value="inactive" ${s.status === "inactive" ? "selected" : ""}>暂停</option></select></div></div>`).join("")}</div>`;
    } catch (error) {
        Utils.toast(error.message || "加载服务数据失败", "error");
    }
}

async function showStatistics() {
    Utils.showContent("statistics");
    try {
        const [overviewRes, serviceRes, deviceRes] = await Promise.all([
            ApiService.get("/statistics/overview"),
            ApiService.get("/statistics/services"),
            ApiService.get("/statistics/devices")
        ]);
        const overview = overviewRes.data || {};
        const services = serviceRes.data || [];
        const devices = deviceRes.data || {};
        const el = document.getElementById("statistics");
        el.innerHTML = `<div class="page-header"><h2><i class="fas fa-chart-bar"></i> 数据统计</h2><p>关键运营指标</p></div><div class="repairs-grid"><div class="repair-card"><h4>总体数据</h4><p>用户总数：${overview.totalUsers ?? 0}</p><p>场地总数：${overview.totalVenues ?? 0}</p><p>预约总数：${overview.totalReservations ?? 0}</p><p>待处理报修：${overview.pendingRepairs ?? 0}</p></div><div class="repair-card"><h4>设备状态</h4><p>设备总数：${devices.total ?? 0}</p><p>在线：${devices.online ?? 0}</p><p>离线：${devices.offline ?? 0}</p><p>维护中：${devices.maintenance ?? 0}</p></div><div class="repair-card"><h4>场地使用率</h4>${services.slice(0, 5).map((s) => `<p>${s.name}: ${s.usage ?? 0}%</p>`).join("")}</div></div>`;
    } catch (error) {
        Utils.toast(error.message || "加载统计数据失败", "error");
    }
}

async function updateVenueStatus(id, status) {
    await ApiService.put(`/venue/${id}/status`, { status });
    Utils.toast("场地状态已更新", "success");
    showVenueManagement();
}

async function updateReservationStatus(id, status) {
    await ApiService.put(`/reservation/${id}/status`, { status });
    Utils.toast("预约状态已更新", "success");
    showReservationManagement();
}

async function updateRepairStatus(id, status) {
    await ApiService.put(`/repair/${id}/status`, { status });
    Utils.toast("报修状态已更新", "success");
    showRepairManagement();
}

async function updateNoticeStatus(id, status) {
    await ApiService.put(`/notice/${id}/status`, { status });
    Utils.toast("通知状态已更新", "success");
    showNoticeManagement();
}

async function updateServiceStatus(id, status) {
    await ApiService.put(`/service/${id}/status`, { status });
    Utils.toast("服务状态已更新", "success");
    showServiceManagement();
}

function showMainPage() {
    Utils.showMainPage();
}

function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
        sidebar.classList.toggle("open");
    }
}

function closeHeaderMenus() {
    document.querySelectorAll(".menu-panel.open").forEach((panel) => panel.classList.remove("open"));
}

function toggleNotificationMenu(event) {
    event?.stopPropagation();
    const panel = document.getElementById("notification-panel");
    if (!panel) {
        return;
    }
    const shouldOpen = !panel.classList.contains("open");
    closeHeaderMenus();
    if (shouldOpen) {
        panel.classList.add("open");
    }
}

function toggleUserMenu(event) {
    event?.stopPropagation();
    const panel = document.getElementById("user-panel");
    if (!panel) {
        return;
    }
    const shouldOpen = !panel.classList.contains("open");
    closeHeaderMenus();
    if (shouldOpen) {
        panel.classList.add("open");
    }
}

async function logoutAdmin() {
    try {
        await ApiService.post("/user/logout", {});
    } catch (error) {}
    Auth.clearSession();
    window.location.href = `/auth/login.html?role=admin&redirect=${encodeURIComponent("/admin/")}`;
}

function showAdminAIAssistant() {
    Utils.showContent("admin-ai-assistant");
    const el = document.getElementById("admin-ai-assistant");
    if (!el) {
        return;
    }
    el.innerHTML = `<div class="page-header"><h2><i class="fas fa-robot"></i> 管理员 AI 助手</h2><p>支持结论优先、风险感知与下一步建议</p></div><div class="repair-card" style="display:flex;flex-direction:column;gap:14px;"><div id="admin-ai-messages" style="height:360px;overflow-y:auto;background:#f8fafc;border-radius:12px;padding:12px;"></div><div style="display:flex;gap:8px;align-items:center;"><input id="admin-ai-input" placeholder="例如：总结当前预约与报修风险，并给处理优先级" style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;" onkeypress="handleAdminAIKeyPress(event)"><button id="admin-ai-send" class="action-btn" style="width:auto;padding:10px 16px;" onclick="sendAdminAIMessage()">发送</button></div></div>`;
    if (!adminState.aiHistory.length) {
        pushAdminAIMessage("assistant", "您好，我是管理员助手。您可以让我汇总预约风险、报修优先级、通知投放建议。");
    } else {
        adminState.aiHistory.forEach((item) => pushAdminAIMessage(item.role, item.content));
    }
}

function handleAdminAIKeyPress(event) {
    if (event.key === "Enter") {
        sendAdminAIMessage();
    }
}

async function sendAdminAIMessage() {
    if (adminState.aiPending) {
        return;
    }
    const input = document.getElementById("admin-ai-input");
    if (!input) {
        return;
    }
    const message = input.value.trim();
    if (!message) {
        return;
    }
    input.value = "";
    pushAdminAIMessage("user", message);
    adminState.aiHistory.push({ role: "user", content: message });
    adminState.aiHistory = adminState.aiHistory.slice(-20);
    const pendingId = pushAdminAIMessage("assistant", "正在分析管理数据，请稍候...", true);
    setAdminAIPending(true);
    try {
        const context = await collectAdminAIContext();
        const res = await ApiService.post("/ai/chat", {
            message,
            userId: 1,
            sessionId: "admin-console",
            history: adminState.aiHistory.slice(-10),
            frontendContext: context
        });
        removeAdminAIMessage(pendingId);
        const text = res.data?.message || "AI 当前不可用";
        pushAdminAIMessage("assistant", text);
        adminState.aiHistory.push({ role: "assistant", content: text });
        adminState.aiHistory = adminState.aiHistory.slice(-20);
    } catch (error) {
        removeAdminAIMessage(pendingId);
        pushAdminAIMessage("assistant", error.message || "服务暂时不可用，请稍后重试");
    } finally {
        setAdminAIPending(false);
    }
}

async function collectAdminAIContext() {
    const [overviewRes, reservationRes, repairRes, noticeRes, venueRes] = await Promise.allSettled([
        ApiService.get("/statistics/overview"),
        ApiService.get("/reservation/list"),
        ApiService.get("/repair/list"),
        ApiService.get("/notice/list"),
        ApiService.get("/venue/list")
    ]);
    const overview = overviewRes.status === "fulfilled" ? (overviewRes.value.data || {}) : {};
    const reservations = reservationRes.status === "fulfilled" ? (reservationRes.value.data || []) : [];
    const repairs = repairRes.status === "fulfilled" ? (repairRes.value.data || []) : [];
    const notices = noticeRes.status === "fulfilled" ? (noticeRes.value.data || []) : [];
    const venues = venueRes.status === "fulfilled" ? (venueRes.value.data || []) : [];
    return {
        currentView: "admin-ai-assistant",
        quickFacts: [
            `注册用户:${overview.totalUsers || 0}`,
            `场地总数:${overview.totalVenues || venues.length}`,
            `预约总数:${overview.totalReservations || reservations.length}`,
            `待处理报修:${overview.pendingRepairs || repairs.filter((r) => r.status === "pending").length}`
        ],
        reservationHighlights: reservations.slice(0, 8).map((r) => ({
            venue_name: r.venue_name,
            date: r.date,
            time_slot: r.time_slot,
            status: r.status
        })),
        repairHighlights: repairs.slice(0, 8).map((r) => ({
            title: r.title,
            priority: r.priority,
            status: r.status
        })),
        latestNotices: notices.slice(0, 8).map((n) => ({
            title: n.title,
            type: n.type,
            status: n.status
        })),
        venueStatusList: venues.slice(0, 8).map((v) => ({
            name: v.name,
            status: v.status
        }))
    };
}

function pushAdminAIMessage(role, content, pending = false) {
    const wrapper = document.getElementById("admin-ai-messages");
    if (!wrapper) {
        return "";
    }
    const id = `admin_msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const bubble = document.createElement("div");
    bubble.dataset.messageId = id;
    bubble.style.marginBottom = "10px";
    bubble.style.display = "flex";
    bubble.style.justifyContent = role === "user" ? "flex-end" : "flex-start";
    bubble.innerHTML = `<div style="max-width:78%;padding:10px 12px;border-radius:10px;line-height:1.55;${role === "user" ? "background:#16a34a;color:#ffffff;" : "background:#e2e8f0;color:#0f172a;"}${pending ? "opacity:0.75;" : ""}">${escapeAdminHtml(content).replace(/\n/g, "<br>")}</div>`;
    wrapper.appendChild(bubble);
    wrapper.scrollTop = wrapper.scrollHeight;
    return id;
}

function removeAdminAIMessage(messageId) {
    const wrapper = document.getElementById("admin-ai-messages");
    const node = wrapper?.querySelector(`[data-message-id="${messageId}"]`);
    if (node) {
        node.remove();
    }
}

function setAdminAIPending(pending) {
    adminState.aiPending = pending;
    const input = document.getElementById("admin-ai-input");
    const button = document.getElementById("admin-ai-send");
    if (input) {
        input.disabled = pending;
    }
    if (button) {
        button.disabled = pending;
        button.textContent = pending ? "处理中..." : "发送";
    }
}

function escapeAdminHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

window.showDashboard = showDashboard;
window.showVenueManagement = showVenueManagement;
window.showUserManagement = showUserManagement;
window.showReservationManagement = showReservationManagement;
window.showRepairManagement = showRepairManagement;
window.showNoticeManagement = showNoticeManagement;
window.showServiceManagement = showServiceManagement;
window.showStatistics = showStatistics;
window.showMainPage = showMainPage;
window.toggleSidebar = toggleSidebar;
window.toggleNotificationMenu = toggleNotificationMenu;
window.toggleUserMenu = toggleUserMenu;
window.showAdminAIAssistant = showAdminAIAssistant;
window.sendAdminAIMessage = sendAdminAIMessage;
window.handleAdminAIKeyPress = handleAdminAIKeyPress;
window.updateVenueStatus = updateVenueStatus;
window.updateReservationStatus = updateReservationStatus;
window.updateRepairStatus = updateRepairStatus;
window.updateNoticeStatus = updateNoticeStatus;
window.updateServiceStatus = updateServiceStatus;
window.logoutAdmin = logoutAdmin;

document.addEventListener("DOMContentLoaded", () => {
    if (!Auth.ensureAdminAccess()) {
        return;
    }
    const sessionUser = Auth.getSession()?.user;
    if (sessionUser) {
        const displayName = sessionUser.name || sessionUser.username || "管理员";
        document.querySelectorAll(".profile-name, .menu-profile-name").forEach((el) => {
            el.textContent = displayName;
        });
    }
    document.addEventListener("click", (event) => {
        if (!event.target.closest(".header-menu")) {
            closeHeaderMenus();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeHeaderMenus();
        }
    });
    showDashboard().catch((error) => Utils.toast(error.message || "初始化失败", "error"));
    setInterval(() => {
        const dashboardVisible = document.getElementById("dashboard-content")?.style.display !== "none";
        if (dashboardVisible) {
            refreshDashboard().catch(() => {});
        }
    }, 30000);
});
