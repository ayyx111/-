/**
 * WS 单例助手:把 app.js 创建的 io 实例暴露给业务层(如 notificationService),
 * 避免业务模块需要依赖 app.js 导致循环引用。
 */
let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

module.exports = { setIo, getIo };
