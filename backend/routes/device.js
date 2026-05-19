const express = require('express');
const router = express.Router();
const db = require('../database/db');

// 获取所有设备状态
router.get('/status', async (req, res) => {
    try {
        const dbDevices = await db.getAllDevices();
        
        // 将数据库设备转换为前端需要的格式
        const deviceStatus = {
            rooms: {},
            systems: {}
        };
        
        // 根据设备类型分类
        dbDevices.forEach(device => {
            if (device.type === 'hvac') {
                deviceStatus.systems.airConditioning = {
                    id: device.id,
                    name: device.name,
                    status: device.status,
                    temperature: device.temperature ?? 24,
                    mode: device.mode || 'auto',
                    fanSpeed: device.fan_speed || 'medium'
                };
            } else if (device.type === 'lighting') {
                deviceStatus.systems.lighting = {
                    id: device.id,
                    name: device.name,
                    status: device.status,
                    brightness: device.brightness ?? 80,
                    mode: device.mode || 'auto'
                };
            } else if (device.type === 'security') {
                deviceStatus.systems.security = {
                    id: device.id,
                    name: device.name,
                    status: device.status,
                    cameras: 8,
                    alarms: 0
                };
            }
        });
        
        res.json({
            success: true,
            data: deviceStatus
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '获取设备状态失败',
            message: error.message 
        });
    }
});

// 获取房间状态
router.get('/rooms', async (req, res) => {
    try {
        const venues = await db.getAllVenues();
        
        // 将场地转换为房间状态格式
        const rooms = {};
        venues.forEach(venue => {
            const roomId = venue.name.toLowerCase().replace(/\s+/g, '');
            rooms[roomId] = {
                id: venue.id,
                name: venue.name,
                status: venue.status === 'available' ? 'open' : 'closed',
                capacity: venue.capacity,
                temperature: 24,
                humidity: 45,
                lastMaintenance: new Date().toISOString()
            };
        });
        
        res.json({
            success: true,
            data: rooms
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '获取房间状态失败',
            message: error.message 
        });
    }
});

// 获取系统状态
router.get('/systems', async (req, res) => {
    try {
        const dbDevices = await db.getAllDevices();
        
        // 将数据库设备转换为系统状态格式
        const systems = {};
        dbDevices.forEach(device => {
            if (device.type === 'hvac') {
                systems.airConditioning = {
                    id: device.id,
                    name: device.name,
                    status: device.status,
                    temperature: device.temperature ?? 24,
                    mode: device.mode || 'auto',
                    fanSpeed: device.fan_speed || 'medium'
                };
            } else if (device.type === 'lighting') {
                systems.lighting = {
                    id: device.id,
                    name: device.name,
                    status: device.status,
                    brightness: device.brightness ?? 80,
                    mode: device.mode || 'auto'
                };
            } else if (device.type === 'security') {
                systems.security = {
                    id: device.id,
                    name: device.name,
                    status: device.status,
                    cameras: 8,
                    alarms: 0
                };
            }
        });
        
        res.json({
            success: true,
            data: systems
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '获取系统状态失败',
            message: error.message 
        });
    }
});

// 控制房间状态
router.put('/rooms/:roomId/status', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { status } = req.body;
        
        // 根据roomId查找对应的场地
        const venues = await db.getAllVenues();
        const venue = venues.find(v => v.name.toLowerCase().replace(/\s+/g, '') === roomId);
        
        if (!venue) {
            return res.status(404).json({
                success: false,
                error: '房间不存在'
            });
        }
        
        // 更新场地状态
        const venueStatus = status === 'open' ? 'available' : 'maintenance';
        await db.updateVenueStatus(venue.id, venueStatus);
        
        res.json({
            success: true,
            data: {
                id: venue.id,
                name: venue.name,
                status: status,
                lastUpdate: new Date().toISOString()
            },
            message: `房间${status === 'open' ? '开放' : status === 'closed' ? '关闭' : '维护'}成功`
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '控制房间状态失败',
            message: error.message 
        });
    }
});

// 控制空调系统
router.put('/systems/air-conditioning', async (req, res) => {
    try {
        const { temperature, mode, fanSpeed } = req.body;
        
        // 查找空调设备
        const hvacDevices = await db.getDevicesByType('hvac');
        const airConditioning = hvacDevices[0]; // 假设第一个是空调系统
        
        if (!airConditioning) {
            return res.status(404).json({
                success: false,
                error: '空调系统不存在'
            });
        }
        
        // 更新设备信息
        const updateData = {};
        if (temperature !== undefined) updateData.temperature = temperature;
        if (mode) updateData.mode = mode;
        if (fanSpeed) updateData.fanSpeed = fanSpeed;
        
        await db.updateDevice(airConditioning.id, updateData);
        
        res.json({
            success: true,
            data: {
                id: airConditioning.id,
                name: airConditioning.name,
                status: airConditioning.status,
                temperature: temperature || 24,
                mode: mode || 'auto',
                fanSpeed: fanSpeed || 'medium',
                lastUpdate: new Date().toISOString()
            },
            message: '空调设置已更新'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '控制空调系统失败',
            message: error.message 
        });
    }
});

