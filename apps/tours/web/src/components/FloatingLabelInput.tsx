"use client";
import { InputHTMLAttributes, useState } from "react";

interface FloatingLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  invalid?: boolean;
}

export function FloatingLabelInput({ label, invalid, className = "", id, ...rest }: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id || label.toLowerCase().replace(/\s/g, "-");
  const bg = invalid ? "bg-chili-tint" : "bg-wine-light-tint";
  const border = invalid ? "border-chili-red" : focused ? "border-primary" : "border-transparent";

  return (
    <div className="relative">
      <label
        htmlFor={inputId}
        className={`absolute left-4 transition-all pointer-events-none font-nunito ${
          focused || rest.value
            ? "top-1 text-xs text-text-espresso-soft"
            : "top-1/2 -translate-y-1/2 text-sm text-text-espresso-soft"
        }`}
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full px-4 pt-5 pb-2 rounded-lg font-nunito text-text-espresso ${bg} ${border} border-2 outline-none transition-colors ${className}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
    </div>
  );
}