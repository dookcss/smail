import randomName from "@scaleway/random-name";
import {
	Globe2Icon,
	InboxIcon,
	InfoIcon,
	Loader2Icon,
	Mail,
	RefreshCcwIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "lucide-react";
import { customAlphabet } from "nanoid";
import React from "react";
import {
	Form,
	data,
	redirect,
	useNavigation,
	useRevalidator,
} from "react-router";

import { commitSession, getSession } from "~/.server/session";
import { CopyButton } from "~/components/copy-button";
import { MailItem } from "~/components/mail-item";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
	createDB,
	getEmailsByAddress,
	getMailboxStats,
	getOrCreateMailbox,
} from "~/lib/db";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
	return [
		{
			title:
				"Smail - 免费临时邮箱生成器 | 一次性邮箱地址生成 | 24小时有效保护隐私",
		},
		{
			name: "description",
			content:
				"Smail提供最专业的免费临时邮箱服务，无需注册即可获得一次性邮件地址。24小时有效期，支持附件下载，完全匿名保护隐私。告别垃圾邮件，立即免费使用临时邮箱！",
		},
		{
			name: "keywords",
			content:
				"临时邮箱,一次性邮箱,临时邮件,临时email,免费邮箱,隐私保护,垃圾邮件防护,临时邮箱网站,免费临时邮箱,临时邮箱服务,24小时邮箱,无需注册邮箱",
		},
		{ property: "og:title", content: "Smail - 免费临时邮箱生成器 | 一次性邮件地址" },
		{
			property: "og:description",
			content: "保护隐私的免费临时邮箱，无需注册，即时使用，24小时有效，支持附件下载。",
		},
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: "https://dookcss.xx.kg" },
		{ property: "og:site_name", content: "Smail" },
		{ property: "og:locale", content: "zh_CN" },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: "Smail - 免费临时邮箱生成器" },
		{ name: "twitter:description", content: "保护隐私的免费临时邮箱，无需注册，即时使用。" },
		{ name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
		{ name: "googlebot", content: "index, follow" },
		{ name: "bingbot", content: "index, follow" },
		{ name: "format-detection", content: "telephone=no" },
		{ name: "theme-color", content: "#2563eb" },
		{ name: "application-name", content: "Smail" },
		{ name: "apple-mobile-web-app-title", content: "Smail" },
		{ name: "msapplication-TileColor", content: "#2563eb" },
	];
}

function generateEmail() {
	const name = randomName();
	const random = customAlphabet("0123456789", 4)();
	return `${name}-${random}@dookcss.xx.kg`;
}

export async function loader({ request }: Route.LoaderArgs) {
	const session = await getSession(request.headers.get("Cookie"));
	let email = session.get("email");

	if (!email) {
		email = generateEmail();
		session.set("email", email);
		return data(
			{ email, mails: [], stats: { total: 0, unread: 0 } },
			{ headers: { "Set-Cookie": await commitSession(session) } },
		);
	}

	try {
		const db = createDB();
		const mailbox = await getOrCreateMailbox(db, email);
		const emails = await getEmailsByAddress(db, email);
		const stats = await getMailboxStats(db, mailbox.id);

		const mails = emails.map((emailRecord) => ({
			id: emailRecord.id,
			name: emailRecord.fromAddress.split("@")[0] || emailRecord.fromAddress,
			email: emailRecord.fromAddress,
			subject: emailRecord.subject || "(无主题)",
			date: emailRecord.receivedAt.toISOString().split("T")[0],
			isRead: emailRecord.isRead,
		}));

		return { email, mails, stats };
	} catch (error) {
		console.error("Error loading emails:", error);
		return { email, mails: [], stats: { total: 0, unread: 0 } };
	}
}

