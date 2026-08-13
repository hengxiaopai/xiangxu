"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { sseEnvelopeSchema } from "@xiangxu/contracts";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { applySseInvalidation } from "./invalidation";
import { establishClientSession, retireClientSession } from "./auth-epoch";
import { createClientQueryClient } from "./query-client";
import type { ClientAuthEpoch } from "./query-keys";

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "offline";

interface DailyLoopRuntimeValue {
  readonly authEpoch: ClientAuthEpoch;
  readonly realtimeStatus: RealtimeStatus;
  readonly latestProposalId?: string;
  logout(): Promise<void>;
}

const DailyLoopRuntimeContext = createContext<DailyLoopRuntimeValue | null>(null);

export function DailyLoopProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(createClientQueryClient);
  const [authEpoch, setAuthEpoch] = useState(establishClientSession);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [latestProposalId, setLatestProposalId] = useState<string>();

  useEffect(() => {
    const stream = new EventSource("/api/v1/stream?channels=object.changed,proposal.ready");
    const markDegraded = () => setRealtimeStatus(globalThis.navigator.onLine ? "reconnecting" : "offline");
    const receive = (event: MessageEvent<string>) => {
      let payload: { readonly version?: unknown; readonly data?: unknown };
      try {
        payload = JSON.parse(event.data) as typeof payload;
      } catch {
        markDegraded();
        return;
      }
      const parsed = sseEnvelopeSchema.safeParse({
        event: event.type,
        id: event.lastEventId,
        version: payload.version,
        data: payload.data,
      });
      if (!parsed.success) {
        markDegraded();
        return;
      }
      const envelope = parsed.data;
      setRealtimeStatus("connected");
      if (envelope.event === "proposal.ready") setLatestProposalId(envelope.data.proposalId);
      if ("projectionHints" in envelope.data) {
        void applySseInvalidation(queryClient, envelope.data, authEpoch).catch(markDegraded);
      }
    };
    const online = () => setRealtimeStatus(stream.readyState === EventSource.OPEN ? "connected" : "reconnecting");
    const offline = () => setRealtimeStatus("offline");
    stream.onopen = () => setRealtimeStatus("connected");
    stream.onerror = markDegraded;
    for (const type of ["object.changed", "proposal.ready", "system.resync-required"] as const) {
      stream.addEventListener(type, receive as EventListener);
    }
    globalThis.addEventListener("online", online);
    globalThis.addEventListener("offline", offline);
    return () => {
      stream.close();
      globalThis.removeEventListener("online", online);
      globalThis.removeEventListener("offline", offline);
    };
  }, [authEpoch, queryClient]);

  const logout = async () => {
    await fetch("/api/dev/session", { method: "DELETE", credentials: "same-origin" });
    queryClient.clear();
    setAuthEpoch(retireClientSession());
    globalThis.location.assign("/login");
  };

  const value: DailyLoopRuntimeValue = {
    authEpoch,
    realtimeStatus,
    ...(latestProposalId === undefined ? {} : { latestProposalId }),
    logout,
  };
  return (
    <QueryClientProvider client={queryClient}>
      <DailyLoopRuntimeContext.Provider value={value}>{children}</DailyLoopRuntimeContext.Provider>
    </QueryClientProvider>
  );
}

export function useDailyLoopRuntime(): DailyLoopRuntimeValue {
  const value = useContext(DailyLoopRuntimeContext);
  if (value === null) throw new Error("DailyLoopProvider is required");
  return value;
}
