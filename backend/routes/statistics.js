const express = require('express');
const router = express.Router();
const db = require('../database/db');

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

function toAmountByStatus(status) {
    if (status === 'confirmed' || status === 'completed') {
        return 80;
    }
    if (status === 'pending' || status === 'processing') {
        return 50;
    }
    return 0;
}

async function getOverviewStats() {
    const stats = await db.getStats();
    const today = formatDate(new Date());
    const [todayReservations, users, repairs, deviceStats] = await Promise.all([
        db.getReservationsByDate(today),
        db.getAllUsers(),
        db.getAllRepairs(),
        db.getDeviceStats()
    ]);
    const activeUsers = users.filter((user) => user.status === 'active').length;
    const pendingRepairs = repairs.filter((repair) => repair.status === 'pending').length;
    return {
        totalUsers: stats.users,
        activeUsers,
        totalVenues: stats.venues,
        totalReservations: stats.reservations,
        todayReservations: todayReservations.length,
        pendingRepairs,
        onlineDevices: deviceStats.online,
        deviceUsage: deviceStats.total > 0 ? Number((deviceStats.online / deviceStats.total * 100).toFixed(1)) : 0,
        satisfaction: 4.8
    };
}

async function getReservationsWithVenue() {
    return await db.getAllReservations({});
}

router.get('/overview', async (req, res) => {
    try {
        const overview = await getOverviewStats();
        res.json({
            success: true,
            data: overview
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取总体统计失败',
            message: error.message
        });
    }
});

