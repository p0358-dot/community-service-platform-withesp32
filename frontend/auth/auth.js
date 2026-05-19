const AUTH_STORAGE_KEY = "community_auth_session";
const API_BASE_URL = `${window.location.origin}/api`;

function parseQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
        role: params.get("role") || "user",
        redirect: params.get("redirect") || "/user/"
    };
}

function setError(message) {
    const errorNode = document.getElementById("auth-error");
    if (errorNode) {
        errorNode.textContent = message || "";
    }
}

function saveSession(token, user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }));
}

async function apiRequest(path, payload) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "请求失败");
    }
    return data;
}

function bindLoginPage() {
    const { role, redirect } = parseQuery();
    const roleNode = document.getElementById("role");
    const usernameNode = document.getElementById("username");
    const passwordNode = document.getElementById("password");
    const registerLink = document.querySelector('.auth-links a[href="/auth/register.html"]');
    const syncAdminMode = () => {
        const selectedRole = roleNode?.value || role;
        const isAdmin = selectedRole === "admin";
        if (isAdmin) {
            if (usernameNode) {
                usernameNode.value = "root";
                usernameNode.readOnly = true;
            }
            if (passwordNode) {
                passwordNode.value = "123456";
                passwordNode.readOnly = true;
            }
            if (registerLink) {
                registerLink.style.display = "none";
            }
            return;
        }
        if (usernameNode) {
            usernameNode.readOnly = false;
        }
        if (passwordNode) {
            passwordNode.readOnly = false;
        }
        if (registerLink) {
            registerLink.style.display = "";
        }
    };
    if (roleNode) {
        roleNode.value = role;
        roleNode.addEventListener("change", syncAdminMode);
    }
    syncAdminMode();

    const loginForm = document.getElementById("login-form");
    if (!loginForm) {
        return;
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setError("");
        const username = document.getElementById("username")?.value?.trim();
        const password = document.getElementById("password")?.value || "";
        const selectedRole = document.getElementById("role")?.value || role;
        if (!username || !password) {
            setError("请输入用户名和密码");
            return;
        }
        try {
            const result = await apiRequest("/user/login", {
                username,
                password,
                role: selectedRole
            });
            saveSession(result.data.token, result.data.user);
            const target = selectedRole === "admin" ? "/admin/" : redirect;
            window.location.href = target;
        } catch (error) {
            setError(error.message || "登录失败");
        }
    });
}

function bindRegisterPage() {
    const { role } = parseQuery();
    const registerForm = document.getElementById("register-form");
    if (!registerForm) {
        return;
    }
    if (role === "admin") {
        window.location.href = "/auth/login.html?role=admin";
        return;
    }

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setError("");
        const username = document.getElementById("username")?.value?.trim();
        const name = document.getElementById("name")?.value?.trim();
        const phone = document.getElementById("phone")?.value?.trim();
        const email = document.getElementById("email")?.value?.trim();
        const password = document.getElementById("password")?.value || "";
        const passwordConfirm = document.getElementById("password-confirm")?.value || "";
        if (!username || !password) {
            setError("用户名和密码不能为空");
            return;
        }
        if (password !== passwordConfirm) {
            setError("两次输入的密码不一致");
            return;
        }
        try {
            await apiRequest("/user/register", {
                username,
                password,
                name,
                phone,
                email
            });
            window.location.href = `/auth/login.html?role=${encodeURIComponent(role || "user")}&redirect=${encodeURIComponent("/user/")}`;
        } catch (error) {
            setError(error.message || "注册失败");
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    bindLoginPage();
    bindRegisterPage();
});
