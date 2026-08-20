// 格式化与常量工具函数

/**
 * 格式化价格(保留两位小数)
 */
export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '0.00'
  const num = Number(value)
  if (isNaN(num)) return '0.00'
  return num.toFixed(2)
}

/**
 * 格式化时间
 * @param {string|number|Date} time 时间
 * @param {string} fmt 格式 YYYY-MM-DD HH:mm:ss
 */
export function formatTime(time, fmt = 'YYYY-MM-DD HH:mm') {
  if (!time) return ''
  const date = new Date(time)
  if (isNaN(date.getTime())) return ''
  const map = {
    YYYY: date.getFullYear(),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
    ss: String(date.getSeconds()).padStart(2, '0')
  }
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (m) => map[m])
}

/**
 * 相对时间(刚刚 / x分钟前 / x小时前 / x天前)
 */
export function formatRelativeTime(time) {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  return formatTime(time, 'YYYY-MM-DD')
}

/**
 * 图片地址拼接(处理相对路径)
 * 入参兼容:string | {image_url|url} 对象 | 其它(返回默认图)
 */
export function resolveImageUrl(url, defaultImg = '') {
  // 兼容后端返回的 ProductImage 对象 {id, image_url, sort_order}
  if (url && typeof url === 'object' && !Array.isArray(url)) {
    url = url.image_url || url.url || ''
  }
  if (typeof url !== 'string' || !url) return defaultImg
  if (url.startsWith('http') || url.startsWith('data:')) return url
  // 后端返回相对路径时拼接代理前缀
  return url.startsWith('/uploads') ? url : `/${url}`.replace('//', '/')
}

// ============ 业务常量映射 ============

// 新旧程度 1-4
export const CONDITION_MAP = {
  1: { label: '全新', color: 'success' },
  2: { label: '九成新', color: 'primary' },
  3: { label: '七成新', color: 'warning' },
  4: { label: '五成新及以下', color: 'info' }
}

// 交易方式 1面交 2邮寄 3均可
export const TRADE_TYPE_MAP = {
  1: { label: '当面交易', icon: 'Location' },
  2: { label: '邮寄', icon: 'Box' },
  3: { label: '面交/邮寄', icon: 'MapLocation' }
}

// 商品状态 0待审核 1在售 2已售 3已下架 4审核拒绝
export const PRODUCT_STATUS_MAP = {
  0: { label: '待审核', color: 'warning' },
  1: { label: '在售', color: 'success' },
  2: { label: '已售', color: 'info' },
  3: { label: '已下架', color: 'info' },
  4: { label: '审核未通过', color: 'danger' }
}

// 订单状态 0待确认 1待交易 2交易中 3已完成 4已取消
export const ORDER_STATUS_MAP = {
  0: { label: '待卖家确认', color: 'warning' },
  1: { label: '待交易', color: 'primary' },
  2: { label: '交易中', color: 'warning' },
  3: { label: '已完成', color: 'success' },
  4: { label: '已取消', color: 'info' }
}

// 通知类型
export const NOTIFICATION_TYPE_MAP = {
  1: { label: '订单', color: 'primary' },
  2: { label: '系统', color: 'info' },
  3: { label: '聊天', color: 'success' }
}

/**
 * 根据映射获取标签信息
 */
export function getMapLabel(map, key) {
  return map[key] || { label: '未知', color: 'info' }
}