router.get('/daily', async (req, res) => {
    try {
        const date = req.query.date || formatDate(new Date());
        const reservations = await db.getReservationsByDate(date);
        const users = await db.getAllUsers();
        const revenue = reservations.reduce((sum, item) => sum + toAmountByStatus(item.status), 0);
        res.json({
            success: true,
            data: {
                date,
                reservations: reservations.length,
                users: users.filter((user) => user.status === 'active').length,
                revenue,
                satisfaction: 4.8
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取每日统计失败',
            message: error.message
        });
    }
});

router.get('/weekly', async (req, res) => {
    try {
        const now = new Date();
        const weekDays = [];
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            weekDays.push(formatDate(d));
        }
        const reservationsByDay = await Promise.all(weekDays.map((day) => db.getReservationsByDate(day)));
        const daily = reservationsByDay.map((list) => list.reduce((sum, item) => sum + toAmountByStatus(item.status), 0));
        const totalReservations = reservationsByDay.reduce((sum, list) => sum + list.length, 0);
        const totalRevenue = daily.reduce((sum, amount) => sum + amount, 0);
        const users = await db.getAllUsers();
        res.json({
            success: true,
            data: {
                week: `${weekDays[0]} ~ ${weekDays[6]}`,
                totalReservations,
                totalUsers: users.length,
                revenue: totalRevenue,
                daily,
                satisfaction: 4.8
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取每周统计失败',
            message: error.message
        });
    }
});

router.get('/monthly', async (req, res) => {
    try {
        const current = new Date();
        const month = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const reservations = await getReservationsWithVenue();
        const monthReservations = reservations.filter((item) => String(item.date).slice(0, 7) === month);
        const totalRevenue = monthReservations.reduce((sum, item) => sum + toAmountByStatus(item.status), 0);
        const weekly = [0, 0, 0, 0];
        monthReservations.forEach((item) => {
            const day = Number(String(item.date).slice(8, 10));
            const weekIndex = Math.min(Math.floor((day - 1) / 7), 3);
            weekly[weekIndex] += toAmountByStatus(item.status);
        });
        const users = await db.getAllUsers();
        res.json({
            success: true,
            data: {
                month,
                totalReservations: monthReservations.length,
                totalUsers: users.length,
                revenue: totalRevenue,
                weekly,
                satisfaction: 4.8
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取每月统计失败',
            message: error.message
        });
    }
});

router.get('/services', async (req, res) => {
    try {
        const venues = await db.getAllVenues();
        const reservations = await getReservationsWithVenue();
        const usageMap = {};
        reservations.forEach((item) => {
            usageMap[item.venue_id] = (usageMap[item.venue_id] || 0) + 1;
        });
        const serviceStats = venues.map((venue) => {
            const venueReservations = usageMap[venue.id] || 0;
            return {
                name: venue.name,
                type: venue.type,
                capacity: venue.capacity,
                status: venue.status,
                usage: Math.min(100, venueReservations * 10)
            };
        });
        res.json({
            success: true,
            data: serviceStats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取服务统计失败',
            message: error.message
        });
    }
});

router.get('/devices', async (req, res) => {
    try {
        const deviceStats = await db.getDeviceStats();
        res.json({
            success: true,
            data: deviceStats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取设备统计失败',
            message: error.message
        });
    }
});

router.get('/logs', async (req, res) => {
    try {
        const [reservations, repairs, notices] = await Promise.all([
            getReservationsWithVenue(),
            db.getAllRepairs(),
            db.getAllNotices()
        ]);
        const logs = [];
        reservations.slice(0, 5).forEach((item) => {
            logs.push({
                time: item.updated_at || item.created_at,
                event: `预约状态更新: ${item.venue_name || '场地'}`,
                status: item.status
            });
        });
        repairs.slice(0, 5).forEach((item) => {
            logs.push({
                time: item.updated_at || item.created_at,
                event: `报修处理: ${item.title}`,
                status: item.status
            });
        });
        notices.slice(0, 5).forEach((item) => {
            logs.push({
                time: item.updated_at || item.created_at,
                event: `通知发布: ${item.title}`,
                status: item.status
            });
        });
        logs.sort((a, b) => new Date(b.time) - new Date(a.time));
        res.json({
            success: true,
            data: logs.slice(0, 20)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取日志数据失败',
            message: error.message
        });
    }
});

router.get('/maintenance', async (req, res) => {
    try {
        const devices = await db.getAllDevices();
        const maintenance = devices.map((device) => ({
            device: device.name,
            date: device.last_maintenance || formatDate(new Date()),
            status: device.status === 'maintenance' ? 'pending' : 'completed'
        }));
        res.json({
            success: true,
            data: maintenance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取维护数据失败',
            message: error.message
        });
    }
});

router.get('/trends', async (req, res) => {
    try {
        const users = await db.getAllUsers();
        const reservations = await getReservationsWithVenue();
        const userGrowthMap = {};
        users.forEach((user) => {
            const month = String(user.created_at).slice(0, 7);
            userGrowthMap[month] = (userGrowthMap[month] || 0) + 1;
        });
        const userGrowth = Object.keys(userGrowthMap).sort().map((month) => ({
            month,
            users: userGrowthMap[month]
        }));

        const now = new Date();
        const dayBuckets = [];
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            dayBuckets.push(formatDate(d));
        }
        const reservationTrend = dayBuckets.map((day) => ({
            day,
            count: reservations.filter((item) => String(item.date).slice(0, 10) === day).length
        }));
        res.json({
            success: true,
            data: {
                userGrowth,
                reservationTrend
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取趋势分析失败',
            message: error.message
        });
    }
});

router.get('/realtime', async (req, res) => {
    try {
        const [overview, reservations, repairs] = await Promise.all([
            getOverviewStats(),
            getReservationsWithVenue(),
            db.getAllRepairs()
        ]);
        const activeReservations = reservations.filter((item) => item.status === 'pending' || item.status === 'confirmed').length;
        const alerts = repairs.filter((item) => item.priority === 'high' && item.status !== 'completed').length;
        res.json({
            success: true,
            data: {
                timestamp: new Date().toISOString(),
                currentUsers: overview.activeUsers,
                activeReservations,
                systemLoad: Math.min(100, Number((overview.deviceUsage * 0.7 + activeReservations * 2).toFixed(1))),
                onlineDevices: overview.onlineDevices,
                alerts
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取实时数据失败',
            message: error.message
        });
    }
});

router.get('/user-behavior', async (req, res) => {
    try {
        const users = await db.getAllUsers();
        const reservations = await getReservationsWithVenue();
        const hourMap = {};
        reservations.forEach((item) => {
            const startHour = String(item.time_slot || '').slice(0, 2);
            const hour = `${startHour}:00`;
            hourMap[hour] = (hourMap[hour] || 0) + 1;
        });
        const peakHours = Object.keys(hourMap).sort().map((hour) => ({
            hour,
            users: hourMap[hour]
        }));
        const activeUsers = users.filter((user) => user.status === 'active').length;
        const preferences = {};
        reservations.forEach((item) => {
            preferences[item.venue_name] = (preferences[item.venue_name] || 0) + 1;
        });
        res.json({
            success: true,
            data: {
                peakHours,
                userTypes: {
                    新用户: Math.max(0, users.length - activeUsers),
                    活跃用户: activeUsers,
                    VIP用户: users.filter((user) => user.role === 'admin').length,
                    流失用户: users.filter((user) => user.status !== 'active').length
                },
                preferences,
                satisfaction: {
                    非常满意: 48,
                    满意: 34,
                    一般: 14,
                    不满意: 4
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取用户行为分析失败',
            message: error.message
        });
    }
});

router.get('/revenue', async (req, res) => {
    try {
        const period = req.query.period;
        const reservations = await getReservationsWithVenue();
        const now = new Date();
        const today = formatDate(now);
        const yesterdayDate = new Date(now);
        yesterdayDate.setDate(now.getDate() - 1);
        const yesterday = formatDate(yesterdayDate);
        const dayRevenue = (date) => reservations
            .filter((item) => String(item.date).slice(0, 10) === date)
            .reduce((sum, item) => sum + toAmountByStatus(item.status), 0);

        if (period === 'daily') {
            const todayAmount = dayRevenue(today);
            const yesterdayAmount = dayRevenue(yesterday);
            const growth = yesterdayAmount > 0 ? Number((((todayAmount - yesterdayAmount) / yesterdayAmount) * 100).toFixed(1)) : 0;
            const breakdown = {};
            reservations
                .filter((item) => String(item.date).slice(0, 10) === today)
                .forEach((item) => {
                    breakdown[item.venue_name] = (breakdown[item.venue_name] || 0) + toAmountByStatus(item.status);
                });
            return res.json({
                success: true,
                data: {
                    today: todayAmount,
                    yesterday: yesterdayAmount,
                    growth,
                    breakdown
                }
            });
        }

        if (period === 'weekly') {
            const daily = [];
            let thisWeek = 0;
            let lastWeek = 0;
            for (let i = 6; i >= 0; i -= 1) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const val = dayRevenue(formatDate(d));
                daily.push(val);
                thisWeek += val;
            }
            for (let i = 13; i >= 7; i -= 1) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                lastWeek += dayRevenue(formatDate(d));
            }
            const growth = lastWeek > 0 ? Number((((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1)) : 0;
            return res.json({
                success: true,
                data: {
                    thisWeek,
                    lastWeek,
                    growth,
                    daily
                }
            });
        }

        if (period === 'monthly') {
            const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
            const thisMonthReservations = reservations.filter((item) => String(item.date).slice(0, 7) === thisMonth);
            const lastMonthReservations = reservations.filter((item) => String(item.date).slice(0, 7) === lastMonth);
            const thisMonthAmount = thisMonthReservations.reduce((sum, item) => sum + toAmountByStatus(item.status), 0);
            const lastMonthAmount = lastMonthReservations.reduce((sum, item) => sum + toAmountByStatus(item.status), 0);
            const growth = lastMonthAmount > 0 ? Number((((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100).toFixed(1)) : 0;
            const weekly = [0, 0, 0, 0];
            thisMonthReservations.forEach((item) => {
                const day = Number(String(item.date).slice(8, 10));
                const weekIndex = Math.min(Math.floor((day - 1) / 7), 3);
                weekly[weekIndex] += toAmountByStatus(item.status);
            });
            return res.json({
                success: true,
                data: {
                    thisMonth: thisMonthAmount,
                    lastMonth: lastMonthAmount,
                    growth,
                    weekly
                }
            });
        }

        const total = reservations.reduce((sum, item) => sum + toAmountByStatus(item.status), 0);
        const average = reservations.length > 0 ? Number((total / reservations.length).toFixed(2)) : 0;
        res.json({
            success: true,
            data: {
                total,
                average,
                growth: 0
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '获取收入分析失败',
            message: error.message
        });
    }
});

router.get('/export', async (req, res) => {
    try {
        const type = req.query.type;
        const format = req.query.format;
        let exportData;
        if (type === 'daily') {
            const date = formatDate(new Date());
            const reservations = await db.getReservationsByDate(date);
            const users = await db.getAllUsers();
            exportData = {
                date,
                reservations: reservations.length,
                users: users.length
            };
        } else if (type === 'weekly') {
            const weekly = await Promise.all(Array.from({ length: 7 }).map((_, idx) => {
                const d = new Date();
                d.setDate(new Date().getDate() - idx);
                return db.getReservationsByDate(formatDate(d));
            }));
            exportData = {
                weekTotalReservations: weekly.reduce((sum, item) => sum + item.length, 0),
                days: weekly.length
            };
        } else if (type === 'monthly') {
            const reservations = await getReservationsWithVenue();
            const month = formatDate(new Date()).slice(0, 7);
            exportData = {
                month,
                totalReservations: reservations.filter((item) => String(item.date).slice(0, 7) === month).length
            };
        } else {
            exportData = await getOverviewStats();
        }

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="statistics.csv"');
            res.send('数据,值\n' + Object.entries(exportData).map(([key, value]) => `${key},${value}`).join('\n'));
            return;
        }

        res.json({
            success: true,
            data: exportData,
            message: '统计数据导出成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: '导出统计数据失败',
            message: error.message
        });
    }
});

module.exports = router;
