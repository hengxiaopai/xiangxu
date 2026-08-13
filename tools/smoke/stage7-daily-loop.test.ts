import { describe, expect, it } from "vitest";

import {
  hasActualEvidence,
  planRole,
  projectionState,
  quickCaptureViewState,
  realtimeStateLabel,
} from "../../apps/web/src/client/daily-loop/daily-loop-model";
import { establishClientSession, retireClientSession } from "../../apps/web/src/client/state/auth-epoch";
import { exactInvalidationKeys } from "../../apps/web/src/client/state/invalidation";

const planId = "0198f1b0-1000-7000-8000-000000000001";
const taskId = "0198f1b0-1000-7000-8000-000000000002";
const reviewId = "0198f1b0-1000-7000-8000-000000000003";

const plan = {
  id: planId,
  date: "2026-08-13",
  timezone: "Asia/Shanghai",
  version: 1,
  capacityMinutes: 120,
  items: [{ taskId, order: 1, timeBlockIds: [] }],
  assumptionsAndEvidence: [],
  committedBy: { actorType: "user" as const, actorId: "0198f1b0-1000-7000-8000-000000000004" },
  committedAt: "2026-08-13T08:00:00+08:00",
};

const review = {
  id: reviewId,
  date: "2026-08-13",
  timezone: "Asia/Shanghai",
  baselinePlanSnapshotId: planId,
  finalPlanSnapshotId: planId,
  executionRecordIds: [],
  whatChanged: [{ objectType: "task" as const, id: taskId }],
  derivedMetrics: { plannedCount: 1, actualExecutionCount: 0, actualDurationMinutes: 0 },
  aiInsightRefs: [],
};

describe("Stage 7 bounded Daily Loop UI states", () => {
  it("represents Today loading, empty, data and error without sample business data", () => {
    expect(projectionState({ pending: true, error: false, data: undefined })).toBe("loading");
    expect(projectionState({ pending: false, error: false, data: null })).toBe("empty");
    expect(projectionState({ pending: false, error: false, data: plan })).toBe("data");
    expect(projectionState({ pending: false, error: true, data: undefined })).toBe("error");
  });

  it("distinguishes baseline from final snapshot roles", () => {
    expect(planRole(plan)).toBe("baseline");
    expect(planRole({ ...plan, version: 2 })).toBe("final");
  });

  it("represents offline Capture pending, syncing, conflict, success and failure", () => {
    expect(quickCaptureViewState(undefined, false)).toBe("idle");
    expect(quickCaptureViewState("pending", false)).toBe("offline-pending");
    expect(quickCaptureViewState("pending", true)).toBe("syncing");
    expect(quickCaptureViewState("conflict", false)).toBe("conflict");
    expect(quickCaptureViewState("done", false)).toBe("online-success");
    expect(quickCaptureViewState("failed", false)).toBe("failed");
  });

  it("shows actual-missing Review without fabricating duration", () => {
    expect(hasActualEvidence(review)).toBe(false);
    expect(hasActualEvidence({ ...review, executionRecordIds: ["0198f1b0-1000-7000-8000-000000000005"] })).toBe(true);
  });

  it("keeps realtime connection and degraded states explicit", () => {
    expect(realtimeStateLabel("connected")).toBe("实时已连接");
    expect(realtimeStateLabel("reconnecting")).toBe("正在重连");
    expect(realtimeStateLabel("offline")).toBe("离线");
  });

  it("maps Stage 7 mutation/SSE effects to exact projection keys", () => {
    const epoch = establishClientSession();
    expect(exactInvalidationKeys({
      affectedRefs: [{ objectType: "plan_snapshot", id: planId }],
      projectionHints: ["today", "review"],
    }, epoch)).toEqual([["today", epoch], ["review", epoch]]);
  });

  it("maps Gate 4.2 Library events only to the actor-scoped Knowledge projection", () => {
    const epoch = establishClientSession();
    expect(exactInvalidationKeys({
      affectedRefs: [{ objectType: "library", id: planId }],
      projectionHints: ["knowledge"],
    }, epoch)).toEqual([["knowledge", epoch]]);
  });

  it("retires the prior identity epoch for cache and offline isolation", () => {
    const established = establishClientSession();
    const retired = retireClientSession();
    expect(retired).not.toBe(established);
  });
});
