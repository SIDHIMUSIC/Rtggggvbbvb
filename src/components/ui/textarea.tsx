import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg",
        "placeholder:text-faint",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        className,
      )}
      {...props}
    />
  );
}
