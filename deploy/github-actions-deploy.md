# ============================================
# GitHub Actions 自动部署配置说明
# ============================================

## 功能
每次 push 到 main 分支，GitHub Actions 自动 SSH 登录云服务器执行部署：
1. git pull 拉取最新代码
2. 安装后端依赖
3. 构建前端
4. 重启后端服务
5. 重载 Nginx

## 配置步骤

### 第一步：在服务器上生成 SSH 密钥对

```bash
# 在云服务器上执行
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions
# 一路回车,不设密码

# 将公钥添加到 authorized_keys
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 查看私钥(复制下面输出的全部内容,包括 -----BEGIN... 和 -----END...)
cat ~/.ssh/github_actions
```

### 第二步：在 GitHub 添加 Secrets

1. 打开仓库: https://github.com/ayyx111/-
2. Settings → Secrets and variables → Actions → New repository secret
3. 逐个添加以下 Secrets：

| Secret 名称 | 值 | 说明 |
|------------|---|------|
| `DEPLOY_HOST` | `8.148.204.95` | 服务器 IP |
| `DEPLOY_USER` | `root` | SSH 用户名 |
| `DEPLOY_SSH_KEY` | 第一步生成的私钥内容 | SSH 私钥 |
| `DEPLOY_PATH` | `/opt/campus-fish` | 项目路径 |
| `DOMAIN` | `http://8.148.204.95` | 网站域名(有域名后改成 https://xxx.com) |
| `DB_ROOT_PASSWORD` | `CampusFish@2026` | MySQL root 密码 |
| `JWT_SECRET` | `campus_fish_jwt_2026_abc123` | JWT 密钥 |
| `JWT_REFRESH_SECRET` | `campus_fish_refresh_2026_xyz789` | JWT 刷新密钥 |
| `ADMIN_PASSWORD` | `admin123` | 管理员密码 |
| `RESEND_API_KEY` | `你的Resend_API_Key` | Resend API Key |
| `RESEND_FROM` | `你的发件邮箱` | 发件邮箱 |

### 第三步：配置 sudo 免密(可选)

如果 Nginx reload 需要 sudo 权限，在服务器上执行：

```bash
echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /usr/bin/systemctl reload nginx, /usr/bin/systemctl restart nginx" | sudo tee /etc/sudoers.d/github-actions
```

### 第四步：推送代码测试

```bash
git push origin main
```

然后在 GitHub 仓库的 Actions 页面查看部署进度。

## 手动触发部署

在 GitHub 仓库 Actions → Deploy to ECS → Run workflow 手动触发。
