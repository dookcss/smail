import { Link } from "react-router";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

interface MailItemProps {
	id: string;
	name: string;
	email: string;
	subject: string;
	date: string;
	isRead?: boolean;
}

function formatDate(dateString: string) {
	const date = new Date(dateString);
	const now = new Date();
	const diff = now.getTime() - date.getTime();

	if (!Number.isFinite(diff)) return "--";
	if (diff < 60 * 1000) return "刚刚";
	if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 1000)))}分钟前`;
	if (diff < 24 * 60 * 60 * 1000) return "今天";
	if (diff < 48 * 60 * 60 * 1000) return "昨天";

	return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function MailItem({
	id,
	name,
	email,
	subject,
	date,
	isRead = true,
}: MailItemProps) {
	const safeName = (name || email || "?").trim();
	const initials = safeName.slice(0, 2).toUpperCase();

	return (
		<Link
			to={`/mail/${id}`}
			className={cn(
				"block w-full rounded-xl border p-3 sm:p-4 transition-all",
				"bg-white/7 border-white/14 hover:bg-white/12 hover:border-white/24",
				!isRead && "bg-white/14 border-white/28",
			)}
		>
			<div className="flex items-start gap-3 sm:gap-4 min-w-0">
				<Avatar className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 border border-white/22 bg-white/10">
					<AvatarFallback className="text-xs sm:text-sm text-white bg-transparent">
						{initials}
					</AvatarFallback>
				</Avatar>

				<div className="flex-1 min-w-0 space-y-1">
					<div className="flex items-center justify-between gap-2">
						<span className={cn("text-sm truncate text-white/92", !isRead && "font-semibold text-white")}>
							{safeName}
						</span>
						<span className="text-[11px] sm:text-xs text-white/65 flex-shrink-0">
							{formatDate(date)}
						</span>
					</div>

					<div className="text-xs text-white/65 truncate">{email}</div>
					<div className={cn("text-xs sm:text-sm truncate text-white/78", !isRead && "text-white/96 font-medium")}>
						{subject}
					</div>
				</div>
			</div>
		</Link>
	);
}

	);
}
