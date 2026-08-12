import type { ReactNode } from "react";

import "@xiangxu/ui";
import "./shell.css";

export const metadata = {
  title: "XIANGXU Runtime Shell",
  description: "Gate 4.0 Stage 3 runtime shell only.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-theme="light" lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
