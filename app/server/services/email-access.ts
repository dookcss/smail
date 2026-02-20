import type { createDB } from "~/lib/db";
import {
	getAttachmentFromR2,
	getAttachmentRecordByIdForMailbox,
	getEmailAttachments,
	getEmailByIdForMailbox,
	markEmailAsRead,
} from "~/lib/db";

export async function getMailDetailForMailbox(
	db: ReturnType<typeof createDB>,
	mailId: string,
	mailboxId: string,
) {
	const email = await getEmailByIdForMailbox(db, mailId, mailboxId);
	if (!email) {
		throw new Response("邮件未找到", { status: 404 });
	}

	if (!email.isRead) {
		await markEmailAsRead(db, email.id);
	}

	const emailAttachments = await getEmailAttachments(db, email.id);
	return { email: { ...email, isRead: true }, attachments: emailAttachments };
}

export async function getAttachmentForMailbox(
	db: ReturnType<typeof createDB>,
	r2: R2Bucket,
	attachmentId: string,
	mailboxId: string,
) {
	const attachment = await getAttachmentRecordByIdForMailbox(
		db,
		attachmentId,
		mailboxId,
	);
	if (!attachment) {
		throw new Response("Attachment not found", { status: 404 });
	}

	if (!attachment.r2Key || attachment.uploadStatus !== "uploaded") {
		throw new Response("Attachment file not available", { status: 404 });
	}

	const content = await getAttachmentFromR2(r2, attachment.r2Key);
	if (!content) {
		throw new Response("Attachment file not available", { status: 404 });
	}

	return { attachment, content };
}