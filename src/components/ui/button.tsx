import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-[opacity,transform,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg hover:opacity-90",
        secondary:
          "border border-border bg-surface-2 text-fg hover:bg-surface",
        ghost: "text-muted hover:bg-surface-2 hover:text-fg",
        danger: "bg-danger text-fg hover:opacity-90",
        outline: "border border-border bg-transparent text-fg hover:bg-surface-2",
      },
      size: {
        default: "h-11 rounded-[10px] px-4",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-5",
        icon: "size-11 rounded-[10px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };
