import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ icon, className, variant = "secondary", children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-ink text-white hover:bg-black dark:bg-white dark:text-ink",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-gray-50 dark:border-white/10 dark:bg-[#202328] dark:text-white dark:hover:bg-[#2a2e35]",
        variant === "ghost" && "text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
