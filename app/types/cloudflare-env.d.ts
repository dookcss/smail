export {};

declare global {
	namespace Cloudflare {
		interface Env {
			SESSION_SECRET: string;
			MAIL_DOMAIN?: string;
			SITE_URL?: string;
		}
	}
}

