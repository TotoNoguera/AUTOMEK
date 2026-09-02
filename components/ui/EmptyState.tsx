import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-carbon-600 bg-carbon-900/40 px-6 py-12 text-center animate-fade-in",
        className
      )}
    >
      {Icon && (
        <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-carbon-800 text-carbon-400">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-medium text-carbon-100">{title}</p>
      {description && <p className="max-w-sm text-xs text-carbon-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}
