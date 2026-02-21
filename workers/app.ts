import PostalMime from "postal-mime";
import { createRequestHandler } from "react-router";
import {
	cleanupExpiredEmails,
	createDB,
	getOrCreateMailbox,
	storeEmail,
} from "../app/lib/db";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

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
		content?: ArrayBuffer | Uint8Array;
	}>;
}

export default {
	async fetch(request, env, ctx) {
		return requestHandler(request, {
			cloudflare: { env, ctx },
		});
	},
	async email(
		message: ForwardableEmailMessage,
		env: Env,
		ctx: ExecutionContext,
	): Promise<void> {
		try {
			console.log(
				`📧 Received email: ${message.from} -> ${message.to}, size: ${message.rawSize}`,
			);

			const db = createDB();
			ctx.waitUntil(cleanupExpiredEmails(db));

			const rawEmailArray = await new Response(message.raw).arrayBuffer();
			const parsedEmail = (await PostalMime.parse(rawEmailArray)) as ParsedEmail;

			console.log(
				`📝 Parsed email from: ${parsedEmail.from?.address}, subject: ${parsedEmail.subject}, attachments: ${parsedEmail.attachments?.length || 0}`,
			);

			const mailbox = await getOrCreateMailbox(db, message.to);

			console.log(
				`📦 Found/Created mailbox: ${mailbox.id} for ${mailbox.email}`,
			);

			const emailId = await storeEmail(
				db,
				env.ATTACHMENTS,
				mailbox.id,
				parsedEmail,
				rawEmailArray,
				message.rawSize,
				message.to,
			);

			console.log(`✅ Email stored successfully with ID: ${emailId}`);
		} catch (error) {
			console.error("❌ Error processing email:", error);
		}
	},
} satisfies ExportedHandler<Env>;

