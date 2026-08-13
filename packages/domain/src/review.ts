import type { ActorRef, IanaTimeZone, ObjectRef, Rfc3339Instant, UUIDv7 } from "./identity.js";

export interface PlanSnapshotItem {
  readonly taskId: UUIDv7;
  readonly order: number;
  readonly timeBlockIds: readonly UUIDv7[];
}

export interface PlanSnapshot {
  readonly id: UUIDv7;
  readonly date: string;
  readonly timezone: IanaTimeZone;
  readonly version: number;
  readonly capacityMinutes: number;
  readonly items: readonly PlanSnapshotItem[];
  readonly assumptionsAndEvidence: readonly ObjectRef[];
  readonly committedBy: ActorRef;
  readonly committedAt: Rfc3339Instant;
}

export type ExecutionOutcome = "completed" | "partial" | "stopped" | "interrupted";
export type ExecutionSource = "focus_mode" | "manual" | "import";

export interface ExecutionRecord {
  readonly id: UUIDv7;
  readonly targetObjectId: UUIDv7;
  readonly startedAt: Rfc3339Instant;
  readonly endedAt: Rfc3339Instant;
  readonly durationMinutes: number;
  readonly outcome: ExecutionOutcome;
  readonly source: ExecutionSource;
  readonly planSnapshotId?: UUIDv7;
  readonly timeBlockId?: UUIDv7;
}

export interface ReviewSnapshot {
  readonly id: UUIDv7;
  readonly date: string;
  readonly timezone: IanaTimeZone;
  readonly baselinePlanSnapshotId: UUIDv7;
  readonly finalPlanSnapshotId: UUIDv7;
  readonly executionRecordIds: readonly UUIDv7[];
  readonly whatChanged: readonly ObjectRef[];
  readonly derivedMetrics: Readonly<Record<string, number>>;
  readonly aiInsightRefs: readonly ObjectRef[];
  readonly tomorrowProposalId?: UUIDv7;
  readonly userReflectionNoteId?: UUIDv7;
}

export function createPlanSnapshot(snapshot: PlanSnapshot): Readonly<PlanSnapshot> {
  if (!Number.isInteger(snapshot.version) || snapshot.version < 1) {
    throw new Error("PlanSnapshot version must be a positive integer");
  }
  if (!Number.isInteger(snapshot.capacityMinutes) || snapshot.capacityMinutes < 0) {
    throw new Error("PlanSnapshot capacity must be a nonnegative integer");
  }
  const taskIds = new Set<UUIDv7>();
  const itemOrders = new Set<number>();
  const items = snapshot.items.map((item) => {
    if (!Number.isInteger(item.order) || item.order < 1) {
      throw new Error("PlanSnapshot item order must be a positive integer");
    }
    if (taskIds.has(item.taskId) || itemOrders.has(item.order)) {
      throw new Error("PlanSnapshot task membership and order must be unique");
    }
    taskIds.add(item.taskId);
    itemOrders.add(item.order);
    if (new Set(item.timeBlockIds).size !== item.timeBlockIds.length) {
      throw new Error("PlanSnapshot item TimeBlock membership must be unique");
    }
    return Object.freeze({ ...item, timeBlockIds: Object.freeze([...item.timeBlockIds]) });
  });
  return Object.freeze({
    ...snapshot,
    items: Object.freeze(items),
    assumptionsAndEvidence: Object.freeze([...snapshot.assumptionsAndEvidence]),
  });
}

export function createReviewSnapshot(snapshot: ReviewSnapshot): Readonly<ReviewSnapshot> {
  if (new Set(snapshot.executionRecordIds).size !== snapshot.executionRecordIds.length) {
    throw new Error("ReviewSnapshot ExecutionRecord membership must be unique");
  }
  for (const metric of Object.values(snapshot.derivedMetrics)) {
    if (!Number.isFinite(metric)) throw new Error("ReviewSnapshot metrics must be finite numbers");
  }
  return Object.freeze({
    ...snapshot,
    executionRecordIds: Object.freeze([...snapshot.executionRecordIds]),
    whatChanged: Object.freeze([...snapshot.whatChanged]),
    derivedMetrics: Object.freeze({ ...snapshot.derivedMetrics }),
    aiInsightRefs: Object.freeze([...snapshot.aiInsightRefs]),
  });
}

export function createExecutionRecord(record: ExecutionRecord): Readonly<ExecutionRecord> {
  if (Date.parse(record.endedAt) <= Date.parse(record.startedAt)) {
    throw new Error("ExecutionRecord end must be after start");
  }
  if (record.durationMinutes <= 0) throw new Error("ExecutionRecord duration must be positive");
  return Object.freeze({ ...record });
}
