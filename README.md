# Smail

基于 **React Router v7 + Cloudflare Workers** 的临时邮箱服务，支持接收邮件、查看邮件详情、附件存储（R2）与自动过期清理。

---

## 1. 项目功能

- 一键生成临时邮箱地址
- 接收并展示邮件列表
- 查看邮件详情（文本/HTML）
- 附件上传到 Cloudflare R2
- D1 持久化存储（mailboxes / emails / attachments）
- Session 隔离访问（仅可查看当前会话邮箱）

---

## 2. 技术栈

- 前端：React Router v7、TypeScript、Tailwind CSS v4
- 后端：Cloudflare Workers（含 Email Worker）
- 数据库：Cloudflare D1
- 对象存储：Cloudflare R2
- ORM：Drizzle ORM
- 邮件解析：postal-mime

---

## 3. 本地开发

### 3.1 安装依赖

```bash
pnpm install
```

### 3.2 配置本地环境变量

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`：

```env
SESSION_SECRET=请替换为openssl生成的随机串
MAIL_DOMAIN=your-domain.example
SITE_URL=https://mail.your-domain.example
```

生成 `SESSION_SECRET` 示例：

```bash
openssl rand -base64 32
```

### 3.3 初始化数据库（本地）

```bash
pnpm run db:generate
pnpm run db:migrate
```

### 3.4 启动开发服务

```bash
pnpm dev
```

- 前端默认：`http://localhost:5173`
- Worker 本地端口由 Wrangler 管理（测试邮件脚本默认 8787）

### 3.5 发送测试邮件

```bash
pnpm run test:email
# 或
pnpm run test:email:custom <to> <from> <port>
```

---

## 4. 部署教程（重点）

下面提供两种方式：**GitHub Actions 自动部署（推荐）** 和 **本地手动部署**。

---

### 4.1 前置条件

1. Cloudflare 账号
2. 已接入并可管理的域名（用于邮件域名）
3. 已安装 Node.js 22+、pnpm、Wrangler
4. GitHub 仓库（使用 CI 自动部署时）

---

### 4.2 Cloudflare 侧准备

> 本项目 CI 支持自动创建/自动发现 KV、D1、R2（按名称），但你仍需准备账号权限与邮件路由。

#### A) 邮件相关

- 在 Cloudflare 控制台启用 **Email Routing**
- 为你的域名配置可接收地址（catch-all 或指定地址）
- 确保收件域名与 `MAIL_DOMAIN` 一致

#### B) API Token 权限（CI 必需）

`CLOUDFLARE_API_TOKEN` 至少需要：

- Workers Scripts（编辑）
- Workers Routes（如使用路由）
- D1（读写）
- KV（读写）
- R2（读写）
- Account 级资源读取权限

> 若出现 403，大多是 Token 权限不足、账号范围不匹配或 Token 限制了 IP。

---

### 4.3 GitHub Actions 自动部署（推荐）

工作流文件：`.github/workflows/deploy-cf.yml`

#### 第一步：配置 GitHub Secrets

仓库路径：`Settings -> Secrets and variables -> Actions -> Secrets`

必填：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_SESSION_SECRET`

可选（不填则自动发现/创建）：

- `CF_KV_NAMESPACE_ID`
- `CF_D1_DATABASE_ID`

#### 第二步：配置 GitHub Variables（注意不是 Secrets）

仓库路径：`Settings -> Secrets and variables -> Actions -> Variables`

建议填写：

- `CF_MAIL_DOMAIN`（例如：`dookcss.xx.kg`）
- `CF_SITE_URL`（例如：`https://mail.dookcss.xx.kg`）
- `CF_KV_NAMESPACE_TITLE`（默认：`smail-kv`）
- `CF_D1_DATABASE_NAME`（默认：`smail-database`）
- `CF_R2_BUCKET_NAME`（默认：`smail-attachments`）
- `CF_R2_PREVIEW_BUCKET_NAME`（默认：`smail-attachments-preview`）

