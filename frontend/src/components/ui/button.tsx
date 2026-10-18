import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg hover:bg-brand-strong active:scale-[.99]",
        secondary: "bg-surface text-ink border border-rule hover:bg-surface-alt active:scale-[.99]",
        outline: "border border-rule bg-surface text-ink hover:bg-surface-alt",
        ghost: "text-ink-2 hover:bg-surface-alt hover:text-ink",
        danger: "bg-danger text-danger-fg hover:opacity-90",
        "danger-outline": "border border-danger/40 bg-surface text-danger hover:bg-danger-tint",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-4",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));

Button.displayName = "Button";

export { buttonVariants };
