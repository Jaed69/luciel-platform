import { ReactNode } from "react";

type MaxW = "sm" | "md" | "lg";

const sizes: Record<MaxW, string> = {
  sm: "max-w-[480px]",
  md: "max-w-[640px]",
  lg: "max-w-[768px]",
};

export function ContentCard({
  children,
  maxW = "md",
  className = "",
}: {
  children: ReactNode;
  maxW?: MaxW;
  className?: string;
}) {
  return (
    <div
      className={`bg-canvas rounded-xl shadow-lg p-6 border border-gold/30 hover:border-gold/60 transition-colors ${sizes[maxW]} ${className}`}
    >
      {children}
    </div>
  );
}