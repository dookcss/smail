import type { createDB } from "~/lib/db";
import { getSession } from "~/.server/session";
import { getActiveMailboxByEmail } from "~/lib/db";

export async function requireSessionMailbox(
	request: Request,
	db: ReturnType<typeof createDB>,
) {
	const session = await getSession(request.headers.get("Cookie"));
	const email = session.get("email") as string | undefined;

	if (!email) {
		throw new Response("未找到邮箱会话", { status: 401 });
	}

	const mailbox = await getActiveMailboxByEmail(db, email);
	if (!mailbox) {
		throw new Response("邮箱会话已过期", { status: 401 });
	}

	return { sessionEmail: email, mailbox };
}