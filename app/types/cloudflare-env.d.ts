export {};

declare global {
	interface Env {
		SESSION_SECRET: string;
	}
}