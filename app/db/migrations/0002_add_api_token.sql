-- 为 mailboxes 表添加 api_token 字段，用于 API 鉴权
ALTER TABLE mailboxes ADD COLUMN api_token TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX idx_mailboxes_api_token ON mailboxes(api_token);