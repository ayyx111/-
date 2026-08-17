/**
 * Sequelize 数据库连接配置
 * 支持 SQLite、MySQL、PostgreSQL 三种方言
 */
const { Sequelize } = require('sequelize');
const config = require('./index');

let sequelize;

if (config.db.type === 'sqlite') {
  // SQLite 模式(零依赖,适合本地开发/演示)
  let sqliteAdapter;
  try {
    sqliteAdapter = require('./sqliteAdapter');
  } catch (e) {
    console.error('[DB] SQLite 模块加载失败,请运行 npm install 或改用 PostgreSQL:', e.message);
    throw new Error('SQLite 模块不可用: ' + e.message);
  }
  sequelize = new Sequelize({
    dialect: 'sqlite',
    dialectModule: sqliteAdapter,
    storage: config.db.storage,
    logging: config.env === 'development' ? (msg) => console.log(`[SQL] ${msg}`) : false,
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  });
  console.log('[DB] 使用 SQLite 数据库:', config.db.storage);
} else if (config.db.type === 'postgres') {
  // PostgreSQL 模式(Railway / 云数据库)
  const sequelizeConfig = {
    dialect: 'postgres',
    logging: config.env === 'development' ? (msg) => console.log(`[SQL] ${msg}`) : false,
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    },
    pool: {
      min: config.db.poolMin,
      max: config.db.poolMax,
      idle: config.db.poolIdle
    }
  };

  if (config.db.url) {
    // Railway 等平台提供 DATABASE_URL 连接字符串
    sequelize = new Sequelize(config.db.url, {
      ...sequelizeConfig,
      dialectOptions: {
        ssl: process.env.PGSSLMODE === 'disable' ? false : { require: true, rejectUnauthorized: false }
      }
    });
    console.log('[DB] 连接 PostgreSQL (DATABASE_URL)');
  } else if (config.db.pgHost && config.db.pgUser) {
    // Railway 独立 PG 变量
    sequelize = new Sequelize(config.db.pgDatabase, config.db.pgUser, config.db.pgPassword, {
      ...sequelizeConfig,
      host: config.db.pgHost,
      port: config.db.pgPort || 5432,
      dialectOptions: {
        ssl: process.env.PGSSLMODE === 'disable' ? false : { require: true, rejectUnauthorized: false }
      }
    });
    console.log(`[DB] 连接 PostgreSQL (Railway PGHOST): ${config.db.pgHost}:${config.db.pgPort}/${config.db.pgDatabase}`);
  } else {
    sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
      ...sequelizeConfig,
      host: config.db.host,
      port: config.db.port
    });
    console.log(`[DB] 连接 PostgreSQL: ${config.db.host}:${config.db.port}/${config.db.database}`);
  }
} else {
  // MySQL 模式
  sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    timezone: '+08:00',
    logging: config.env === 'development' ? (msg) => console.log(`[SQL] ${msg}`) : false,
    pool: {
      min: config.db.poolMin,
      max: config.db.poolMax,
      idle: config.db.poolIdle
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },
    dialectOptions: {
      charset: 'utf8mb4',
      dateStrings: false,
      typeCast: true
    }
  });
  console.log(`[DB] 连接 MySQL: ${config.db.host}:${config.db.port}/${config.db.database}`);
}

module.exports = sequelize;
