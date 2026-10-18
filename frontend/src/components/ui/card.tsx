import { cn } from "../../lib/utils";

export function Card({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("rounded-2xl border border-rule bg-surface shadow-card", className)}>{children}</section>;
}

export function CardHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-4 p-5 pb-0", className)}>{children}</div>;
}

export function CardContent({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
