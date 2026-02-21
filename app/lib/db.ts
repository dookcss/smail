import { env } from "cloudflare:workers";
import { and, count, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { nanoid } from "nanoid";
import {
	type Attachment,
	type Email,
	type Mailbox,
	type NewAttachment,
	type NewEmail,
	type NewMailbox,
	attachments,
	emails,
	mailboxes,
} from "~/db/schema";

const RAW_EMAIL_PREVIEW_MAX_CHARS = 2048;

type BinaryContent = ArrayBuffer | Uint8Array;

export function createDB() {
	return drizzle(env.DB, { schema: { mailboxes, emails, attachments } });
}

function buildRawEmailPreview(
	parsedEmail: {
		messageId?: string;
		from?: { address?: string };
		subject?: string;
	},
	toAddress: string,
): string {
	const previewLines = [
		`From: ${parsedEmail.from?.address || ""}`,
		`To: ${toAddress}`,
		`Subject: ${parsedEmail.subject || ""}`,
		`Message-ID: ${parsedEmail.messageId || ""}`,
		"[raw MIME stored in R2]",
	];

	return previewLines.join(" | ").slice(0, RAW_EMAIL_PREVIEW_MAX_CHARS);
}

function getBinarySize(content: BinaryContent): number {
	return content.byteLength;
}

export async function uploadRawEmailToR2(
	r2: R2Bucket,
	emailId: string,
	content: BinaryContent,
): Promise<string> {
	const timestamp = Date.now();
	const randomId = nanoid();
	const r2Key = `raw-emails/${timestamp}/${randomId}/${emailId}.eml`;

	await r2.put(r2Key, content, {
		httpMetadata: { contentType: "message/rfc822" },
	});

	return r2Key;
}

export async function getActiveMailboxByEmail(
	db: ReturnType<typeof createDB>,
	email: string,
): Promise<Mailbox | null> {
	const now = new Date();
	const result = await db
		.select()
		.from(mailboxes)
		.where(and(eq(mailboxes.email, email), gt(mailboxes.expiresAt, now)))
		.limit(1);

	return result[0] ?? null;
}

export async function getOrCreateMailbox(
	db: ReturnType<typeof createDB>,
	email: string,
): Promise<Mailbox> {
	const now = new Date();
	const existing = await getActiveMailboxByEmail(db, email);
	if (existing) return existing;

	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
	const newMailbox: NewMailbox = {
		id: nanoid(),
		email,
		expiresAt,
		isActive: true,
	};

	await db.insert(mailboxes).values(newMailbox);

	return {
		...newMailbox,
		createdAt: now,
	} as Mailbox;
}

export async function getEmailsByMailbox(
	db: ReturnType<typeof createDB>,
	mailboxId: string,
	limit = 50,
): Promise<Email[]> {
	return db
		.select()
		.from(emails)
		.where(eq(emails.mailboxId, mailboxId))
		.orderBy(desc(emails.receivedAt))
		.limit(limit);
}

export async function getEmailsByAddress(
	db: ReturnType<typeof createDB>,
	email: string,
	limit = 50,
): Promise<Email[]> {
	const now = new Date();
	return db
		.select({
			id: emails.id,
			mailboxId: emails.mailboxId,
			messageId: emails.messageId,
			fromAddress: emails.fromAddress,
			toAddress: emails.toAddress,
			subject: emails.subject,
			textContent: emails.textContent,
			htmlContent: emails.htmlContent,
			rawEmail: emails.rawEmail,
			rawEmailR2Key: emails.rawEmailR2Key,
			rawEmailR2Bucket: emails.rawEmailR2Bucket,
			rawEmailUploadStatus: emails.rawEmailUploadStatus,
			receivedAt: emails.receivedAt,
			isRead: emails.isRead,
			size: emails.size,
		})
		.from(emails)
		.innerJoin(mailboxes, eq(emails.mailboxId, mailboxes.id))
		.where(and(eq(mailboxes.email, email), gt(mailboxes.expiresAt, now)))
		.orderBy(desc(emails.receivedAt))
		.limit(limit);
}

export async function getEmailById(
	db: ReturnType<typeof createDB>,
	emailId: string,
): Promise<Email | null> {
	const result = await db
		.select()
		.from(emails)
		.where(eq(emails.id, emailId))
		.limit(1);
	return result[0] ?? null;
}

export async function getEmailByIdForMailbox(
	db: ReturnType<typeof createDB>,
	emailId: string,
	mailboxId: string,
): Promise<Email | null> {
	const result = await db
		.select()
		.from(emails)
		.where(and(eq(emails.id, emailId), eq(emails.mailboxId, mailboxId)))
		.limit(1);
	return result[0] ?? null;
}

export async function getEmailAttachments(
	db: ReturnType<typeof createDB>,
	emailId: string,
): Promise<Attachment[]> {
	return db
		.select()
		.from(attachments)
		.where(eq(attachments.emailId, emailId))
		.orderBy(attachments.createdAt);
}

export async function getAttachmentRecordByIdForMailbox(
	db: ReturnType<typeof createDB>,
	attachmentId: string,
	mailboxId: string,
): Promise<Attachment | null> {
	const result = await db
		.select({
			id: attachments.id,
			emailId: attachments.emailId,
			filename: attachments.filename,
			contentType: attachments.contentType,
			size: attachments.size,
			contentId: attachments.contentId,
			isInline: attachments.isInline,
			r2Key: attachments.r2Key,
			r2Bucket: attachments.r2Bucket,
			uploadStatus: attachments.uploadStatus,
			createdAt: attachments.createdAt,
		})
		.from(attachments)
		.innerJoin(emails, eq(attachments.emailId, emails.id))
		.where(and(eq(attachments.id, attachmentId), eq(emails.mailboxId, mailboxId)))
		.limit(1);

	return result[0] ?? null;
}

export async function markEmailAsRead(
	db: ReturnType<typeof createDB>,
	emailId: string,
): Promise<void> {
	await db.update(emails).set({ isRead: true }).where(eq(emails.id, emailId));
}

export async function deleteEmail(
	db: ReturnType<typeof createDB>,
	r2: R2Bucket,
	emailId: string,
): Promise<void> {
	const [email, emailAttachments] = await Promise.all([
		getEmailById(db, emailId),
		getEmailAttachments(db, emailId),
	]);

	const r2Keys = emailAttachments
		.map((item) => item.r2Key)
		.filter((key): key is string => Boolean(key));

	if (email?.rawEmailR2Key) {
		r2Keys.push(email.rawEmailR2Key);
	}

	if (r2Keys.length > 0) {
		await Promise.allSettled(r2Keys.map((key) => r2.delete(key)));
	}

	await db.delete(attachments).where(eq(attachments.emailId, emailId));
	await db.delete(emails).where(eq(emails.id, emailId));
}

export async function cleanupExpiredEmails(
	db: ReturnType<typeof createDB>,
): Promise<void> {
	const now = new Date();
	const expiredMailboxes = await db
		.select({ id: mailboxes.id })
		.from(mailboxes)
		.where(lte(mailboxes.expiresAt, now));

	if (expiredMailboxes.length === 0) return;

	const mailboxIds = expiredMailboxes.map((item) => item.id);
	const expiredEmailRows = await db
		.select({ id: emails.id, rawEmailR2Key: emails.rawEmailR2Key })
		.from(emails)
		.where(inArray(emails.mailboxId, mailboxIds));

	const emailIds = expiredEmailRows.map((item) => item.id);

	if (emailIds.length > 0) {
		const attachmentRows = await db
			.select({ r2Key: attachments.r2Key })
			.from(attachments)
			.where(inArray(attachments.emailId, emailIds));

		const attachmentKeys = attachmentRows
			.map((item) => item.r2Key)
			.filter((key): key is string => Boolean(key));
		const rawEmailKeys = expiredEmailRows
			.map((item) => item.rawEmailR2Key)
			.filter((key): key is string => Boolean(key));

		const r2Keys = [...attachmentKeys, ...rawEmailKeys];
		if (r2Keys.length > 0) {
			await Promise.allSettled(r2Keys.map((key) => env.ATTACHMENTS.delete(key)));
		}

		await db.delete(attachments).where(inArray(attachments.emailId, emailIds));
		await db.delete(emails).where(inArray(emails.id, emailIds));
	}

	await db.delete(mailboxes).where(inArray(mailboxes.id, mailboxIds));
}

export async function getMailboxStats(
	db: ReturnType<typeof createDB>,
	mailboxId: string,
): Promise<{
	total: number;
	unread: number;
}> {
	const [totalResult, unreadResult] = await Promise.all([
		db.select({ count: count() }).from(emails).where(eq(emails.mailboxId, mailboxId)),
		db
			.select({ count: count() })
			.from(emails)
			.where(and(eq(emails.mailboxId, mailboxId), eq(emails.isRead, false))),
	]);

	return {
		total: totalResult[0]?.count || 0,
		unread: unreadResult[0]?.count || 0,
	};
}

export async function uploadAttachmentToR2(
	r2: R2Bucket,
	content: BinaryContent,
	filename: string,
	contentType: string,
): Promise<string> {
	const timestamp = Date.now();
	const randomId = nanoid();
	const r2Key = `attachments/${timestamp}/${randomId}/${filename}`;

	await r2.put(r2Key, content, {
		httpMetadata: { contentType },
	});

	return r2Key;
}

export async function getAttachmentFromR2(
	r2: R2Bucket,
	r2Key: string,
): Promise<R2ObjectBody | null> {
	return r2.get(r2Key);
}

export async function getAttachmentById(attachmentId: string): Promise<{
	attachment: Attachment;
	content: R2ObjectBody | null;
} | null> {
	const db = createDB();
	const attachmentResult = await db
		.select()
		.from(attachments)
		.where(eq(attachments.id, attachmentId))
		.limit(1);

	if (attachmentResult.length === 0) return null;

	const attachment = attachmentResult[0];
	if (!attachment.r2Key || attachment.uploadStatus !== "uploaded") {
		return { attachment, content: null };
	}

	const content = await getAttachmentFromR2(env.ATTACHMENTS, attachment.r2Key);
	return { attachment, content };
}

export async function storeEmail(
	db: ReturnType<typeof createDB>,
	r2: R2Bucket,
	mailboxId: string,
	parsedEmail: {
		messageId?: string;
		from?: { address?: string };
		subject?: string;
		text?: string;
		html?: string;
		attachments?: Array<{
			filename?: string;
			mimeType?: string;
			size?: number;
			contentId?: string;
			related?: boolean;
			content?: BinaryContent;
		}>;
	},
	rawEmailContent: BinaryContent,
	rawSize: number,
	toAddress: string,
): Promise<string> {
	const emailId = nanoid();
	let rawEmailR2Key: string | null = null;
	let rawEmailUploadStatus: "pending" | "uploaded" | "failed" = "pending";

	try {
		rawEmailR2Key = await uploadRawEmailToR2(r2, emailId, rawEmailContent);
		rawEmailUploadStatus = "uploaded";
	} catch (error) {
		console.error("Failed to upload raw email to R2:", error);
		rawEmailUploadStatus = "failed";
	}

	const newEmail: NewEmail = {
		id: emailId,
		mailboxId,
		messageId: parsedEmail.messageId || null,
		fromAddress: parsedEmail.from?.address || "",
		toAddress,
		subject: parsedEmail.subject || null,
		textContent: parsedEmail.text || null,
		htmlContent: parsedEmail.html || null,
		rawEmail: buildRawEmailPreview(parsedEmail, toAddress),
		rawEmailR2Key,
		rawEmailR2Bucket: rawEmailR2Key ? "ATTACHMENTS" : null,
		rawEmailUploadStatus,
		size: rawSize,
		isRead: false,
	};

	await db.insert(emails).values(newEmail);

	if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
		const newAttachments: NewAttachment[] = [];

		for (const attachment of parsedEmail.attachments) {
			const attachmentId = nanoid();
			let r2Key: string | null = null;
			let uploadStatus = "pending";
			let attachmentSize = attachment.size;

			if (!attachmentSize && attachment.content) {
				attachmentSize = getBinarySize(attachment.content);
			}

			if (attachment.content) {
				try {
					r2Key = await uploadAttachmentToR2(
						r2,
						attachment.content,
						attachment.filename || `attachment_${attachmentId}`,
						attachment.mimeType || "application/octet-stream",
					);
					uploadStatus = "uploaded";
				} catch (error) {
					console.error("Failed to upload attachment to R2:", error);
					uploadStatus = "failed";
				}
			}

			newAttachments.push({
				id: attachmentId,
				emailId,
				filename: attachment.filename || null,
				contentType: attachment.mimeType || null,
				size: attachmentSize || null,
				contentId: attachment.contentId || null,
				isInline: attachment.related || false,
				r2Key,
				r2Bucket: r2Key ? "ATTACHMENTS" : null,
				uploadStatus,
			});
		}

		if (newAttachments.length > 0) {
			await db.insert(attachments).values(newAttachments);
		}
	}

	return emailId;
}

