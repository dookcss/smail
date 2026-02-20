import { env } from "cloudflare:workers";
import { createDB } from "~/lib/db";
import { requireSessionMailbox } from "~/server/auth/session-mailbox";
import { getAttachmentForMailbox } from "~/server/services/email-access";

import type { Route } from "./+types/attachment.$id";

export async function loader({ request, params }: Route.LoaderArgs) {
	const { id } = params;
	if (!id) {
		throw new Response("Attachment ID is required", { status: 400 });
	}

	const db = createDB();
	const { mailbox } = await requireSessionMailbox(request, db);
	const { attachment, content } = await getAttachmentForMailbox(
		db,
		env.ATTACHMENTS,
		id,
		mailbox.id,
	);

	return new Response(content.body, {
		headers: {
			"Content-Type": attachment.contentType || "application/octet-stream",
			"Content-Disposition": `attachment; filename="${attachment.filename || "attachment"}"`,
			"Content-Length": attachment.size?.toString() || "",
			"Cache-Control": "private, max-age=0, no-store",
		},
	});
}

