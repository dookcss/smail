import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0",
	{
		variants: {
			variant: {
				default:
					"border border-white/30 bg-white/16 text-white shadow-[4px_4px_12px_rgba(2,6,23,0.28),-2px_-2px_8px_rgba(255,255,255,0.12)] hover:bg-white/22 active:scale-[0.985] active:shadow-[inset_3px_3px_8px_rgba(2,6,23,0.28),inset_-2px_-2px_8px_rgba(255,255,255,0.1)]",
				destructive:
					"border border-red-300/40 bg-red-500/75 text-white shadow-[4px_4px_12px_rgba(2,6,23,0.28)] hover:bg-red-500/85",
				outline:
					"border border-white/25 bg-white/8 text-white shadow-[inset_2px_2px_6px_rgba(2,6,23,0.25),inset_-1px_-1px_4px_rgba(255,255,255,0.08)] hover:bg-white/14",
				secondary:
					"border border-white/20 bg-white/10 text-white shadow-[3px_3px_10px_rgba(2,6,23,0.22)] hover:bg-white/16",
				ghost: "text-white/90 hover:bg-white/12 hover:text-white",
				link: "text-white underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4 py-2 has-[>svg]:px-3",
				sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
				lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
				icon: "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };

