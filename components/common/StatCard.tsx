import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

const toneStyles = {
  brand: "bg-brand-500/10 text-brand-400",
  success: "bg-emerald-500/10 text-emerald-400",
  danger: "bg-red-500/10 text-red-400",
  warning: "bg-amber-500/10 text-amber-400",
  neutral: "bg-carbon-700 text-carbon-200",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  trend,
  className,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: keyof typeof toneStyles;
  trend?: { value: string; positive: boolean };
  className?: string;
}) {
  return (
    <Card className={cn("p-4 transition-transform hover:-translate-y-0.5", className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-carbon-400">{label}</p>
        {Icon && (
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneStyles[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
      {trend && (
        <div
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 text-xs font-medium",
            trend.positive ? "text-emerald-400" : "text-red-400"
          )}
        >
          {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend.value}
        </div>
      )}
    </Card>
  );
}
