import type { createDB } from "~/lib/db";
import { cleanupExpiredEmails } from "~/lib/db";

export function scheduleCleanup(ctx: ExecutionContext, db: ReturnType<typeof createDB>) {
	ctx.waitUntil(cleanupExpiredEmails(db));
}