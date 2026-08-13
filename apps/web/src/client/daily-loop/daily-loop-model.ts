import type { PlanSnapshotDto, ReviewSnapshotDto } from "@xiangxu/contracts";

export type ProjectionState = "loading" | "empty" | "data" | "error";

export function projectionState<T>(input: {
  readonly pending: boolean;
  readonly error: boolean;
  readonly data: T | null | undefined;
}): ProjectionState {
  if (input.pending) return "loading";
  if (input.error) return "error";
  return input.data === null || input.data === undefined ? "empty" : "data";
}

export function hasActualEvidence(review: ReviewSnapshotDto): boolean {
  return review.executionRecordIds.length > 0;
}

export function planRole(plan: PlanSnapshotDto): "baseline" | "final" {
  return plan.version === 1 ? "baseline" : "final";
}

export type QuickCaptureViewState = "idle" | "online-success" | "offline-pending" | "syncing" | "conflict" | "failed";

export function quickCaptureViewState(
  storedState: "pending" | "syncing" | "conflict" | "done" | "failed" | undefined,
  activelySyncing: boolean,
): QuickCaptureViewState {
  if (activelySyncing || storedState === "syncing") return "syncing";
  if (storedState === "done") return "online-success";
  if (storedState === "pending") return "offline-pending";
  if (storedState === "conflict") return "conflict";
  if (storedState === "failed") return "failed";
  return "idle";
}

export function realtimeStateLabel(state: "connecting" | "connected" | "reconnecting" | "offline"): string {
  return state === "connected" ? "实时已连接"
    : state === "offline" ? "离线"
      : state === "reconnecting" ? "正在重连" : "正在连接";
}
