import { and, eq, gt } from "drizzle-orm";
import type { createDB } from "~/lib/db";
import { mailboxes } from "~/db/schema";
import { error } from "~/lib/api-response";

export async function requireApiToken(
	request: Request,
	db: ReturnType<typeof createDB>,
) {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		throw error("缺少 Authorization 头，格式: Bearer <apiToken>", 401);
	}

	const token = authHeader.slice(7).trim();
	if (!token) {
		throw error("API Token 不能为空", 401);
	}

	const now = new Date();
	const result = await db
		.select()
		.from(mailboxes)
		.where(
			and(
				eq(mailboxes.apiToken, token),
				eq(mailboxes.isActive, true),
				gt(mailboxes.expiresAt, now),
			),
		)
		.limit(1);

	const mailbox = result[0];
	if (!mailbox) {
		throw error("API Token 无效或已过期", 401);
	}

	return { mailbox };
}