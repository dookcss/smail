const FALLBACK_MAIL_DOMAIN = "example.com";

export interface PublicRuntimeConfig {
	mailDomain: string;
	siteUrl: string;
	supportEmail: string;
	privacyEmail: string;
	legalEmail: string;
}

export function getPublicRuntimeConfig(
	env: Cloudflare.Env,
	requestUrl?: string,
): PublicRuntimeConfig {
	const mailDomain = (env.MAIL_DOMAIN || FALLBACK_MAIL_DOMAIN).trim();
	const originFromRequest = requestUrl ? new URL(requestUrl).origin : "";
	const siteUrl = (env.SITE_URL || originFromRequest || `https://${mailDomain}`).trim();

	return {
		mailDomain,
		siteUrl,
		supportEmail: `support@${mailDomain}`,
		privacyEmail: `privacy@${mailDomain}`,
		legalEmail: `legal@${mailDomain}`,
	};
}