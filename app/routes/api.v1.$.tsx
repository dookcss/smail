import { env } from "cloudflare:workers";
import randomName from "@scaleway/random-name";
import { customAlphabet } from "nanoid";

import { requireApiToken } from "~/server/auth/api-auth";
import { ok, error, paginated } from "~/lib/api-response";
import {
	createDB,
	createMailboxWithToken,
	deactivateMailbox,
	getEmailsByMailboxId,
	getEmailByIdForMailboxDirect,
	getEmailAttachments,
	getMailboxStats,
	markEmailAsRead,
	getNewEmailsSince,
	getAttachmentRecordByIdForMailbox,
	getAttachmentFromR2,
} from "~/lib/db";
import { getPublicRuntimeConfig } from "~/lib/runtime-config";

import type { Route } from "./+types/api.v1.$";

// ==================== 路由分发 ====================

export async function loader({ request, params }: Route.LoaderArgs) {
	return handleApi(request, params["*"] ?? "");
}

export async function action({ request, params }: Route.ActionArgs) {
	return handleApi(request, params["*"] ?? "");
}

async function handleApi(request: Request, path: string) {
	try {
		const method = request.method.toUpperCase();
		const db = createDB();

		// POST /api/v1/mailbox/create — 无需鉴权
		if (path === "mailbox/create" && method === "POST") {
			return handleCreateMailbox(request, db);
		}

		// 以下接口均需鉴权
		const { mailbox } = await requireApiToken(request, db);

		// GET /api/v1/mailbox
		if (path === "mailbox" && method === "GET") {
			return handleGetMailbox(db, mailbox);
		}

		// DELETE /api/v1/mailbox
		if (path === "mailbox" && method === "DELETE") {
			return handleDeleteMailbox(db, mailbox);
		}

		// GET /api/v1/emails
		if (path === "emails" && method === "GET") {
			return handleGetEmails(request, db, mailbox);
		}

		// GET /api/v1/emails/wait
		if (path === "emails/wait" && method === "GET") {
			return handleWaitEmails(request, db, mailbox);
		}

		// GET /api/v1/emails/:id
		const emailMatch = path.match(/^emails\/([^/]+)$/);
		if (emailMatch && method === "GET") {
			return handleGetEmailDetail(db, mailbox, emailMatch[1]);
		}

		// GET /api/v1/attachments/:id
		const attachmentMatch = path.match(/^attachments\/([^/]+)$/);
		if (attachmentMatch && method === "GET") {
			return handleGetAttachment(db, mailbox, attachmentMatch[1]);
		}

		return error("未找到该 API 路由", 404);
	} catch (e) {
		// 如果是已经构造好的 Response（鉴权失败等），直接返回
		if (e instanceof Response) return e;
		console.error("[API] Unhandled error:", e);
		return error("服务器内部错误", 500);
	}
}

// ==================== 创建邮箱 ====================

function generateEmail(mailDomain: string, prefix?: string) {
	if (prefix) {
		const safe = prefix.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 30);
		if (safe.length >= 2) {
			const random = customAlphabet("0123456789", 4)();
			return `${safe}-${random}@${mailDomain}`;
		}
	}
	const name = randomName();
	const random = customAlphabet("0123456789", 4)();
	return `${name}-${random}@${mailDomain}`;
}

async function handleCreateMailbox(
	request: Request,
	db: ReturnType<typeof createDB>,
) {
	const runtimeConfig = getPublicRuntimeConfig(env, request.url);
	let prefix: string | undefined;

	try {
		const body = await request.json<{ prefix?: string }>();
		prefix = body.prefix;
	} catch {
		// body 为空或非 JSON 都可以，使用随机名
	}

	const email = generateEmail(runtimeConfig.mailDomain, prefix);
	const mailbox = await createMailboxWithToken(db, email);

	return ok({
		email: mailbox.email,
		apiToken: mailbox.apiToken,
		mailboxId: mailbox.id,
		expiresAt: mailbox.expiresAt.toISOString(),
	}, 201);
}

// ==================== 查询邮箱 ====================

