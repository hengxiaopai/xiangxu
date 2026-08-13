"use client";

import { Button } from "@xiangxu/ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useDailyLoopRuntime } from "../state/daily-loop-provider";
import { realtimeStateLabel } from "./daily-loop-model";

export function AppFrame({ children }: Readonly<{ children: ReactNode }>) {
  const { logout, realtimeStatus } = useDailyLoopRuntime();
  const pathname = usePathname();
  const statusLabel = realtimeStateLabel(realtimeStatus);
  return (
    <div className="daily-shell">
      <aside className="daily-shell__sidebar">
        <p className="shell__brand">向序 XIANGXU</p>
        <nav aria-label="向序核心功能">
          <a aria-current={pathname === "/app/today" ? "page" : undefined} href="/app/today">今天</a>
          <span aria-disabled="true">收件箱</span>
          <span aria-disabled="true">任务</span>
          <span aria-disabled="true">日历</span>
          <span aria-disabled="true">项目</span>
          <a aria-current={pathname === "/app/knowledge" ? "page" : undefined} href="/app/knowledge">知识库</a>
          <span aria-disabled="true">空间</span>
          <a aria-current={pathname === "/app/review" ? "page" : undefined} href="/app/review">复盘</a>
        </nav>
        <p aria-live="polite" className="daily-shell__connection" data-status={realtimeStatus}>{statusLabel}</p>
        <Button onClick={() => void logout()} size="sm" tone="secondary" type="button">退出开发会话</Button>
      </aside>
      <main className="daily-shell__main">{children}</main>
    </div>
  );
}
