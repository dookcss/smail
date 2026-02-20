# Smail 重构说明（Phase 1-4）

## 概览
本次重构覆盖安全、数据一致性、架构、CI/CD 与 UI 规范化（纯色、无功能性 emoji）。

## Phase 1：核心安全与稳定
- 修复 `home` 路由 `delete` action 未回写 `Set-Cookie` 问题。
- 为邮件详情与附件下载增加会话邮箱归属校验：
  - `app/server/auth/session-mailbox.ts`
  - `app/server/services/email-access.ts`
  - `app/routes/mail.$id.tsx`
  - `app/routes/attachment.$id.tsx`
- 修复邮件正文展示逻辑：去除依赖 iframe 内脚本的高度方案，改为父页面 `onLoad` 计算高度。

## Phase 2：架构重构
- 新增 `app/server/*` 目录，按职责拆分：
  - `auth`：会话与邮箱校验
  - `services`：邮件访问服务
- 路由层简化为：参数校验 + 调用 service + 响应。

## Phase 3：CI/CD 稳定性
- `deploy-cf.yml` 增加部署前必填 secret 预检，失败即早停。
- 保留 KV/D1/R2 自动查找/创建与 Cloudflare API 诊断输出。

## Phase 4：UI 规范化
- 全站去除渐变背景/渐变文本/渐变按钮，改为纯色样式。
- 去除 UI 中功能/装饰 emoji，统一改为图标库（Lucide）或纯文本。
- 相关文件：
  - `app/routes/home.tsx`
  - `app/components/Navigation.tsx`
  - `app/components/Footer.tsx`
  - `app/routes/about.tsx`
  - `app/routes/contact.tsx`
  - `app/routes/faq.tsx`
  - `app/routes/dev.email-handler.tsx`

## 额外说明
- `app/lib/db.ts` 过期清理逻辑已重写：
  - 查过期 mailbox
  - 查关联 emails/attachments
  - 清理 R2 对象
  - 删除 attachments/emails/mailboxes
- 附件 `Cache-Control` 改为 `private, max-age=0, no-store`，降低敏感文件缓存风险。