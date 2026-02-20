import randomName from "@scaleway/random-name";
import {
	InboxIcon,
	InfoIcon,
	Loader2Icon,
	Mail,
	RefreshCcwIcon,
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
		{ title: "Smail - 临时邮箱" },
		{ name: "description", content: "免费临时邮箱，自动接收邮件。" },
		{ property: "og:url", content: "https://dookcss.xx.kg" },
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
	await new Promise((resolve) => setTimeout(resolve, 600));
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
		<div className="glass-theme">
			<main className="container mx-auto px-4 py-8">
				<div className="max-w-5xl mx-auto">
					<div className="text-center mb-8">
						<h2 className="text-3xl font-bold text-white mb-2">临时邮箱</h2>
						<p className="text-glass">复制地址即可接收邮件，10 秒自动刷新</p>
					</div>

					<div className="grid lg:grid-cols-2 gap-6">
						<Card className="glass-card h-full text-white">
							<CardHeader className="pb-4">
								<CardTitle className="flex items-center space-x-2 text-lg">
									<div className="bg-white/14 rounded-lg p-2 border border-white/20">
										<Mail className="h-5 w-5 text-white" />
									</div>
									<span className="text-white">当前邮箱地址</span>
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="glass-subtle rounded-lg p-4 mb-4">
									<span className="font-mono text-sm sm:text-base font-semibold text-white tracking-wide select-all break-all block">
										{loaderData.email}
									</span>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
									<CopyButton text={loaderData.email} size="default" variant="default" className="w-full h-10" />
									<Form method="post" className="w-full">
										<Button
											variant="outline"
											size="default"
											type="submit"
											name="action"
											value="delete"
											disabled={isDeleting}
											className="w-full h-10"
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

								<div className="glass-subtle rounded-lg p-3 border border-white/15">
									<div className="flex items-start gap-2 text-sm text-glass">
										<InfoIcon className="w-4 h-4 mt-0.5 text-white/80" />
										<p>邮箱 24 小时后自动过期，仅用于临时接收。</p>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="glass-card h-full text-white">
							<CardHeader>
								<div className="flex items-center justify-between gap-2">
									<CardTitle className="flex items-center space-x-2 text-base">
										<InboxIcon className="w-4 h-4" />
										<span>收件箱</span>
										<span className="text-xs text-white/60">{loaderData.stats.unread}/{loaderData.stats.total}</span>
									</CardTitle>
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
													刷新中
												</>
											) : (
												<>
													<RefreshCcwIcon className="w-3 h-3 mr-1" />
													刷新
												</>
											)}
										</Button>
									</Form>
								</div>
							</CardHeader>
							<CardContent className="p-0">
								<ScrollArea className="h-96">
									{loaderData.mails.length > 0 ? (
										<div className="divide-y divide-white/10">
											{loaderData.mails.map((mail) => (
												<MailItem key={mail.id} {...mail} />
											))}
										</div>
									) : (
										<div className="flex flex-col items-center justify-center py-12 text-glass px-4">
											<InboxIcon className="w-10 h-10 mb-3 text-white/45" />
											<p className="text-sm text-center">暂无邮件</p>
										</div>
									)}
								</ScrollArea>
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
		</div>
	);
}