> 关键：工作流读取的是 `vars.*`，如果你把 `CF_MAIL_DOMAIN` 配到 Secrets，部署会回退到 `example.com`。

#### 第三步：Cloudflare 控制台必须完成的设置

1. **Workers 自定义域名绑定**（推荐）
   - Cloudflare Dashboard -> Workers & Pages -> 你的 Worker -> Triggers / Custom Domains
   - 绑定站点域名，例如：`mail.dookcss.xx.kg`

2. **DNS 记录确认**
   - 若使用 Custom Domain，Cloudflare 通常会自动创建/接管对应记录；
   - 若手动管理 DNS，确保 `mail` 子域正确指向 Worker。

3. **Email Routing 开启并可接收**
   - 开启 Email Routing；
   - 配置 catch-all 或明确收件地址；
   - 收件域需与 `CF_MAIL_DOMAIN` 一致（本示例为 `dookcss.xx.kg`）。

4. **R2 / D1 / KV 资源可访问**
   - 账号内可创建并读写对应资源；
   - Token 对这些资源具备读写权限。

#### 第四步：触发部署

- 推送到 `main` 分支，或
- 在 Actions 页面手动执行 `Deploy to Cloudflare Workers`

#### 第五步：验证部署

在构建日志中确认：

- `MAIL_DOMAIN` 是你的域名（不是 `example.com`）
- `SITE_URL` 是你的站点地址
- Deploy 步骤成功

线上访问示例：`https://mail.dookcss.xx.kg/`

首次生效时，如页面仍显示旧域名邮箱，请点击“生成新邮箱”或清 Cookie（会话缓存旧邮箱）。

#### 第六步：本项目示例配置（可直接参考）

- `CF_MAIL_DOMAIN=dookcss.xx.kg`
- `CF_SITE_URL=https://mail.dookcss.xx.kg`
- 站点地址：`https://mail.dookcss.xx.kg/`

---

### 4.4 本地手动部署（可选）

#### 第一步：生成生产配置

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

将以下占位符替换为真实值：

- `YOUR_KV_NAMESPACE_ID_HERE`
- `YOUR_D1_DATABASE_ID_HERE`
- `__MAIL_DOMAIN__`
- `__SITE_URL__`

#### 第二步：设置 Worker Secret

```bash
wrangler secret put SESSION_SECRET
```

#### 第三步：执行远程迁移

```bash
pnpm run db:migrate:remote
```

#### 第四步：部署

```bash
pnpm run deploy
```

---

## 5. 常用命令

```bash
pnpm dev                  # 本地开发
pnpm run build            # 构建
pnpm run deploy           # 部署
pnpm run typecheck        # 类型检查
pnpm run db:generate      # 生成迁移
pnpm run db:migrate       # 本地迁移
pnpm run db:migrate:remote# 远程迁移
pnpm run db:list          # 查看迁移状态
pnpm run db:reset         # 重置本地数据库
pnpm run test:email       # 发送测试邮件
```

---

## 6. 故障排查速查

### 1) 页面邮箱域名还是 `example.com`

- 检查 Actions Variables 是否存在：`CF_MAIL_DOMAIN`、`CF_SITE_URL`
- 检查构建日志中 `MAIL_DOMAIN` 实际值
- 清 Cookie 或重新生成邮箱（避免旧会话缓存）

### 2) 部署报 403

- 检查 `CLOUDFLARE_API_TOKEN` 权限范围
- 检查 token 是否绑定了正确 account

### 3) 部署报 504（Cloudflare API 超时）

- 平台波动，通常重试即可

### 4) D1 报表不存在

```bash
pnpm run db:migrate:remote
```

---

## 7. 致谢

本项目基于 [akazwz/smail](https://github.com/akazwz/smail.git) 进行二次开发，在原项目的基础上完成了适配与功能调整。感谢原作者及贡献者的开源工作。


## 8. 许可证

MIT

