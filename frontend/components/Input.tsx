import React from "react";

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <input
        {...props}
        className={`
          w-full rounded-lg border bg-white px-3.5 py-2.5
          text-sm text-gray-900
          placeholder:text-gray-400
          outline-none transition
          ${
            error
              ? "border-red-400 focus:border-red-500"
              : "border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          }
          ${className}
        `}
      />

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}