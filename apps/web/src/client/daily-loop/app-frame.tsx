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
        <nav aria-label="Daily Loop">
          <a aria-current={pathname === "/app/today" ? "page" : undefined} href="/app/today">今天</a>
          <a aria-current={pathname === "/app/review" ? "page" : undefined} href="/app/review">复盘</a>
        </nav>
        <p aria-live="polite" className="daily-shell__connection" data-status={realtimeStatus}>{statusLabel}</p>
        <Button onClick={() => void logout()} size="sm" tone="secondary" type="button">退出开发会话</Button>
      </aside>
      <main className="daily-shell__main">{children}</main>
    </div>
  );
}
