import { env } from "cloudflare:workers";
import { createDB } from "~/lib/db";
import { requireSessionMailbox } from "~/server/auth/session-mailbox";
import { getAttachmentForMailbox } from "~/server/services/email-access";

import type { Route } from "./+types/inline-attachment.$id";

const DEFAULT_INLINE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"image/avif",
	"image/bmp",
	"image/x-icon",
]);

function shouldInline(contentType?: string | null) {
	if (!contentType) return false;
	const lower = contentType.toLowerCase();
	if (DEFAULT_INLINE_TYPES.has(lower)) return true;
	if (lower.startsWith("image/")) return true;
	return false;
}

function buildContentDisposition(filename: string, inline: boolean) {
	const safeFilename = filename.replace(/[\r\n"]/g, "_");
	const mode = inline ? "inline" : "attachment";
	return `${mode}; filename="${safeFilename}"`;
}

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

	const contentType = attachment.contentType || "application/octet-stream";
	const inline = attachment.isInline || shouldInline(contentType);
	const filename = attachment.filename || "attachment";

	return new Response(content.body, {
		headers: {
			"Content-Type": contentType,
			"Content-Disposition": buildContentDisposition(filename, inline),
			"Content-Length": attachment.size?.toString() || "",
			"Cache-Control": "private, max-age=300",
			"X-Content-Type-Options": "nosniff",
		},
	});
}