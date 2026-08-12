import type { ComponentPropsWithoutRef, ReactNode } from "react";

type NativeSurfaceProps = Omit<ComponentPropsWithoutRef<"section">, "children" | "className" | "color" | "style">;

export type SurfaceProps = NativeSurfaceProps &
  Readonly<{
    children: ReactNode;
    size?: "default" | "major";
    tone?: "default" | "subtle" | "intelligence";
  }>;

export function Surface({ children, size = "default", tone = "default", ...nativeProps }: SurfaceProps) {
  return (
    <section {...nativeProps} className="xx-surface" data-size={size} data-tone={tone}>
      {children}
    </section>
  );
}
