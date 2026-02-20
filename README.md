# Smail - 临时邮箱服务

一个基于 React Router v7 和 Cloudflare Workers 构建的现代化临时邮箱服务。

## 🌟 功能特性

- 🚀 **快速生成**: 一键生成临时邮箱地址
- 📧 **实时接收**: 即时接收和查看邮件
- 🔒 **隐私保护**: 邮箱到期后自动删除数据
- 📱 **响应式设计**: 完美适配桌面和移动设备
- ⚡️ **无服务器架构**: 基于 Cloudflare Workers，全球加速
- 🗄️ **现代化技术栈**: React Router v7、TypeScript、TailwindCSS
- 📊 **数据存储**: 使用 Cloudflare D1 数据库和 R2 对象存储

## 🛠️ 技术栈

- **前端**: React Router v7, TypeScript, TailwindCSS
- **后端**: Cloudflare Workers, Email Workers
- **数据库**: Cloudflare D1 (SQLite)
- **存储**: Cloudflare R2 (附件存储)
- **ORM**: Drizzle ORM
- **邮件解析**: postal-mime

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

复制环境变量示例文件并配置：

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars` 文件，设置必要的环境变量：

```bash
# 生成 Session 密钥
openssl rand -base64 32

# 将生成的密钥填入 .dev.vars 文件中的 SESSION_SECRET
```

### 设置数据库

```bash
# 生成数据库迁移文件
pnpm run db:generate

# 应用迁移到本地数据库
pnpm run db:migrate
```

### 启动开发服务器

```bash
pnpm dev
```

应用将在 http://localhost:5173 可用。

## 🧪 本地开发和测试

### 发送测试邮件

```bash
# 快速发送测试邮件
pnpm run test:email

# 发送自定义测试邮件（带附件）
pnpm run test:email:custom [收件人] [发件人] [端口] [是否包含附件]

# 例如：
pnpm run test:email:custom mytest@dookcss.xx.kg sender@example.com 5173 true
```

### 数据库管理

```bash
# 查看迁移状态
pnpm run db:list

# 重置数据库（清空所有数据）
pnpm run db:reset

# 重新应用迁移
pnpm run db:migrate
```

详细的本地开发指南请查看：[docs/local-development.md](docs/local-development.md)

## 📦 生产环境构建

创建生产构建：

```bash
pnpm run build
```

## 🚀 部署

### 直接部署到生产环境

```bash
pnpm run deploy
```

### 部署预览版本

```bash
pnpm wrangler versions upload
```

验证后可以将版本提升到生产环境：

```bash
pnpm wrangler versions deploy
```

### 部署前准备

1. **配置 Cloudflare 服务**:
   - 创建 D1 数据库：`wrangler d1 create smail-database`
   - 创建 KV 命名空间：`wrangler kv namespace create "smail-kv"`
   - 创建 R2 存储桶：`wrangler r2 bucket create smail-attachments`
   - 设置 Email Routing

2. **配置 wrangler.jsonc**:
   复制 `wrangler.example.jsonc` 并填入你的资源ID：
   ```bash
   cp wrangler.example.jsonc wrangler.jsonc
   # 编辑 wrangler.jsonc，填入实际的ID
   ```

3. **运行远程迁移**:
   ```bash
   pnpm run db:migrate:remote
   ```

## 📂 项目结构

```
├── app/                    # 应用代码
│   ├── components/         # React 组件
│   ├── db/                 # 数据库相关
│   │   ├── migrations/     # 数据库迁移文件
│   │   └── schema.ts       # 数据库模式定义
│   ├── lib/                # 工具函数和数据库操作
│   └── routes/             # 路由组件
├── workers/                # Cloudflare Workers
│   └── app.ts              # Email Worker
├── scripts/                # 开发脚本
│   ├── test-email.js       # 邮件测试脚本
│   └── test-email.sh       # Shell 测试脚本
├── docs/                   # 文档
└── wrangler.jsonc          # Cloudflare 配置
```

## 🎨 样式

项目使用 [Tailwind CSS](https://tailwindcss.com/) 进行样式设计，支持：
- 响应式设计
- 暗色模式
- 现代化 UI 组件
- 自定义设计系统

## 🤝 贡献

欢迎贡献代码！请：

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

## 🛟 支持

如有问题，请：
- 查看 [本地开发指南](docs/local-development.md)
- 提交 GitHub Issue
- 查看 Cloudflare Workers 文档

---

使用 ❤️ 和 React Router 构建。

## 🤖 GitHub Actions 自动部署到 Cloudflare

项目已支持通过工作流自动部署，工作流文件：

- `.github/workflows/deploy-cf.yml`

### 触发方式

- 推送到 `main` 分支自动部署
- 在 GitHub Actions 页面手动触发（`workflow_dispatch`）

### 需要配置的 GitHub Secrets

在仓库 `Settings -> Secrets and variables -> Actions` 中添加：
- `CLOUDFLARE_API_TOKEN`：Cloudflare API Token（需包含 Workers/D1/KV 权限）
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Account ID
- `CF_KV_NAMESPACE_ID`：KV Namespace ID（可选，填了则直接使用）
- `CF_D1_DATABASE_ID`：D1 Database ID（可选，填了则直接使用）
- `CF_SESSION_SECRET`：会话密钥（用于写入 Worker Secret: `SESSION_SECRET`）
- `CF_KV_NAMESPACE_TITLE`（Repository Variable）：KV 名称（可选，默认 `smail-kv`）
- `CF_D1_DATABASE_NAME`（Repository Variable）：D1 名称（可选，默认 `smail-database`）

> 当 `CF_KV_NAMESPACE_ID` / `CF_D1_DATABASE_ID` 未提供时，工作流会自动按名称查找，若不存在则自动创建并继续部署。

### 工作流做了什么

1. 安装依赖并执行类型检查
2. 从 `wrangler.example.jsonc` 生成 `wrangler.jsonc`（注入 KV/D1 ID）
3. 执行 D1 远程迁移
4. 同步 Worker Secret（`SESSION_SECRET`）
5. 执行 `wrangler deploy`

> 如果你的默认分支不是 `main`，请修改 `.github/workflows/deploy-cf.yml` 中的分支名。
> 如果你使用的是不同的数据库名，请同步调整 `package.json` 里的 `db:migrate:remote` 脚本。


## 🌐 域名配置（避免代码写死）

项目已支持通过配置读取域名信息（类似密钥配置方式）：

- `MAIL_DOMAIN`：用于生成临时邮箱后缀（例如 `dookcss.xx.kg`）
- `SITE_URL`：用于 SEO canonical / og:url（例如 `https://mail.dookcss.xx.kg`）

### 本地开发

在 `.dev.vars` 中配置：

```bash
MAIL_DOMAIN=dookcss.xx.kg
SITE_URL=https://mail.dookcss.xx.kg
```

### GitHub Actions 自动部署

在仓库 `Settings -> Secrets and variables -> Actions -> Variables` 中添加：

- `CF_MAIL_DOMAIN`
- `CF_SITE_URL`

工作流会自动将它们注入 `wrangler.jsonc` 中的 `vars`，无需改代码。

