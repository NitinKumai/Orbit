import React from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "ghost";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    secondary:
      "bg-gray-900 text-white hover:bg-gray-800 shadow-sm",
    outline:
      "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
    danger:
      "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost:
      "bg-transparent text-gray-700 hover:bg-gray-100",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-lg px-4 py-2.5
        text-sm font-medium
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-indigo-500/30
        disabled:cursor-not-allowed disabled:opacity-50
        ${variants[variant]}
        ${className}
      `}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}

      {children}
    </button>
  );
}