// 控制照明系统
router.put('/systems/lighting', async (req, res) => {
    try {
        const { brightness, mode } = req.body;
        
        // 查找照明设备
        const lightingDevices = await db.getDevicesByType('lighting');
        const lighting = lightingDevices[0]; // 假设第一个是照明系统
        
        if (!lighting) {
            return res.status(404).json({
                success: false,
                error: '照明系统不存在'
            });
        }
        
        // 更新设备信息
        const updateData = {};
        if (brightness !== undefined) updateData.brightness = brightness;
        if (mode) updateData.mode = mode;
        
        await db.updateDevice(lighting.id, updateData);
        
        res.json({
            success: true,
            data: {
                id: lighting.id,
                name: lighting.name,
                status: lighting.status,
                brightness: brightness || 80,
                mode: mode || 'auto',
                lastUpdate: new Date().toISOString()
            },
            message: '照明设置已更新'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '控制照明系统失败',
            message: error.message 
        });
    }
});

// 批量控制设备
router.put('/batch-control', async (req, res) => {
    try {
        const { action, devices: deviceList } = req.body;
        
        if (!action || !deviceList || !Array.isArray(deviceList)) {
            return res.status(400).json({
                success: false,
                error: '批量控制参数不完整'
            });
        }
        
        const results = [];
        const venues = await db.getAllVenues();
        const systems = await db.getAllDevices();

        for (const deviceId of deviceList) {
            const venue = venues.find((v) => String(v.id) === String(deviceId));
            if (venue) {
                const normalizedVenueStatus = action === 'open' ? 'available' : action === 'maintenance' ? 'maintenance' : 'occupied';
                await db.updateVenueStatus(venue.id, normalizedVenueStatus);
                results.push({
                    deviceId,
                    name: venue.name,
                    status: action,
                    success: true
                });
                continue;
            }

            const system = systems.find((d) => String(d.id) === String(deviceId));
            if (system) {
                const systemStatus = action === 'open' ? 'online' : action === 'maintenance' ? 'maintenance' : 'offline';
                await db.updateDeviceStatus(system.id, systemStatus);
                results.push({
                    deviceId,
                    name: system.name,
                    status: action,
                    success: true
                });
                continue;
            }

            results.push({
                deviceId,
                success: false,
                error: '设备不存在'
            });
        }
        
        res.json({
            success: true,
            data: results,
            message: '批量控制执行完成'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '批量控制失败',
            message: error.message 
        });
    }
});

// 获取设备统计
router.get('/stats', async (req, res) => {
    try {
        const deviceStats = await db.getDeviceStats();
        const venues = await db.getAllVenues();
        
        const roomStats = {
            total: venues.length,
            open: venues.filter(v => v.status === 'available').length,
            closed: venues.filter(v => v.status === 'occupied').length,
            maintenance: venues.filter(v => v.status === 'maintenance').length
        };
        
        const systemStats = {
            total: deviceStats.total,
            online: deviceStats.online,
            offline: deviceStats.offline,
            maintenance: deviceStats.maintenance
        };
        
        res.json({
            success: true,
            data: {
                rooms: roomStats,
                systems: systemStats,
                overall: {
                    totalDevices: roomStats.total + systemStats.total,
                    onlineRate: ((roomStats.open + systemStats.online) / (roomStats.total + systemStats.total) * 100).toFixed(1)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '获取设备统计失败',
            message: error.message 
        });
    }
});

// 设备维护记录
router.get('/maintenance', async (req, res) => {
    try {
        const maintenanceRecords = await db.getMaintenanceRecords();
        
        res.json({
            success: true,
            data: maintenanceRecords
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '获取维护记录失败',
            message: error.message 
        });
    }
});

// 添加维护记录
router.post('/maintenance', async (req, res) => {
    try {
        const { deviceId, deviceName, type, date, description } = req.body;
        
        if (!deviceId || !deviceName || !type || !date || !description) {
            return res.status(400).json({
                success: false,
                error: '维护记录信息不完整'
            });
        }
        
        const recordId = await db.createMaintenanceRecord({
            deviceRef: deviceId,
            deviceName,
            category: String(deviceId).startsWith('venue-') ? 'room' : 'system',
            type,
            date,
            description,
            status: 'scheduled'
        });
        
        res.json({
            success: true,
            data: {
                id: recordId,
                device_ref: deviceId,
                device_name: deviceName,
                type,
                date,
                description,
                status: 'scheduled'
            },
            message: '维护记录已添加'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '添加维护记录失败',
            message: error.message 
        });
    }
});

// 紧急控制
router.post('/emergency', async (req, res) => {
    try {
        const { action } = req.body;
        const venues = await db.getAllVenues();
        const systems = await db.getAllDevices();
        
        if (action === 'shutdown') {
            await Promise.all([
                ...venues.map((venue) => db.updateVenueStatus(venue.id, 'occupied')),
                ...systems.map((system) => db.updateDeviceStatus(system.id, 'offline'))
            ]);
            
            res.json({
                success: true,
                message: '紧急关闭所有设备'
            });
        } else if (action === 'reset') {
            await Promise.all([
                ...venues.map((venue) => db.updateVenueStatus(venue.id, 'available')),
                ...systems.map((system) => db.updateDeviceStatus(system.id, 'online'))
            ]);
            
            res.json({
                success: true,
                message: '设备重置完成'
            });
        } else {
            res.status(400).json({
                success: false,
                error: '无效的紧急操作'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: '紧急控制失败',
            message: error.message 
        });
    }
});

module.exports = router;
