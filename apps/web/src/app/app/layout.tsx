import type { ReactNode } from "react";

import { AppFrame } from "../../client/daily-loop/app-frame";
import { DailyLoopProvider } from "../../client/state/daily-loop-provider";

export default function DailyLoopLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <DailyLoopProvider>
      <AppFrame>{children}</AppFrame>
    </DailyLoopProvider>
  );
}