async function handleGetMailbox(
	db: ReturnType<typeof createDB>,
	mailbox: { id: string; email: string; expiresAt: Date; isActive: boolean },
) {
	const stats = await getMailboxStats(db, mailbox.id);
	return ok({
		email: mailbox.email,
		expiresAt: mailbox.expiresAt.toISOString(),
		isActive: mailbox.isActive,
		stats,
	});
}

// ==================== 删除邮箱 ====================

async function handleDeleteMailbox(
	db: ReturnType<typeof createDB>,
	mailbox: { id: string },
) {
	await deactivateMailbox(db, mailbox.id);
	return ok({ message: "邮箱已销毁" });
}

// ==================== 邮件列表 ====================

async function handleGetEmails(
	request: Request,
	db: ReturnType<typeof createDB>,
	mailbox: { id: string },
) {
	const url = new URL(request.url);
	const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
	const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));

	const { items, total } = await getEmailsByMailboxId(db, mailbox.id, page, limit);

	const emailList = items.map((e) => ({
		id: e.id,
		from: e.fromAddress,
		subject: e.subject || "(无主题)",
		receivedAt: e.receivedAt.toISOString(),
		isRead: e.isRead,
		size: e.size,
	}));

	return paginated(emailList, page, limit, total);
}

// ==================== 邮件详情 ====================

async function handleGetEmailDetail(
	db: ReturnType<typeof createDB>,
	mailbox: { id: string },
	emailId: string,
) {
	const email = await getEmailByIdForMailboxDirect(db, emailId, mailbox.id);
	if (!email) return error("邮件未找到", 404);

	if (!email.isRead) {
		await markEmailAsRead(db, email.id);
	}

	const atts = await getEmailAttachments(db, email.id);

	return ok({
		id: email.id,
		from: email.fromAddress,
		to: email.toAddress,
		subject: email.subject || "(无主题)",
		text: email.textContent,
		html: email.htmlContent,
		receivedAt: email.receivedAt.toISOString(),
		size: email.size,
		attachments: atts.map((a) => ({
			id: a.id,
			filename: a.filename,
			contentType: a.contentType,
			size: a.size,
			isInline: a.isInline,
			uploadStatus: a.uploadStatus,
		})),
	});
}

// ==================== 等待新邮件 ====================

async function handleWaitEmails(
	request: Request,
	db: ReturnType<typeof createDB>,
	mailbox: { id: string },
) {
	const url = new URL(request.url);
	const timeout = Math.min(55, Math.max(1, Number(url.searchParams.get("timeout")) || 30));
	const sinceParam = url.searchParams.get("since");
	const since = sinceParam ? new Date(sinceParam) : new Date();

	const pollInterval = 2000; // 2s
	const deadline = Date.now() + timeout * 1000;

	while (Date.now() < deadline) {
		const newEmails = await getNewEmailsSince(db, mailbox.id, since);
		if (newEmails.length > 0) {
			return ok({
				emails: newEmails.map((e) => ({
					id: e.id,
					from: e.fromAddress,
					subject: e.subject || "(无主题)",
					receivedAt: e.receivedAt.toISOString(),
					isRead: e.isRead,
					size: e.size,
				})),
			});
		}

		// 检查请求是否已被客户端取消
		if (request.signal.aborted) {
			return error("请求已取消", 499);
		}

		await new Promise((r) => setTimeout(r, pollInterval));
	}

	// 超时，返回空
	return ok({ emails: [] });
}

// ==================== 附件下载 ====================

async function handleGetAttachment(
	db: ReturnType<typeof createDB>,
	mailbox: { id: string },
	attachmentId: string,
) {
	const attachment = await getAttachmentRecordByIdForMailbox(db, attachmentId, mailbox.id);
	if (!attachment) return error("附件未找到", 404);

	if (!attachment.r2Key || attachment.uploadStatus !== "uploaded") {
		return error("附件文件不可用", 404);
	}

	const content = await getAttachmentFromR2(env.ATTACHMENTS, attachment.r2Key);
	if (!content) return error("附件文件不可用", 404);

	return new Response(content.body, {
		headers: {
			"Content-Type": attachment.contentType || "application/octet-stream",
			"Content-Disposition": `attachment; filename="${attachment.filename || "attachment"}"`,
			"Content-Length": attachment.size?.toString() || "",
			"Cache-Control": "private, max-age=0, no-store",
		},
	});
}