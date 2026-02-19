export {};

declare global {
	namespace Cloudflare {
		interface Env {
			SESSION_SECRET: string;
		}
	}
}

