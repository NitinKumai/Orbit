import React from "react";

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}

export default function IconButton({
  label,
  active = false,
  danger = false,
  children,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={`
        group relative flex h-11 w-11 items-center justify-center
        rounded-full transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-white/30
        ${
          danger
            ? "bg-red-600 text-white hover:bg-red-700"
            : active
            ? "bg-white text-gray-900"
            : "bg-white/10 text-white hover:bg-white/20"
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}