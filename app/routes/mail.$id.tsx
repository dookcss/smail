import {
	ArrowLeft,
	Download,
	File,
	FileText,
	Image,
	Loader2,
	Paperclip,
} from "lucide-react";
import React from "react";
import { Link, data, useNavigation } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { createDB } from "~/lib/db";
import { requireSessionMailbox } from "~/server/auth/session-mailbox";
import { getMailDetailForMailbox } from "~/server/services/email-access";

import type { Route } from "./+types/mail.$id";

function generateEmailHTML(email: {
	fromAddress: string;
	toAddress: string;
	subject?: string | null;
	htmlContent?: string | null;
	textContent?: string | null;
	receivedAt: Date;
}) {
	const content =
		email.htmlContent || email.textContent?.replaceAll(String.fromCharCode(10), "<br>") || "";

	return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>邮件内容</title>
			<style>
				body {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
					line-height: 1.6;
					margin: 20px;
					color: #111827;
					background: #ffffff;
				}
				.email-content {
					max-width: 100%;
					word-wrap: break-word;
				}
				img { max-width: 100%; height: auto; }
				a { color: #1d4ed8; text-decoration: underline; }
				blockquote {
					border-left: 4px solid #e5e7eb;
					margin: 1em 0;
					padding: 0 1em;
					color: #6b7280;
				}
				pre {
					background: #f3f4f6;
					padding: 1em;
					border-radius: 6px;
					overflow-x: auto;
					white-space: pre-wrap;
				}
				table {
					border-collapse: collapse;
					width: 100%;
					margin: 1em 0;
				}
				th, td {
					border: 1px solid #e5e7eb;
					padding: 8px 12px;
					text-align: left;
				}
				th { background: #f9fafb; font-weight: 600; }
			</style>
		</head>
		<body>
			<div class="email-content">${content}</div>
		</body>
		</html>
	`;
}

function getFileIcon(filename?: string | null, contentType?: string | null) {
	if (!filename && !contentType) return <File className="w-4 h-4" />;
	const extension = filename?.toLowerCase().split(".").pop();
	const mimeType = contentType?.toLowerCase();

	if (
		mimeType?.startsWith("image/") ||
		["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension || "")
	) {
		return <Image className="w-4 h-4" />;
	}

	if (
		mimeType?.includes("text/") ||
		["txt", "md", "html", "css", "js", "json"].includes(extension || "")
	) {
		return <FileText className="w-4 h-4" />;
	}

	return <File className="w-4 h-4" />;
}

function formatFileSize(bytes?: number | null) {
	if (!bytes) return "Unknown size";
	const sizes = ["Bytes", "KB", "MB", "GB"];
	if (bytes === 0) return "0 Bytes";
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`;
}

export function meta() {
	return [
		{ title: "邮件详情 - Smail" },
		{ name: "robots", content: "noindex, nofollow" },
	];
}

export async function loader({ request, params }: Route.LoaderArgs) {
	const { id } = params;
	if (!id) throw new Response("邮件 ID 是必需的", { status: 400 });

	const db = createDB();
	const { mailbox } = await requireSessionMailbox(request, db);
	const { email, attachments } = await getMailDetailForMailbox(db, id, mailbox.id);
	const emailHTML = generateEmailHTML(email);

	return data({ email, attachments, emailHTML });
}

export default function MailDetail({ loaderData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const { email, attachments, emailHTML } = loaderData;

	const formattedDate = new Date(email.receivedAt).toLocaleString("zh-CN", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

	const resizeIframe = React.useCallback(() => {
		const iframe = document.getElementById("email-content-iframe") as HTMLIFrameElement | null;
		if (!iframe) return;
		const doc = iframe.contentDocument;
		if (!doc?.body) return;
		const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 600);
		iframe.style.height = `${height}px`;
	}, []);

	return (
		<div className="glass-theme min-h-screen">
			<div className="container mx-auto px-4 py-6 max-w-5xl">
				<div className="glass-card rounded-2xl p-3 sm:p-4 mb-4 text-white">
					<div className="flex items-center justify-between gap-2">
						<Button asChild variant="ghost" size="sm" className="text-white">
							<Link to="/">
								<ArrowLeft className="w-4 h-4" />
								<span className="ml-1">返回</span>
							</Link>
						</Button>
						{navigation.state === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
					</div>
				</div>

				<div className="glass-card rounded-2xl p-4 sm:p-5 text-white mb-4">
					<h1 className="text-base sm:text-lg font-semibold mb-2 break-words">{email.subject || "(无主题)"}</h1>
					<div className="space-y-1 text-xs sm:text-sm text-white/80">
						<div className="truncate"><strong>发件人:</strong> {email.fromAddress}</div>
						<div className="truncate"><strong>收件人:</strong> {email.toAddress}</div>
						<div><strong>时间:</strong> {formattedDate}</div>
					</div>
					<div className="mt-3 flex items-center gap-2">
						<Badge variant={email.isRead ? "secondary" : "default"} className="text-xs">
							{email.isRead ? "已读" : "未读"}
						</Badge>
						<span className="text-xs text-white/65">{formatFileSize(email.size)}</span>
					</div>

					{attachments.length > 0 && (
						<div className="mt-4 pt-4 border-t border-white/15">
							<div className="flex items-center gap-2 mb-2 text-sm">
								<Paperclip className="w-4 h-4" />
								<span>附件 ({attachments.length})</span>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
								{attachments.map((attachment) => (
									<div key={attachment.id} className="glass-subtle rounded-lg border border-white/15 px-2.5 py-2 text-xs flex items-center gap-2">
										{getFileIcon(attachment.filename, attachment.contentType)}
										<div className="flex-1 min-w-0">
											<div className="truncate font-medium">{attachment.filename || "未命名附件"}</div>
											<div className="text-white/65">{formatFileSize(attachment.size)}</div>
										</div>
										{attachment.uploadStatus === "uploaded" ? (
											<a href={`/attachment/${attachment.id}`} className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-white/15" title="下载附件">
												<Download className="w-3.5 h-3.5" />
											</a>
										) : (
											<span className="text-white/50">{attachment.uploadStatus === "pending" ? "处理中" : "失败"}</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="glass-card rounded-2xl overflow-hidden">
					<iframe
						id="email-content-iframe"
						srcDoc={emailHTML}
						className="w-full border-0 bg-white"
						sandbox="allow-same-origin"
						title="邮件内容"
						onLoad={resizeIframe}
					/>
				</div>
			</div>
		</div>
	);
}

