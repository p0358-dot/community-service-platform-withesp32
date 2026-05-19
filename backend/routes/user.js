const express = require('express');
const router = express.Router();
const db = require('../database/db');

function getBearerToken(req) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
        return '';
    }
    return auth.slice(7).trim();
}

router.post('/register', async (req, res) => {
    try {
        const { username, password, name, phone = '', email = '' } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: '用户名和密码不能为空'
            });
        }
        if (String(password).length < 6) {
            return res.status(400).json({
                success: false,
                error: '密码长度不能小于6位'
            });
        }
        if (String(username).trim().toLowerCase() === 'root') {
            return res.status(400).json({
                success: false,
                error: '该用户名不可注册'
            });
        }
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: '用户名已存在'
            });
        }
        const userId = await db.createUser({
            username: String(username).trim(),
            password: String(password),
            name: String(name || username).trim(),
            phone: String(phone || '').trim(),
            email: String(email || '').trim(),
            role: 'user'
        });
        const user = await db.getUserById(userId);
        const token = await db.createSession(userId);
        res.json({
            success: true,
            data: {
                token,
                user
            },
            message: '注册成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '注册失败',
            message: error.message
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: '用户名和密码不能为空'
            });
        }
        if (role === 'admin') {
            if (String(username).trim() !== 'root' || String(password) !== '123456') {
                return res.status(401).json({
                    success: false,
                    error: '控制端账号或密码错误'
                });
            }
            const adminUser = await db.getUserAuthByUsername('root');
            if (!adminUser || adminUser.role !== 'admin') {
                return res.status(500).json({
                    success: false,
                    error: '控制端账号不可用'
                });
            }
            const token = await db.createSession(adminUser.id);
            const safeUser = await db.getUserById(adminUser.id);
            return res.json({
                success: true,
                data: {
                    token,
                    user: safeUser
                },
                message: '登录成功'
            });
        }
        const user = await db.getUserAuthByUsername(String(username).trim());
        if (!user || !db.verifyPassword(String(password), user.password_hash, user.salt)) {
            return res.status(401).json({
                success: false,
                error: '用户名或密码错误'
            });
        }
        if (role && user.role !== role) {
            return res.status(403).json({
                success: false,
                error: '账号角色不匹配'
            });
        }
        const token = await db.createSession(user.id);
        const safeUser = await db.getUserById(user.id);
        res.json({
            success: true,
            data: {
                token,
                user: safeUser
            },
            message: '登录成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '登录失败',
            message: error.message
        });
    }
});

router.post('/logout', async (req, res) => {
    try {
        const token = getBearerToken(req);
        if (token) {
            await db.deleteSession(token);
        }
        res.json({
            success: true,
            message: '已退出登录'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '退出失败',
            message: error.message
        });
    }
});

router.get('/me', async (req, res) => {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                error: '未登录'
            });
        }
        const user = await db.getUserByToken(token);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: '登录已过期'
            });
        }
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取当前用户失败',
            message: error.message
        });
    }
});

// 获取用户列表
router.get('/list', async (req, res) => {
    try {
        const users = await db.getAllUsers();
        res.json({
            success: true,
            data: users,
            total: users.length
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '获取用户列表失败',
            message: error.message 
        });
    }
});

// 获取用户详情
router.get('/:id(\\d+)', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await db.getUserById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '获取用户详情失败',
            message: error.message 
        });
    }
});

// 创建用户
router.post('/create', async (req, res) => {
    try {
        const { name, phone, email, username, password, role } = req.body;
        
        if (!name || !phone || !username || !password) {
            return res.status(400).json({
                success: false,
                error: '姓名、用户名、手机号和密码不能为空'
            });
        }

        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: '用户名已存在'
            });
        }
        
        const userId = await db.createUser({
            name,
            username,
            phone,
            email: email || '',
            password: String(password),
            role: role || 'user'
        });
        
        const newUser = await db.getUserById(userId);
        
        res.json({
            success: true,
            data: newUser,
            message: '用户创建成功'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '创建用户失败',
            message: error.message 
        });
    }
});

// 更新用户信息
router.put('/:id(\\d+)', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, phone, email, username, role, status, password } = req.body;
        
        const user = await db.getUserById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        await db.updateUser(userId, { name, phone, email, username, role, status });
        if (password) {
            await db.updateUserPassword(userId, String(password));
        }
        const updatedUser = await db.getUserById(userId);
        
        res.json({
            success: true,
            data: updatedUser,
            message: '用户信息更新成功'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '更新用户信息失败',
            message: error.message 
        });
    }
});

// 删除用户
router.delete('/:id(\\d+)', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await db.getUserById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        await db.deleteUser(userId);
        
        res.json({
            success: true,
            message: '用户删除成功'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '删除用户失败',
            message: error.message 
        });
    }
});

// 用户统计
router.get('/stats/overview', async (req, res) => {
    try {
        const users = await db.getAllUsers();
        const totalUsers = users.length;
        
        res.json({
            success: true,
            data: {
                total: totalUsers,
                active: users.filter((user) => user.status === 'active').length,
                inactive: users.filter((user) => user.status !== 'active').length,
                activeRate: totalUsers > 0 ? Number((users.filter((user) => user.status === 'active').length / totalUsers * 100).toFixed(1)) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '获取用户统计失败',
            message: error.message 
        });
    }
});

module.exports = router;
