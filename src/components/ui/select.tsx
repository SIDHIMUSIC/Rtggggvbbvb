import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-[10px] border border-border bg-bg bg-[length:12px] bg-[right_12px_center] bg-no-repeat px-3 pr-9 text-sm text-fg",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%238f978f%22 stroke-width=%221.6%22><path d=%22M2 4l4 4 4-4%22/></svg>')]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
