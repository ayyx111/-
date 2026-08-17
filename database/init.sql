-- ================================================
-- 校园版咸鱼 数据库初始化脚本
-- 数据库:MySQL 8.0
-- ================================================

CREATE DATABASE IF NOT EXISTS campus_fish
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE campus_fish;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  password VARCHAR(255) NOT NULL COMMENT '密码(bcrypt)',
  email VARCHAR(100) UNIQUE COMMENT '邮箱',
  phone VARCHAR(20) UNIQUE COMMENT '手机号',
  student_id VARCHAR(20) UNIQUE COMMENT '学号',
  avatar VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
  nickname VARCHAR(50) DEFAULT NULL COMMENT '昵称',
  bio VARCHAR(200) DEFAULT NULL COMMENT '个性签名',
  school VARCHAR(100) DEFAULT NULL COMMENT '学校',
  college VARCHAR(100) DEFAULT NULL COMMENT '学院',
  enrollment_year INT DEFAULT NULL COMMENT '入学年份',
  role TINYINT NOT NULL DEFAULT 0 COMMENT '角色:0用户 1管理员',
  is_verified TINYINT NOT NULL DEFAULT 0 COMMENT '认证:0未认证 1已认证 2待审核 3未通过',
  credit_score INT NOT NULL DEFAULT 100 COMMENT '信用分',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态:0封禁 1正常',
  last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE COMMENT '分类名称',
  icon VARCHAR(255) DEFAULT NULL COMMENT '分类图标',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分类表';