export async function action({ request }: Route.ActionArgs) {
	await new Promise((resolve) => setTimeout(resolve, 1000));
	const formData = await request.formData();
	const action = formData.get("action");

	if (action === "refresh") {
		return redirect("/");
	}

	if (action === "delete") {
		const session = await getSession(request.headers.get("Cookie"));
		session.set("email", generateEmail());
		return redirect("/", {
			headers: {
				"Set-Cookie": await commitSession(session),
			},
		});
	}

	return null;
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const revalidator = useRevalidator();
	const isSubmitting = navigation.state === "submitting";
	const isRefreshing = navigation.formData?.get("action") === "refresh" && isSubmitting;
	const isDeleting = navigation.formData?.get("action") === "delete" && isSubmitting;

	React.useEffect(() => {
		const interval = setInterval(() => {
			if (
				document.visibilityState === "visible" &&
				navigation.state === "idle" &&
				revalidator.state === "idle"
			) {
				revalidator.revalidate();
			}
		}, 10000);

		const handleFocus = () => {
			if (navigation.state === "idle" && revalidator.state === "idle") {
				revalidator.revalidate();
			}
		};

		window.addEventListener("focus", handleFocus);
		return () => {
			clearInterval(interval);
			window.removeEventListener("focus", handleFocus);
		};
	}, [navigation.state, revalidator]);

	const isAutoRefreshing = revalidator.state === "loading" && navigation.state === "idle";

	return (
		<div className="min-h-screen bg-slate-50">
			<main className="container mx-auto px-4 py-8">
				<div className="max-w-6xl mx-auto">
					<div className="text-center mb-12">
						<h2 className="text-4xl font-bold text-slate-800 mb-4">保护您的隐私临时邮箱</h2>
						<p className="text-lg text-slate-600 max-w-2xl mx-auto">
							无需注册，即时获取临时邮箱地址。24小时有效期，完全免费，保护您的真实邮箱免受垃圾邮件骚扰。
						</p>
					</div>

					<div className="grid lg:grid-cols-2 gap-8">
						<div className="space-y-6">
							<Card className="border border-slate-200 shadow-sm bg-white h-full">
								<CardHeader className="pb-4">
									<CardTitle className="flex items-center space-x-2 text-xl">
										<div className="bg-blue-600 rounded-lg p-2">
											<Mail className="h-5 w-5 text-white" />
										</div>
										<span className="text-slate-800">您的临时邮箱地址</span>
									</CardTitle>
									<div className="flex flex-wrap items-center gap-2 text-sm">
										<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">24小时有效</span>
										<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">自动刷新</span>
										<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">完全免费</span>
									</div>
								</CardHeader>
								<CardContent>
									<div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6">
										<div className="text-center">
											<p className="text-xs text-slate-500 mb-2 font-medium">您的专属邮箱地址</p>
											<span className="font-mono text-base sm:text-lg font-bold text-slate-900 tracking-wide select-all break-all block">
												{loaderData.email}
											</span>
										</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
										<CopyButton
											text={loaderData.email}
											size="default"
											variant="default"
											className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white"
										/>
										<Form method="post" className="w-full">
											<Button
												variant="outline"
												size="default"
												type="submit"
												name="action"
												value="delete"
												disabled={isDeleting}
												className="w-full h-10 border-slate-300 hover:bg-slate-50"
											>
												{isDeleting ? (
													<>
														<Loader2Icon className="w-4 h-4 animate-spin mr-2" />
														生成中...
													</>
												) : (
													"生成新邮箱"
												)}
											</Button>
										</Form>
									</div>

									<div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
										<div className="flex items-start gap-3">
											<div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
												<InfoIcon className="w-4 h-4 text-white" />
											</div>
											<div className="text-sm">
												<p className="font-semibold text-blue-800 mb-1">使用提示</p>
												<p className="text-blue-700 leading-relaxed">
													发送邮件到此地址即可在右侧收件箱查看，邮箱24小时后自动过期。收件箱每10秒自动刷新检查新邮件。
												</p>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>

						<div>
							<Card className="h-full border border-slate-200 shadow-sm">
								<CardHeader>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<CardTitle className="flex items-center space-x-2">
												<InboxIcon className="w-4 h-4" />
												<span>收件箱</span>
											</CardTitle>
											<span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
												{loaderData.stats.unread} 未读
											</span>
											<span className="text-slate-500 text-xs">共 {loaderData.stats.total} 封</span>
										</div>
										<Form method="post">
											<Button
												variant="secondary"
												size="sm"
												name="action"
												value="refresh"
												disabled={isRefreshing || isAutoRefreshing}
												className="text-xs"
											>
												{isRefreshing ? (
													<>
														<Loader2Icon className="w-3 h-3 animate-spin mr-1" />
														刷新中...
													</>
												) : (
													<>
														<RefreshCcwIcon className="w-3 h-3 mr-1" />
														手动刷新
													</>
												)}
											</Button>
										</Form>
									</div>
									{isAutoRefreshing && (
										<div className="text-xs text-blue-600 flex items-center gap-1">
											<Loader2Icon className="w-3 h-3 animate-spin" />
											自动刷新中...
										</div>
									)}
								</CardHeader>
								<CardContent className="p-0">
									<ScrollArea className="h-96">
										{loaderData.mails.length > 0 ? (
											<div className="divide-y">
												{loaderData.mails.map((mail) => (
													<MailItem key={mail.id} {...mail} />
												))}
											</div>
										) : (
											<div className="flex flex-col items-center justify-center py-12 text-slate-500 px-4">
												<InboxIcon className="w-10 h-10 mb-3 text-slate-400" />
												<h3 className="text-lg font-semibold mb-2 text-center">收件箱为空</h3>
												<p className="text-sm text-center">您还没有收到任何邮件</p>
												<p className="text-xs text-slate-400 mt-2 text-center break-all">
													发送邮件到 {loaderData.email} 来测试
												</p>
											</div>
										)}
									</ScrollArea>
								</CardContent>
							</Card>
						</div>
					</div>

					<div className="mt-16">
						<div className="text-center mb-8">
							<h3 className="text-2xl font-bold text-slate-800 mb-2">为什么选择 Smail？</h3>
							<p className="text-slate-600">专业的临时邮箱服务，保护您的隐私安全</p>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<Card className="text-center border border-slate-200">
								<CardContent className="pt-6">
									<ShieldCheckIcon className="w-9 h-9 mx-auto mb-4 text-blue-600" />
									<h4 className="text-lg font-semibold mb-2">隐私保护</h4>
									<p className="text-slate-600 text-sm">保护您的真实邮箱地址，避免垃圾邮件和隐私泄露</p>
								</CardContent>
							</Card>
							<Card className="text-center border border-slate-200">
								<CardContent className="pt-6">
									<ZapIcon className="w-9 h-9 mx-auto mb-4 text-blue-600" />
									<h4 className="text-lg font-semibold mb-2">即时创建</h4>
									<p className="text-slate-600 text-sm">无需注册，一键生成临时邮箱地址，立即开始使用</p>
								</CardContent>
							</Card>
							<Card className="text-center border border-slate-200">
								<CardContent className="pt-6">
									<Globe2Icon className="w-9 h-9 mx-auto mb-4 text-blue-600" />
									<h4 className="text-lg font-semibold mb-2">完全免费</h4>
									<p className="text-slate-600 text-sm">永久免费使用，无隐藏费用，无广告干扰</p>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}

