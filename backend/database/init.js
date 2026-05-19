require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('./db');

async function initDatabase() {
  try {
    await db.init();
    console.log('✅ 数据库初始化完成');
    
    // 显示统计信息
    const stats = await db.getStats();
    console.log('📊 数据库统计:');
    console.log(`   用户: ${stats.users} 个`);
    console.log(`   场地: ${stats.venues} 个`);
    console.log(`   预约: ${stats.reservations} 个`);
    console.log(`   设备: ${stats.devices} 个`);
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则初始化数据库
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
