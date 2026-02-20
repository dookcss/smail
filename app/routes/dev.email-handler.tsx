import PostalMime from "postal-mime";
import type { ActionFunctionArgs } from "react-router";
import {
	cleanupExpiredEmails,
	createDB,
	getOrCreateMailbox,
	storeEmail,
} from "~/lib/db";

interface ParsedEmail {
	messageId?: string;
	from?: {
		name?: string;
		address?: string;
	};
	to?: Array<{
		name?: string;
		address?: string;
	}>;
	subject?: string;
	text?: string;
	html?: string;
	attachments?: Array<{
		filename?: string;
		mimeType?: string;
		size?: number;
		contentId?: string;
		related?: boolean;
		content?: ArrayBuffer;
	}>;
}

export async function action({ request }: ActionFunctionArgs) {
	if (import.meta.env.PROD) {
		throw new Response("Not Found", { status: 404 });
	}

	try {
		console.log("[DEV] Simulating email handler...");

		const url = new URL(request.url);
		const fromAddress = url.searchParams.get("from");
		const toAddress = url.searchParams.get("to");

		if (!fromAddress || !toAddress) {
			throw new Response("Missing from or to parameter", { status: 400 });
		}

		console.log(`[DEV] Simulated email: ${fromAddress} -> ${toAddress}`);

		const rawEmail = await request.text();
		const rawEmailBuffer = new TextEncoder().encode(rawEmail);
		console.log(`[DEV] Raw email size: ${rawEmailBuffer.length} bytes`);

		const parsedEmail = (await PostalMime.parse(rawEmailBuffer)) as ParsedEmail;
		console.log(`[DEV] Parsed subject: ${parsedEmail.subject}`);
		console.log(`[DEV] Parsed from: ${parsedEmail.from?.address}`);

		const db = createDB();
		const mailbox = await getOrCreateMailbox(db, toAddress);
		console.log(`[DEV] Found/Created mailbox: ${mailbox.id} for ${mailbox.email}`);

		const { env } = await import("cloudflare:workers");
		const emailId = await storeEmail(
			db,
			env.ATTACHMENTS,
			mailbox.id,
			parsedEmail,
			rawEmail,
			rawEmailBuffer.length,
			toAddress,
		);

		console.log(`[DEV] Email stored successfully with ID: ${emailId}`);
		cleanupExpiredEmails(db).catch((error) => {
			console.error("[DEV] Failed to cleanup expired emails:", error);
		});

		return Response.json({
			success: true,
			emailId,
			message: "Email processed successfully in development mode with R2 storage",
		});
	} catch (error) {
		console.error("[DEV] Error processing email:", error);
		return Response.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

export function meta() {
	return [
		{ title: "开发环境邮件处理器 - Smail" },
		{
			name: "description",
			content: "开发环境专用的邮件处理路由，用于模拟 Cloudflare Workers 的 email handler 功能。",
		},
		{ name: "robots", content: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
		{ name: "googlebot", content: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
		{ name: "bingbot", content: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
	];
}

export function loader() {
	return Response.json({ message: "Development email handler - use POST to simulate email processing" });
}

export default function DevEmailHandler() {
	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold mb-4">开发环境邮件处理器</h1>
			<p className="text-gray-600 mb-4">
				这是一个开发环境专用的邮件处理路由，用于模拟 Cloudflare Workers 的 email handler 功能。
			</p>

			<div className="bg-blue-50 p-4 rounded-lg">
				<h2 className="font-semibold mb-2">使用方法：</h2>
				<code className="text-sm bg-gray-100 p-2 rounded block">
					POST /dev/email-handler?from=sender@example.com&to=recipient@example.com
				</code>
			</div>

			<div className="mt-4 bg-green-50 p-4 rounded-lg">
				<p className="text-sm text-green-800">
					开发环境支持完整功能：邮件解析、R2附件上传、数据库存储
				</p>
			</div>

			<div className="mt-4 bg-yellow-50 p-4 rounded-lg">
				<p className="text-sm text-yellow-800">
					注意：这个路由仅在开发环境中可用，生产环境会返回404。
				</p>
			</div>
		</div>
	);
}

