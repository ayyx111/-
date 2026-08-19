'use strict';

const Database = require('better-sqlite3');

class Statement {
  constructor() {
    this.lastID = 0;
    this.changes = 0;
  }
}

class SqliteAdapter {
  constructor(filename, mode, callback) {
    if (typeof mode === 'function') {
      callback = mode;
      mode = undefined;
    }
    if (typeof callback !== 'function') {
      callback = null;
    }
    try {
      this._db = new Database(filename, { fileMustExist: false });
      // SQLite busy_timeout: 写锁竞争时内部自动等待重试(毫秒),
      // 避免 better-sqlite3 默认立即抛 "database is locked" → 500 "服务器开小差".
      // 订单/商品/举报/通知 并发写 DB 时频繁触发(卖家确认就是典型:SELECT+UPDATE+事务).
      try { this._db.pragma('busy_timeout = 8000'); } catch (_) {}
      try { this._db.pragma('journal_mode = WAL'); } catch (_) {} // WAL 模式:读写互不阻塞(显著减少锁)
      if (callback) {
        const self = this;
        setImmediate(() => callback(null, self));
      }
    } catch (err) {
      if (callback) {
        setImmediate(() => callback(err));
      } else {
        throw err;
      }
    }
  }

  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = null;
    }
    try {
      const { sql: convertedSql, args } = this._convertParams(sql, params);
      const stmt = this._db.prepare(convertedSql);
      const result = this._withLockRetry(() => stmt.run(...args));
      const stmtObj = new Statement();
      stmtObj.lastID = result.lastInsertRowid || 0;
      stmtObj.changes = result.changes || 0;
      if (callback) {
        setImmediate(() => callback.call(stmtObj, null));
      }
    } catch (err) {
      if (callback) setImmediate(() => callback(err));
    }
  }

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = null;
    }
    try {
      const { sql: convertedSql, args } = this._convertParams(sql, params);
      const stmt = this._db.prepare(convertedSql);
      const sqlUpper = convertedSql.trim().toUpperCase();
      const isQuery = /^(SELECT|EXPLAIN|WITH)\s/.test(sqlUpper) ||
        /^PRAGMA\s/.test(convertedSql.trim());
      let rows;
      if (isQuery) {
        try {
          rows = this._withLockRetry(() => stmt.all(...args));
        } catch (e) {
          if (e.message && e.message.includes('does not return data')) {
            this._withLockRetry(() => stmt.run(...args));
            rows = [];
          } else {
            throw e;
          }
        }
      } else {
        this._withLockRetry(() => stmt.run(...args));
        rows = [];
      }
      const stmtObj = new Statement();
      if (callback) {
        setImmediate(() => callback.call(stmtObj, null, rows));
      }
    } catch (err) {
      if (callback) setImmediate(() => callback(err));
    }
  }

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = null;
    }
    try {
      const { sql: convertedSql, args } = this._convertParams(sql, params);
      const stmt = this._db.prepare(convertedSql);
      const row = this._withLockRetry(() => stmt.get(...args));
      const stmtObj = new Statement();
      if (callback) {
        setImmediate(() => callback.call(stmtObj, null, row));
      }
    } catch (err) {
      if (callback) setImmediate(() => callback(err));
    }
  }

  each(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = null;
    }
    try {
      const { sql: convertedSql, args } = this._convertParams(sql, params);
      const stmt = this._db.prepare(convertedSql);
      const sqlUpper = convertedSql.trim().toUpperCase();
      const isQuery = /^(SELECT|EXPLAIN|WITH)\s/.test(sqlUpper) ||
        /^PRAGMA\s/.test(convertedSql.trim());
      let rows = [];
      if (isQuery) {
        try {
          rows = this._withLockRetry(() => stmt.all(...args));
        } catch (e) {
          if (e.message && e.message.includes('does not return data')) {
            this._withLockRetry(() => stmt.run(...args));
            rows = [];
          }
        }
      } else {
        this._withLockRetry(() => stmt.run(...args));
      }
      if (callback) {
        setImmediate(() => {
          if (Array.isArray(rows)) {
            for (const row of rows) {
              callback(null, row);
            }
          }
          callback(null);
        });
      }
    } catch (err) {
      if (callback) setImmediate(() => callback(err));
    }
  }

  /**
   * SQLite "database is locked" 重试: busy_timeout+pragmas 做了大部分兜底,
   * 这里再做一层 JS 侧退让重试(极短 sleep 最多 5 次,总等待 ~1s)应对瞬时双写冲突。
   */
  _withLockRetry(fn, maxRetries = 5, baseMs = 80) {
    let attempt = 0;
    while (true) {
      try { return fn(); }
      catch (err) {
        const msg = err && err.message || '';
        const isLock = /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(msg);
        if (!isLock || attempt >= maxRetries) throw err;
        attempt++;
        this._sleep(baseMs * attempt);
      }
    }
  }

  _sleep(ms) {
    // better-sqlite3 sync 执行里无法用 setTimeout,用 Atomics.wait 做精度足够的短阻塞退避
    if (typeof Atomics !== 'undefined' && typeof Int32Array !== 'undefined') {
      const sab = new SharedArrayBuffer(4);
      const ia = new Int32Array(sab);
      Atomics.wait(ia, 0, 0, ms);
      return;
    }
    const until = Date.now() + ms;
    while (Date.now() < until) { /* 自旋,极端场景下触发才会跑 */ }
  }

  _convertParams(sql, params) {
    if (params === null || params === undefined) {
      return { sql, args: [] };
    }

    if (Array.isArray(params)) {
      return { sql, args: params };
    }

    if (typeof params === 'object') {
      const keys = Object.keys(params);
      const hasNamedParams = keys.some(k => /^\$\d+$/.test(k));

      if (hasNamedParams) {
        const args = [];
        const convertedSql = sql.replace(/\$\d+/g, (match) => {
          const key = match;
          if (params[key] !== undefined) {
            args.push(params[key]);
          }
          return '?';
        });
        return { sql: convertedSql, args };
      }

      return { sql, args: [params] };
    }

    return { sql, args: [params] };
  }

  close(callback) {
    try {
      this._db.close();
      if (callback) setImmediate(() => callback(null));
    } catch (err) {
      if (callback) setImmediate(() => callback(err));
    }
  }

  serialize(callback) {
    if (callback) callback();
  }

  parallelize(callback) {
    if (callback) callback();
  }
}

module.exports = {
  Database: SqliteAdapter,
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4,
  OPEN_FULLMUTEX: 65536,
  sha1: () => {},
  DEFAULT_SCHEMA: 'main',
  VERSION: '6.0.0'
};
