import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground hover:opacity-90",
      outline: "border bg-background hover:bg-muted",
      ghost: "hover:bg-muted"
    },
    size: { default: "h-10 px-4", sm: "h-9 px-3", lg: "h-11 px-6" }
  },
  defaultVariants: { variant: "default", size: "default" }
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  block?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, block, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, className }), block && "flex w-full")} {...props} />
));
Button.displayName = "Button";
