import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outlined" | "gold-trim" | "text-link";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-wine-muted",
  outlined: "bg-transparent text-primary border border-gold hover:bg-gold/10",
  "gold-trim": "bg-transparent text-primary border border-gold bg-gold/5",
  "text-link": "bg-transparent text-primary underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-base",
  lg: "px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-full font-nunito font-semibold min-h-[44px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}