import type { ReactNode } from "react";

import "./shell.css";
import "@xiangxu/ui";

export const metadata = {
  title: "向序 XIANGXU",
  description: "可验证的 Daily Loop：计划、执行与复盘。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-theme="light" lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
