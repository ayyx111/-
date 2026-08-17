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
      const result = stmt.run(...args);
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
          rows = stmt.all(...args);
        } catch (e) {
          if (e.message && e.message.includes('does not return data')) {
            stmt.run(...args);
            rows = [];
          } else {
            throw e;
          }
        }
      } else {
        stmt.run(...args);
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
      const row = stmt.get(...args);
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
          rows = stmt.all(...args);
        } catch (e) {
          if (e.message && e.message.includes('does not return data')) {
            stmt.run(...args);
            rows = [];
          }
        }
      } else {
        stmt.run(...args);
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
