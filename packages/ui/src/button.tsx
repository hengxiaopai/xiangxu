import type { ComponentPropsWithoutRef, ReactNode } from "react";

type NativeButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children" | "className" | "color" | "style">;

export type ButtonProps = NativeButtonProps &
  Readonly<{
    children: ReactNode;
    size?: "sm" | "md" | "lg";
    tone?: "primary" | "secondary";
  }>;

export function Button({ children, size = "md", tone = "primary", ...nativeProps }: ButtonProps) {
  return (
    <button {...nativeProps} className="xx-button" data-size={size} data-tone={tone}>
      {children}
    </button>
  );
}