-- 商品表
CREATE TABLE IF NOT EXISTS products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT '发布者ID',
  category_id INT NOT NULL COMMENT '分类ID',
  title VARCHAR(100) NOT NULL COMMENT '商品标题',
  description TEXT NOT NULL COMMENT '商品描述',
  original_price DECIMAL(10,2) DEFAULT NULL COMMENT '原价',
  price DECIMAL(10,2) NOT NULL COMMENT '售价',
  condition_level TINYINT NOT NULL COMMENT '新旧:1全新 2几乎全新 3轻微使用 4有使用痕迹',
  trade_type TINYINT NOT NULL COMMENT '交易方式:1面交 2邮寄 3均可',
  location VARCHAR(200) DEFAULT NULL COMMENT '交易地点',
  view_count INT DEFAULT 0 COMMENT '浏览量',
  favorite_count INT DEFAULT 0 COMMENT '收藏数',
  status TINYINT NOT NULL DEFAULT 0 COMMENT '状态:0待审核 1在售 2已锁定 3已售 4已下架 5审核拒绝',
  ai_review_result TINYINT DEFAULT NULL COMMENT 'AI审核:0通过 1可疑 2违规',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id),
  INDEX idx_category_id (category_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_price (price),
  FULLTEXT INDEX idx_title_desc (title, description),
  CONSTRAINT fk_product_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

-- 商品图片表
CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT NOT NULL COMMENT '商品ID',
  image_url VARCHAR(500) NOT NULL COMMENT '图片URL',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_product_id (product_id),
  CONSTRAINT fk_image_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品图片表';

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订单编号',
  product_id BIGINT NOT NULL COMMENT '商品ID',
  buyer_id BIGINT NOT NULL COMMENT '买家ID',
  seller_id BIGINT NOT NULL COMMENT '卖家ID',
  price DECIMAL(10,2) NOT NULL COMMENT '成交价格',
  trade_type TINYINT NOT NULL COMMENT '交易方式',
  remark VARCHAR(500) DEFAULT NULL COMMENT '买家备注',
  status TINYINT NOT NULL DEFAULT 0 COMMENT '状态:0待确认 1待交易 2交易中 3已完成 4已取消',
  buyer_confirmed TINYINT DEFAULT 0 COMMENT '买家确认',
  seller_confirmed TINYINT DEFAULT 0 COMMENT '卖家确认',
  product_title VARCHAR(100) DEFAULT NULL COMMENT '商品标题快照(防删除后丢失)',
  confirmed_at DATETIME DEFAULT NULL COMMENT '交易完成时间',
  canceled_at DATETIME DEFAULT NULL COMMENT '取消时间',
  cancel_reason VARCHAR(200) DEFAULT NULL COMMENT '取消原因',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_product_id (product_id),
  INDEX idx_buyer_id (buyer_id),
  INDEX idx_seller_id (seller_id),
  INDEX idx_status (status),
  CONSTRAINT fk_order_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_order_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
  CONSTRAINT fk_order_seller FOREIGN KEY (seller_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 评价表
CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE COMMENT '订单ID',
  from_user_id BIGINT NOT NULL COMMENT '评价人ID',
  to_user_id BIGINT NOT NULL COMMENT '被评价人ID',
  reviewer_role TINYINT NOT NULL DEFAULT 0 COMMENT '评价人角色:0买家 1卖家',
  rating TINYINT NOT NULL COMMENT '评分1-5',
  content VARCHAR(500) DEFAULT NULL COMMENT '评价内容',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_from_user_id (from_user_id),
  INDEX idx_to_user_id (to_user_id),
  CONSTRAINT fk_review_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_from FOREIGN KEY (from_user_id) REFERENCES users(id),
  CONSTRAINT fk_review_to FOREIGN KEY (to_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评价表';

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  from_user_id BIGINT NOT NULL COMMENT '发送者ID',
  to_user_id BIGINT NOT NULL COMMENT '接收者ID',
  product_id BIGINT DEFAULT NULL COMMENT '关联商品ID',
  content TEXT NOT NULL COMMENT '消息内容',
  msg_type TINYINT NOT NULL DEFAULT 0 COMMENT '类型:0文字 1图片',
  is_read TINYINT NOT NULL DEFAULT 0 COMMENT '已读:0否 1是',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  INDEX idx_from_to (from_user_id, to_user_id),
  INDEX idx_product_id (product_id),
  INDEX idx_to_user_read (to_user_id, is_read),
  CONSTRAINT fk_msg_from FOREIGN KEY (from_user_id) REFERENCES users(id),
  CONSTRAINT fk_msg_to FOREIGN KEY (to_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息表';

-- 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  product_id BIGINT NOT NULL COMMENT '商品ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  UNIQUE KEY uk_user_product (user_id, product_id),
  INDEX idx_user_id (user_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';

-- 举报表
CREATE TABLE IF NOT EXISTS reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  reporter_id BIGINT NOT NULL COMMENT '举报人ID',
  target_type TINYINT NOT NULL COMMENT '目标类型:1商品 2用户',
  target_id BIGINT NOT NULL COMMENT '目标ID',
  reason VARCHAR(200) NOT NULL COMMENT '举报原因',
  description TEXT DEFAULT NULL COMMENT '详细描述',
  status TINYINT NOT NULL DEFAULT 0 COMMENT '状态:0待处理 1已处理 2已驳回',
  handle_result VARCHAR(200) DEFAULT NULL COMMENT '处理结果',
  handler_id BIGINT DEFAULT NULL COMMENT '处理人ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '举报时间',
  handled_at DATETIME DEFAULT NULL COMMENT '处理时间',
  INDEX idx_reporter_id (reporter_id),
  INDEX idx_target (target_type, target_id),
  INDEX idx_status (status),
  CONSTRAINT fk_report_user FOREIGN KEY (reporter_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='举报表';

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT '接收用户ID',
  type TINYINT NOT NULL COMMENT '类型:1订单 2审核 3评价 4系统 5聊天',
  title VARCHAR(100) NOT NULL COMMENT '通知标题',
  content VARCHAR(500) NOT NULL COMMENT '通知内容',
  related_id BIGINT DEFAULT NULL COMMENT '关联业务ID',
  is_read TINYINT NOT NULL DEFAULT 0 COMMENT '已读:0否 1是',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_read (user_id, is_read),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';

-- 浏览记录表
CREATE TABLE IF NOT EXISTS user_browse_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  product_id BIGINT NOT NULL COMMENT '商品ID',
  category_id INT DEFAULT NULL COMMENT '商品分类(冗余)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '浏览时间',
  INDEX idx_user_id (user_id),
  INDEX idx_user_category (user_id, category_id),
  CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='浏览记录表';

-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id BIGINT NOT NULL COMMENT '管理员ID',
  action VARCHAR(50) NOT NULL COMMENT '操作类型',
  target_type VARCHAR(50) DEFAULT NULL COMMENT '目标类型',
  target_id BIGINT DEFAULT NULL COMMENT '目标ID',
  detail TEXT DEFAULT NULL COMMENT '操作详情',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT '操作IP',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  CONSTRAINT fk_log_admin FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员操作日志表';

-- 初始化分类数据
INSERT INTO categories (name, sort_order) VALUES
('教材书籍', 1), ('数码电子', 2), ('生活用品', 3),
('服装鞋包', 4), ('运动器材', 5), ('美妆护肤', 6), ('其他', 7);

-- 初始化管理员账号 (密码: admin123, bcrypt加密)
INSERT INTO users (username, password, role, is_verified, status, nickname) VALUES
('admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 1, 1, 1, '系统管理员');
