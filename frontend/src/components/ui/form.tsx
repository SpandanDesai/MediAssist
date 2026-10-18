import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

export const inputClassName =
  "h-11 w-full rounded-lg border border-rule bg-surface px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-2/70 focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("min-h-24 resize-y py-3 leading-6", inputClassName, className)} {...props} />
));

Textarea.displayName = "Textarea";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClassName, className)} {...props} />
));

Input.displayName = "Input";

/** Native select restyled to match the product's controls (custom chevron, brand focus ring). */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <span className="relative block">
    <select
      ref={ref}
      className={cn(inputClassName, "cursor-pointer appearance-none pr-10", className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden="true" />
  </span>
));

Select.displayName = "Select";

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props}>{children}</label>;
}
