const mysql = require('mysql2/promise');
const crypto = require('crypto');

class Database {
  constructor() {
    this.config = {
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'community_service'
    };
    this.pool = null;
  }

  async init() {
    const bootstrapConnection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password
    });
    await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await bootstrapConnection.end();

    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      connectionLimit: 10,
      waitForConnections: true,
      charset: 'utf8mb4',
      dateStrings: true
    });

    await this.createTables();
    await this.seedData();
    await this.ensureAdminRootAccount();
    await this.ensureFrontendExamplesData();
    await this.ensureDeviceMaintenanceData();
  }

  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('数据库尚未初始化');
    }
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { passwordHash, salt };
  }

  verifyPassword(password, passwordHash, salt) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return hash === passwordHash;
  }

  async createTables() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        name VARCHAR(100) NOT NULL,
        email VARCHAR(120) DEFAULT '',
        phone VARCHAR(30) DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        type VARCHAR(40) NOT NULL,
        capacity INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'available',
        description TEXT,
        location VARCHAR(200) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        venue_id INT NOT NULL,
        date DATE NOT NULL,
        time_slot VARCHAR(30) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        purpose VARCHAR(255) DEFAULT '',
        notes VARCHAR(255) DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_reservation_venue_date (venue_id, date),
        INDEX idx_reservation_user (user_id),
        CONSTRAINT fk_reservation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_reservation_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        type VARCHAR(40) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'online',
        location VARCHAR(120) DEFAULT '',
        description VARCHAR(255) DEFAULT '',
        temperature DECIMAL(5,2) DEFAULT NULL,
        mode VARCHAR(30) DEFAULT NULL,
        fan_speed VARCHAR(30) DEFAULT NULL,
        brightness INT DEFAULT NULL,
        last_maintenance DATE DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS repairs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        user_id INT NOT NULL,
        venue_id INT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_repair_user (user_id),
        INDEX idx_repair_venue (venue_id),
        CONSTRAINT fk_repair_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_repair_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'announcement',
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        author VARCHAR(80) NOT NULL DEFAULT 'admin',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS services (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        provider VARCHAR(120) NOT NULL,
        description TEXT,
        rating DECIMAL(3,1) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        session_id VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_user_session (user_id, session_id),
        CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        token VARCHAR(128) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_session_user (user_id),
        INDEX idx_session_expire (expires_at),
        CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS device_maintenance_records (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        device_ref VARCHAR(100) NOT NULL,
        device_name VARCHAR(120) NOT NULL,
        category VARCHAR(30) NOT NULL DEFAULT 'system',
        type VARCHAR(30) NOT NULL,
        date DATE NOT NULL,
        description VARCHAR(255) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_maintenance_date (date),
        INDEX idx_maintenance_ref (device_ref)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async seedData() {
    const userRows = await this.query('SELECT COUNT(*) AS count FROM users');
    if (userRows[0].count > 0) {
      return;
    }

    const defaultUsers = [
      { username: 'root', name: '管理员', email: 'admin@community.com', phone: '13800138000', role: 'admin', password: '123456' },
      { username: 'user1', name: '张三', email: 'user1@community.com', phone: '13800138001', role: 'user', password: '123456' },
      { username: 'user2', name: '李四', email: 'user2@community.com', phone: '13800138002', role: 'user', password: '123456' },
      { username: 'user3', name: '王五', email: 'user3@community.com', phone: '13800138003', role: 'user', password: '123456' },
      { username: 'user4', name: '赵六', email: 'user4@community.com', phone: '13800138004', role: 'user', password: '123456' },
      { username: 'user5', name: '孙七', email: 'user5@community.com', phone: '13800138005', role: 'user', password: '123456' }
    ];

    for (const user of defaultUsers) {
      await this.createUser(user);
    }

    const defaultVenues = [
      ['乒乓球室', 'sports', 4, 'occupied', '专业乒乓球场地，配备标准球桌', '1楼东侧'],
      ['健身房', 'fitness', 20, 'available', '设备齐全的健身中心', '2楼西侧'],
      ['会议室A', 'meeting', 12, 'occupied', '小型会议室，适合团队讨论', '3楼南侧'],
      ['会议室B', 'meeting', 8, 'available', '中型会议室，配备投影设备', '3楼北侧'],
      ['图书阅览室', 'study', 30, 'maintenance', '安静的学习环境，提供各类书籍', '2楼东侧']
    ];
    for (const venue of defaultVenues) {
      await this.query('INSERT INTO venues (name, type, capacity, status, description, location) VALUES (?, ?, ?, ?, ?, ?)', venue);
    }

    const defaultDevices = [
      ['空调系统', 'hvac', 'online', '全楼', '', null, 'auto', 'medium', null, '2024-01-15'],
      ['照明系统', 'lighting', 'online', '全楼', '', null, 'auto', null, 80, '2024-01-10'],
      ['监控系统', 'security', 'online', '全楼', '', null, null, null, null, '2024-01-20'],
      ['门禁系统', 'access', 'online', '全楼', '', null, null, null, null, '2024-01-18'],
      ['消防系统', 'fire', 'online', '全楼', '', null, null, null, null, '2024-01-25']
    ];
    for (const device of defaultDevices) {
      await this.query(`
        INSERT INTO devices (name, type, status, location, description, temperature, mode, fan_speed, brightness, last_maintenance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, device);
    }

    await this.query(`
      INSERT INTO repairs (title, description, user_id, venue_id, status, priority, created_at, updated_at) VALUES
      ('乒乓球室照明故障', '灯管闪烁，需要更换', 2, 1, 'pending', 'high', '2024-01-10', '2024-01-10'),
      ('健身房空调异响', '空调运行时有异常声音', 3, 2, 'processing', 'medium', '2024-01-09', '2024-01-09'),
      ('会议室投影仪无法开机', '投影仪按电源键无反应', 2, 3, 'completed', 'low', '2024-01-08', '2024-01-08'),
      ('图书阅览室空调不制冷', '空调开启后温度不下降', 4, 5, 'pending', 'medium', '2024-01-11', '2024-01-11'),
      ('健身房跑步机故障', '3号跑步机无法启动', 5, 2, 'processing', 'high', '2024-01-12', '2024-01-12'),
      ('会议室B音响设备故障', '音响有杂音，声音断断续续', 6, 4, 'pending', 'medium', '2024-01-13', '2024-01-13')
    `);

    await this.query(`
      INSERT INTO notices (title, content, type, status, author, created_at, updated_at) VALUES
      ('春节期间场地开放时间调整', '春节假期期间，场地开放时间调整为上午9:00-下午5:00', 'announcement', 'published', 'admin', '2024-01-10', '2024-01-10'),
      ('新增便民服务项目通知', '社区新增快递代收、家政清洁等便民服务', 'service', 'published', 'admin', '2024-01-09', '2024-01-09'),
      ('社区活动报名开始', '春季运动会报名开始，欢迎大家踊跃参与', 'activity', 'published', 'admin', '2024-01-08', '2024-01-08'),
      ('设备维护通知', '本周六将对健身房设备进行维护，请提前安排训练时间', 'maintenance', 'published', 'admin', '2024-01-12', '2024-01-12'),
      ('图书阅览室新书到货', '图书阅览室新增科技、文学类图书200余册，欢迎借阅', 'announcement', 'published', 'admin', '2024-01-13', '2024-01-13'),
      ('社区安全提醒', '近期请注意防火安全，离开场地时请关闭电源', 'safety', 'published', 'admin', '2024-01-14', '2024-01-14')
    `);

    await this.query(`
      INSERT INTO services (name, provider, description, rating, status, created_at, updated_at) VALUES
      ('快递代收', '顺丰快递', '为居民提供快递代收服务', 4.8, 'active', '2024-01-01', '2024-01-01'),
      ('家政清洁', '阿姨来了', '专业家政清洁服务', 4.6, 'active', '2024-01-01', '2024-01-01'),
      ('维修服务', '万师傅', '家电维修、水电维修等', 4.9, 'inactive', '2024-01-01', '2024-01-01'),
      ('洗衣服务', '洗衣王', '专业洗衣烘干服务', 4.5, 'active', '2024-01-01', '2024-01-01'),
      ('代购服务', '跑腿小哥', '生活用品代购配送', 4.7, 'active', '2024-01-01', '2024-01-01')
    `);

    await this.query(`
      INSERT INTO reservations (user_id, venue_id, date, time_slot, status, purpose, notes, created_at, updated_at) VALUES
      (2, 1, '2024-01-15', '14:00-16:00', 'confirmed', '乒乓球训练', '', '2024-01-10', '2024-01-10'),
      (3, 2, '2024-01-16', '19:00-21:00', 'pending', '健身锻炼', '', '2024-01-11', '2024-01-11'),
      (4, 3, '2024-01-17', '10:00-12:00', 'confirmed', '部门会议', '', '2024-01-12', '2024-01-12'),
      (5, 4, '2024-01-18', '15:00-17:00', 'pending', '项目讨论', '', '2024-01-13', '2024-01-13'),
      (6, 5, '2024-01-19', '09:00-11:00', 'cancelled', '学习研讨', '', '2024-01-14', '2024-01-14'),
      (2, 2, '2024-01-20', '08:00-10:00', 'confirmed', '晨练', '', '2024-01-15', '2024-01-15'),
      (3, 1, '2024-01-21', '16:00-18:00', 'pending', '乒乓球比赛', '', '2024-01-16', '2024-01-16')
    `);

    await this.query(`
      INSERT INTO chat_messages (user_id, session_id, role, content, timestamp) VALUES
      (2, 'default', 'user', '我想预约乒乓球室', '2024-01-10 10:00:00'),
      (2, 'default', 'assistant', '好的，我来帮您预约乒乓球室。请问您希望什么时候使用呢？', '2024-01-10 10:00:05'),
      (2, 'default', 'user', '明天下午2点到4点', '2024-01-10 10:00:30'),
      (2, 'default', 'assistant', '已为您成功预约乒乓球室，时间：2024-01-15 14:00-16:00。预约ID：1', '2024-01-10 10:00:35')
    `);
  }

  async ensureAdminRootAccount() {
    const rootUser = await this.getUserAuthByUsername('root');
    if (!rootUser) {
      await this.createUser({
        username: 'root',
        name: '管理员',
        email: 'admin@community.com',
        phone: '13800138000',
        role: 'admin',
        password: '123456'
      });
      return;
    }
    if (rootUser.role !== 'admin') {
      await this.updateUser(rootUser.id, { role: 'admin', status: 'active' });
    }
    await this.updateUserPassword(rootUser.id, '123456');
  }

  async ensureDeviceMaintenanceData() {
    const rows = await this.query('SELECT COUNT(*) AS count FROM device_maintenance_records');
    if (Number(rows[0].count || 0) > 0) {
      return;
    }
    await this.query(`
      INSERT INTO device_maintenance_records (device_ref, device_name, category, type, date, description, status) VALUES
      ('venue-1', '乒乓球室', 'room', 'routine', '2024-01-10', '例行清洁和维护', 'completed'),
      ('venue-2', '健身房', 'room', 'repair', '2024-01-12', '跑步机维修', 'completed'),
      ('device-hvac', '空调系统', 'system', 'upgrade', '2024-01-20', '系统升级', 'scheduled')
    `);
  }

  async ensureFrontendExamplesData() {
    const firstUserRows = await this.query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    if (!firstUserRows.length) {
      return;
    }
    const demoUserId = Number(firstUserRows[0].id);

    const pingPongVenueId = await this.ensureVenueExists({
      name: '乒乓球室',
      type: 'sports',
      capacity: 12,
      status: 'available',
      description: '支持双人对打，提供基础球拍',
      location: '社区活动中心 2F'
    });

    const meetingAVenueId = await this.ensureVenueExists({
      name: '会议室A',
      type: 'meeting',
      capacity: 20,
      status: 'maintenance',
      description: '适合读书会、党员活动日',
      location: '物业楼 3F'
    });

    const northGateVenueId = await this.ensureVenueExists({
      name: '北门入口',
      type: 'public',
      capacity: 100,
      status: 'available',
      description: '社区北门公共区域',
      location: '社区北门'
    });

    const gymVenueRows = await this.query('SELECT id FROM venues WHERE name = ? ORDER BY id ASC LIMIT 1', ['健身房']);
    const gymVenueId = gymVenueRows[0] ? Number(gymVenueRows[0].id) : pingPongVenueId;
    const libraryVenueRows = await this.query('SELECT id FROM venues WHERE name = ? ORDER BY id ASC LIMIT 1', ['图书阅览室']);
    const libraryVenueId = libraryVenueRows[0] ? Number(libraryVenueRows[0].id) : meetingAVenueId;

    await this.ensureNoticeExists({
      title: '清明节值班安排',
      content: '物业服务时间调整为 08:00-18:00，紧急电话保持畅通。',
      author: '社区办公室',
      type: '通知',
      status: 'published'
    });

    await this.ensureNoticeExists({
      title: '老年健康讲座',
      content: '本周六 9:30 在多功能厅开展慢病管理讲座，欢迎报名。',
      author: '社区卫生站',
      type: '活动',
      status: 'published'
    });

    await this.ensureServiceExists({
      name: '快递代收',
      provider: '北门便民站',
      rating: 4.8,
      status: 'active',
      description: '支持短信通知与晚间取件'
    });

    await this.ensureServiceExists({
      name: '上门家政',
      provider: '邻里管家',
      rating: 4.6,
      status: 'active',
      description: '可预约保洁、收纳、深度清洁'
    });

    await this.ensureRepairExists({
      title: '健身房跑步机异响',
      description: '跑步机运行时出现明显异响',
      userId: demoUserId,
      venueId: gymVenueId,
      status: 'processing',
      priority: 'medium'
    });

    await this.ensureRepairExists({
      title: '北门照明闪烁',
      description: '北门入口灯光闪烁不稳定',
      userId: demoUserId,
      venueId: northGateVenueId,
      status: 'completed',
      priority: 'medium'
    });

    await this.ensureReservationExists({
      userId: demoUserId,
      venueId: libraryVenueId,
      date: '2026-04-03',
      timeSlot: '14:00-16:00',
      status: 'confirmed',
      purpose: '自习',
      notes: '来自前端示例'
    });

    await this.ensureReservationExists({
      userId: demoUserId,
      venueId: meetingAVenueId,
      date: '2026-04-05',
      timeSlot: '09:00-11:00',
      status: 'pending',
      purpose: '会议',
      notes: '来自前端示例'
    });
  }

  async ensureVenueExists(venueData) {
    const rows = await this.query('SELECT id FROM venues WHERE name = ? AND location = ? LIMIT 1', [venueData.name, venueData.location]);
    if (rows.length) {
      return Number(rows[0].id);
    }
    const result = await this.query(
      'INSERT INTO venues (name, type, capacity, status, description, location) VALUES (?, ?, ?, ?, ?, ?)',
      [venueData.name, venueData.type, venueData.capacity, venueData.status, venueData.description, venueData.location]
    );
    return Number(result.insertId);
  }

  async ensureNoticeExists(noticeData) {
    const rows = await this.query('SELECT id FROM notices WHERE title = ? LIMIT 1', [noticeData.title]);
    if (rows.length) {
      return Number(rows[0].id);
    }
    const result = await this.query(
      'INSERT INTO notices (title, content, type, status, author) VALUES (?, ?, ?, ?, ?)',
      [noticeData.title, noticeData.content, noticeData.type, noticeData.status, noticeData.author]
    );
    return Number(result.insertId);
  }

  async ensureServiceExists(serviceData) {
    const rows = await this.query('SELECT id FROM services WHERE name = ? AND provider = ? LIMIT 1', [serviceData.name, serviceData.provider]);
    if (rows.length) {
      return Number(rows[0].id);
    }
    const result = await this.query(
      'INSERT INTO services (name, provider, description, rating, status) VALUES (?, ?, ?, ?, ?)',
      [serviceData.name, serviceData.provider, serviceData.description, serviceData.rating, serviceData.status]
    );
    return Number(result.insertId);
  }

  async ensureRepairExists(repairData) {
    const rows = await this.query('SELECT id FROM repairs WHERE title = ? LIMIT 1', [repairData.title]);
    if (rows.length) {
      return Number(rows[0].id);
    }
    const result = await this.query(
      'INSERT INTO repairs (title, description, user_id, venue_id, status, priority) VALUES (?, ?, ?, ?, ?, ?)',
      [repairData.title, repairData.description, repairData.userId, repairData.venueId, repairData.status, repairData.priority]
    );
    return Number(result.insertId);
  }

  async ensureReservationExists(reservationData) {
    const rows = await this.query(
      'SELECT id FROM reservations WHERE user_id = ? AND venue_id = ? AND date = ? AND time_slot = ? LIMIT 1',
      [reservationData.userId, reservationData.venueId, reservationData.date, reservationData.timeSlot]
    );
    if (rows.length) {
      return Number(rows[0].id);
    }
    const result = await this.query(
      'INSERT INTO reservations (user_id, venue_id, date, time_slot, status, purpose, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [reservationData.userId, reservationData.venueId, reservationData.date, reservationData.timeSlot, reservationData.status, reservationData.purpose, reservationData.notes]
    );
    return Number(result.insertId);
  }

  async saveData() {
    return true;
  }

  async createUser(userData) {
    const {
      username,
      name,
      email = '',
      phone = '',
      password = '123456',
      role = 'user'
    } = userData;
    const { passwordHash, salt } = this.hashPassword(password);
    const result = await this.query(
      'INSERT INTO users (username, password_hash, salt, role, name, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash, salt, role, name || username, email, phone]
    );
    return result.insertId;
  }

  async getUserById(id) {
    const rows = await this.query(
      'SELECT id, username, role, name, email, phone, status, created_at, updated_at FROM users WHERE id = ?',
      [Number(id)]
    );
    return rows[0] || null;
  }

  async getUserByUsername(username) {
    const rows = await this.query(
      'SELECT id, username, role, name, email, phone, status, created_at, updated_at FROM users WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  }

  async getUserAuthByUsername(username) {
    const rows = await this.query(
      'SELECT id, username, role, name, email, phone, status, password_hash, salt FROM users WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  }

  async getAllUsers() {
    return await this.query(
      'SELECT id, username, role, name, email, phone, status, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
  }

  async updateUser(id, userData) {
    const keys = ['username', 'name', 'email', 'phone', 'role', 'status'];
    const updateFields = [];
    const params = [];
    keys.forEach((key) => {
      if (userData[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        params.push(userData[key]);
      }
    });
    if (!updateFields.length) {
      return;
    }
    params.push(Number(id));
    await this.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, params);
  }

  async updateUserPassword(id, password) {
    const { passwordHash, salt } = this.hashPassword(password);
    await this.query(
      'UPDATE users SET password_hash = ?, salt = ? WHERE id = ?',
      [passwordHash, salt, Number(id)]
    );
  }

  async deleteUser(id) {
    await this.query('DELETE FROM users WHERE id = ?', [Number(id)]);
  }

  async createSession(userId, expiresInHours = 24) {
    const token = crypto.randomBytes(48).toString('hex');
    await this.query(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))',
      [Number(userId), token, expiresInHours]
    );
    return token;
  }

  async getUserByToken(token) {
    const rows = await this.query(`
      SELECT u.id, u.username, u.role, u.name, u.email, u.phone, u.status, u.created_at, u.updated_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > NOW()
      LIMIT 1
    `, [token]);
    return rows[0] || null;
  }

  async deleteSession(token) {
    await this.query('DELETE FROM user_sessions WHERE token = ?', [token]);
  }

  async saveChatMessage(userId, sessionId, role, content) {
    const result = await this.query(
      'INSERT INTO chat_messages (user_id, session_id, role, content) VALUES (?, ?, ?, ?)',
      [Number(userId), sessionId, role, content]
    );
    return result.insertId;
  }

  async getChatHistory(userId, sessionId, limit = 50) {
    return await this.query(
      'SELECT id, user_id, session_id, role, content, timestamp FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY timestamp DESC LIMIT ?',
      [Number(userId), sessionId, Number(limit)]
    );
  }

  async getChatSessions(userId) {
    const rows = await this.query(
      'SELECT session_id, MAX(timestamp) AS last_message FROM chat_messages WHERE user_id = ? GROUP BY session_id ORDER BY last_message DESC',
      [Number(userId)]
    );
    return rows.map((row) => ({
      session_id: row.session_id,
      last_message: row.last_message
    }));
  }

  async getAllVenues() {
    return await this.query('SELECT * FROM venues ORDER BY name ASC');
  }

  async getVenueById(id) {
    const rows = await this.query('SELECT * FROM venues WHERE id = ?', [Number(id)]);
    return rows[0] || null;
  }

  async createVenue(venueData) {
    const { name, type, capacity, location, description = '', status = 'available' } = venueData;
    const result = await this.query(
      'INSERT INTO venues (name, type, capacity, location, description, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, Number(capacity), location, description, status]
    );
    return result.insertId;
  }

  async updateVenueStatus(id, status) {
    await this.query('UPDATE venues SET status = ? WHERE id = ?', [status, Number(id)]);
  }

  async updateVenue(id, venueData) {
    const keys = ['name', 'type', 'capacity', 'location', 'description', 'status'];
    const updateFields = [];
    const params = [];
    keys.forEach((key) => {
      if (venueData[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        params.push(venueData[key]);
      }
    });
    if (!updateFields.length) {
      return;
    }
    params.push(Number(id));
    await this.query(`UPDATE venues SET ${updateFields.join(', ')} WHERE id = ?`, params);
  }

  async deleteVenue(id) {
    await this.query('DELETE FROM venues WHERE id = ?', [Number(id)]);
  }

  async createReservation(reservationData) {
    const { userId, venueId, date, timeSlot, notes = '', purpose = '' } = reservationData;
    const result = await this.query(
      'INSERT INTO reservations (user_id, venue_id, date, time_slot, status, purpose, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [Number(userId), Number(venueId), date, timeSlot, 'pending', purpose || notes, notes]
    );
    return result.insertId;
  }

  async getAllReservations(filters = {}) {
    let sql = `
      SELECT r.*, v.name AS venue_name, u.username
      FROM reservations r
      JOIN venues v ON r.venue_id = v.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.status) {
      sql += ' AND r.status = ?';
      params.push(filters.status);
    }
    if (filters.date) {
      sql += ' AND r.date = ?';
      params.push(filters.date);
    }
    if (filters.service) {
      sql += ' AND v.name LIKE ?';
      params.push(`%${filters.service}%`);
    }
    sql += ' ORDER BY r.date DESC, r.time_slot DESC';
    return await this.query(sql, params);
  }

  async getReservationsByUser(userId) {
    return await this.query(`
      SELECT r.*, v.name AS venue_name, u.username
      FROM reservations r
      JOIN venues v ON r.venue_id = v.id
      JOIN users u ON r.user_id = u.id
      WHERE r.user_id = ?
      ORDER BY r.date DESC, r.time_slot DESC
    `, [Number(userId)]);
  }

  async getReservationsByVenue(venueId, date) {
    if (date) {
      return await this.query(
        'SELECT * FROM reservations WHERE venue_id = ? AND date = ? ORDER BY time_slot ASC',
        [Number(venueId), date]
      );
    }
    return await this.query(
      'SELECT * FROM reservations WHERE venue_id = ? ORDER BY date DESC, time_slot DESC',
      [Number(venueId)]
    );
  }

  async getReservationsByDate(date) {
    return await this.query(
      'SELECT * FROM reservations WHERE date = ? ORDER BY time_slot ASC',
      [date]
    );
  }

  async updateReservationStatus(id, status, notes = '') {
    await this.query('UPDATE reservations SET status = ?, notes = ? WHERE id = ?', [status, notes, Number(id)]);
  }

  async getAllDevices() {
    return await this.query('SELECT * FROM devices ORDER BY name ASC');
  }

  async getDeviceById(id) {
    const rows = await this.query('SELECT * FROM devices WHERE id = ?', [Number(id)]);
    return rows[0] || null;
  }

  async getDevicesByType(type) {
    return await this.query('SELECT * FROM devices WHERE type = ? ORDER BY name ASC', [type]);
  }

  async getDevicesByStatus(status) {
    return await this.query('SELECT * FROM devices WHERE status = ? ORDER BY name ASC', [status]);
  }

  async createDevice(deviceData) {
    const { name, type, status = 'online', location = '全楼', description = '' } = deviceData;
    const result = await this.query(
      'INSERT INTO devices (name, type, status, location, description, last_maintenance) VALUES (?, ?, ?, ?, ?, CURDATE())',
      [name, type, status, location, description]
    );
    return result.insertId;
  }

  async updateDeviceStatus(id, status) {
    await this.query('UPDATE devices SET status = ? WHERE id = ?', [status, Number(id)]);
  }

  async updateDevice(id, deviceData) {
    const fieldMap = {
      name: 'name',
      type: 'type',
      status: 'status',
      location: 'location',
      description: 'description',
      temperature: 'temperature',
      mode: 'mode',
      fanSpeed: 'fan_speed',
      brightness: 'brightness',
      last_maintenance: 'last_maintenance'
    };
    const updateFields = [];
    const params = [];
    Object.keys(fieldMap).forEach((key) => {
      if (deviceData[key] !== undefined) {
        updateFields.push(`${fieldMap[key]} = ?`);
        params.push(deviceData[key]);
      }
    });
    if (!updateFields.length) {
      return;
    }
    params.push(Number(id));
    await this.query(`UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?`, params);
  }

  async getMaintenanceRecords() {
    return await this.query('SELECT * FROM device_maintenance_records ORDER BY date DESC, id DESC');
  }

  async createMaintenanceRecord(recordData) {
    const {
      deviceRef,
      deviceName,
      category = 'system',
      type,
      date,
      description,
      status = 'scheduled'
    } = recordData;
    const result = await this.query(
      'INSERT INTO device_maintenance_records (device_ref, device_name, category, type, date, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [String(deviceRef), String(deviceName), String(category), String(type), date, String(description), String(status)]
    );
    return Number(result.insertId);
  }

  async deleteDevice(id) {
    await this.query('DELETE FROM devices WHERE id = ?', [Number(id)]);
  }

  async getDeviceStats() {
    const statusRows = await this.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) AS offline,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance
      FROM devices
    `);
    const typeRows = await this.query(`
      SELECT type, COUNT(*) AS count
      FROM devices
      GROUP BY type
    `);
    const typeMap = {};
    typeRows.forEach((row) => {
      typeMap[row.type] = Number(row.count);
    });
    return {
      total: Number(statusRows[0].total || 0),
      online: Number(statusRows[0].online || 0),
      offline: Number(statusRows[0].offline || 0),
      maintenance: Number(statusRows[0].maintenance || 0),
      byType: {
        hvac: typeMap.hvac || 0,
        lighting: typeMap.lighting || 0,
        security: typeMap.security || 0,
        access: typeMap.access || 0,
        fire: typeMap.fire || 0
      }
    };
  }

  async getAllRepairs() {
    return await this.query('SELECT * FROM repairs ORDER BY created_at DESC');
  }

  async getRepairById(id) {
    const rows = await this.query('SELECT * FROM repairs WHERE id = ?', [Number(id)]);
    return rows[0] || null;
  }

  async createRepair(repairData) {
    const { title, description, user_id, venue_id, priority = 'medium' } = repairData;
    const result = await this.query(
      'INSERT INTO repairs (title, description, user_id, venue_id, status, priority) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description, Number(user_id), Number(venue_id), 'pending', priority]
    );
    return result.insertId;
  }

  async updateRepairStatus(id, status) {
    await this.query('UPDATE repairs SET status = ? WHERE id = ?', [status, Number(id)]);
  }

  async getAllNotices() {
    return await this.query('SELECT * FROM notices ORDER BY created_at DESC');
  }

  async getNoticeById(id) {
    const rows = await this.query('SELECT * FROM notices WHERE id = ?', [Number(id)]);
    return rows[0] || null;
  }

  async createNotice(noticeData) {
    const { title, content, type = 'announcement', author = 'admin' } = noticeData;
    const result = await this.query(
      'INSERT INTO notices (title, content, type, status, author) VALUES (?, ?, ?, ?, ?)',
      [title, content, type, 'draft', author]
    );
    return result.insertId;
  }

  async updateNoticeStatus(id, status) {
    await this.query('UPDATE notices SET status = ? WHERE id = ?', [status, Number(id)]);
  }

  async getAllServices() {
    return await this.query('SELECT * FROM services ORDER BY name ASC');
  }

  async getServiceById(id) {
    const rows = await this.query('SELECT * FROM services WHERE id = ?', [Number(id)]);
    return rows[0] || null;
  }

  async createService(serviceData) {
    const { name, provider, description = '', rating = 0 } = serviceData;
    const result = await this.query(
      'INSERT INTO services (name, provider, description, rating, status) VALUES (?, ?, ?, ?, ?)',
      [name, provider, description, Number(rating), 'active']
    );
    return result.insertId;
  }

  async updateServiceStatus(id, status) {
    await this.query('UPDATE services SET status = ? WHERE id = ?', [status, Number(id)]);
  }

  async getStats() {
    const [users, venues, reservations, devices, repairs, notices, services] = await Promise.all([
      this.query('SELECT COUNT(*) AS count FROM users'),
      this.query('SELECT COUNT(*) AS count FROM venues'),
      this.query('SELECT COUNT(*) AS count FROM reservations'),
      this.query('SELECT COUNT(*) AS count FROM devices'),
      this.query('SELECT COUNT(*) AS count FROM repairs'),
      this.query('SELECT COUNT(*) AS count FROM notices'),
      this.query('SELECT COUNT(*) AS count FROM services')
    ]);
    return {
      users: Number(users[0].count || 0),
      venues: Number(venues[0].count || 0),
      reservations: Number(reservations[0].count || 0),
      devices: Number(devices[0].count || 0),
      repairs: Number(repairs[0].count || 0),
      notices: Number(notices[0].count || 0),
      services: Number(services[0].count || 0)
    };
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = new Database();
