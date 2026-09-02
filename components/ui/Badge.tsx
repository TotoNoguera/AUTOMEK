import { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "border-carbon-600 bg-carbon-800 text-carbon-200",
        brand: "border-brand-500/30 bg-brand-500/10 text-brand-400",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        danger: "border-red-500/30 bg-red-500/10 text-red-400",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        info: "border-sky-500/30 bg-sky-500/10 text-sky-400",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
