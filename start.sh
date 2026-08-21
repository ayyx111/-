#!/usr/bin/env bash
# ==========================================================
# 校园版咸鱼 — CloudStudio 一键启动脚本
# 自动安装依赖并同时启动前后端服务
# ==========================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_NAME="校园版咸鱼"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  ${APP_NAME} — CloudStudio 全栈启动 ${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# --------------- 后端 .env 自动生成 ---------------
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo -e "${YELLOW}[0/4] 生成后端 .env 配置...${NC}"
  cat > "$BACKEND_DIR/.env" << 'ENVEOF'
# CloudStudio 自动生成配置
NODE_ENV=development
PORT=3000

# SQLite 数据库(零配置,开箱即用)
DB_TYPE=sqlite
DB_SYNC=true

# JWT
JWT_SECRET=cloudstudio_campus_fish_jwt_2026
JWT_REFRESH_SECRET=cloudstudio_campus_fish_refresh_2026

# 文件上传
UPLOAD_DIR=uploads
UPLOAD_PUBLIC_BASE_URL=

# 管理员
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 跨域
CORS_ORIGIN=*

# 邮件:Resend API(CloudStudio 可能封锁 SMTP 端口,用 Resend HTTP API)
# 请在 CloudStudio 环境变量中设置 RESEND_API_KEY 和 RESEND_FROM
RESEND_API_KEY=
RESEND_FROM=campus-fish@campusfish.qd.je
ENVEOF
  echo -e "${GREEN}  .env 已生成${NC}"
fi

# --------------- 后端 ---------------
echo -e "${YELLOW}[1/4] 安装后端依赖...${NC}"
cd "$BACKEND_DIR"
npm install --production 2>/dev/null || npm install

echo -e "${YELLOW}[2/4] 启动后端服务 (端口 3000)...${NC}"
cd "$BACKEND_DIR"
node src/app.js &
BACKEND_PID=$!
echo -e "${GREEN}  后端 PID: $BACKEND_PID${NC}"

# 等待后端就绪
sleep 3

# --------------- 前端 ---------------
echo -e "${YELLOW}[3/4] 安装前端依赖...${NC}"
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  npm install
fi

echo -e "${YELLOW}[4/4] 启动前端开发服务器 (端口 5173)...${NC}"
cd "$FRONTEND_DIR"
npx vite --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!
echo -e "${GREEN}  前端 PID: $FRONTEND_PID${NC}"

# --------------- 完成 ---------------
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  ${APP_NAME} 已启动！${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "  前端地址:  ${GREEN}http://localhost:5173${NC}"
echo -e "  后端地址:  ${GREEN}http://localhost:3000${NC}"
echo -e "  API 文档:  ${GREEN}http://localhost:3000/api/v1${NC}"
echo ""
echo -e "  ${YELLOW}CloudStudio 会自动检测打开的端口,${NC}"
echo -e "  ${YELLOW}生成可公开访问的预览链接。${NC}"
echo ""
echo -e "  ${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

cleanup() {
  echo ""
  echo -e "${YELLOW}正在停止服务...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}服务已停止。${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

wait
