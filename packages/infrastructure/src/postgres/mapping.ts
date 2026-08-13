import {
  Revision,
  UUIDv7,
  parseRfc3339Instant,
  type ActorRef,
  type ChangeRecord,
  type DurableEvent,
  type ObjectRef,
  type ProjectionHint,
  type Task,
  type TaskStatus,
} from "@xiangxu/domain";

export interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly owner_id: string;
  readonly status: string;
  readonly commitment_state: string;
  readonly due_on: string | null;
  readonly due_at: Date | null;
  readonly revision: string;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly created_by_type: string;
  readonly created_by_id: string;
  readonly updated_by_type: string;
  readonly updated_by_id: string;
  readonly completed_at: Date | null;
}

export function mapActorRef(actorType: string, actorId: string): ActorRef {
  if (!(actorType === "user" || actorType === "system" || actorType === "ai" || actorType === "connector")) {
    throw new Error(`Unsupported actor type from database: ${actorType}`);
  }
  return { actorType, actorId: UUIDv7.parse(actorId) };
}

function parseTaskStatus(status: string): TaskStatus {
  if (!(status === "open" || status === "in_progress" || status === "waiting" || status === "completed" || status === "cancelled")) {
    throw new Error(`Unsupported Task status from database: ${status}`);
  }
  return status;
}

export function mapTaskRow(row: TaskRow): Task {
  const commitmentState = row.commitment_state;
  if (!(commitmentState === "committed" || commitmentState === "someday")) {
    throw new Error(`Unsupported commitment state from database: ${commitmentState}`);
  }
  return {
    id: UUIDv7.parse(row.id),
    title: row.title,
    ownerId: UUIDv7.parse(row.owner_id),
    status: parseTaskStatus(row.status),
    commitmentState,
    ...(row.due_at === null ? {} : { dueAt: parseRfc3339Instant(row.due_at.toISOString()) }),
    ...(row.due_on === null ? {} : { dueOn: row.due_on }),
    revision: Revision.parseBigInt(row.revision),
    createdAt: parseRfc3339Instant(row.created_at.toISOString()),
    updatedAt: parseRfc3339Instant(row.updated_at.toISOString()),
    createdBy: mapActorRef(row.created_by_type, row.created_by_id),
    updatedBy: mapActorRef(row.updated_by_type, row.updated_by_id),
    ...(row.completed_at === null ? {} : { completedAt: parseRfc3339Instant(row.completed_at.toISOString()) }),
  };
}

export interface ChangeRecordRow {
  readonly id: string;
  readonly target_type: string;
  readonly target_id: string;
  readonly base_revision: string;
  readonly new_revision: string;
  readonly actor_type: string;
  readonly actor_id: string;
  readonly command: ChangeRecord["command"];
  readonly changed_field_families: ChangeRecord["changedFieldFamilies"];
  readonly source_context: ChangeRecord["sourceContext"];
  readonly correlation_id: string;
  readonly proposal_id: string | null;
  readonly undo_of: string | null;
  readonly created_at: Date;
}

export function mapChangeRecordRow(row: ChangeRecordRow): ChangeRecord {
  return {
    id: UUIDv7.parse(row.id),
    entityRef: { objectType: mapObjectType(row.target_type), id: UUIDv7.parse(row.target_id) },
    baseRevision: Revision.parseBigInt(row.base_revision),
    newRevision: Revision.parseBigInt(row.new_revision),
    actor: mapActorRef(row.actor_type, row.actor_id),
    command: row.command,
    changedFieldFamilies: row.changed_field_families,
    sourceContext: row.source_context,
    correlationId: UUIDv7.parse(row.correlation_id),
    createdAt: parseRfc3339Instant(row.created_at.toISOString()),
    ...(row.proposal_id === null ? {} : { proposalId: UUIDv7.parse(row.proposal_id) }),
    ...(row.undo_of === null ? {} : { undoOf: UUIDv7.parse(row.undo_of) }),
  };
}

export function mapObjectType(value: string): ObjectRef["objectType"] {
  const allowed: readonly ObjectRef["objectType"][] = [
    "task", "time_block", "capture_item", "raw_payload", "proposal", "plan_snapshot", "execution_record", "review_snapshot", "library", "change_record",
  ];
  if (!allowed.includes(value as ObjectRef["objectType"])) throw new Error(`Unsupported object type from database: ${value}`);
  return value as ObjectRef["objectType"];
}

export interface OutboxRow {
  readonly sequence: string;
  readonly id: string;
  readonly topic: DurableEvent["topic"];
  readonly payload: {
    readonly affectedRefs: readonly { readonly objectType: string; readonly id: string }[];
    readonly projectionHints: readonly string[];
  };
  readonly revision: string | null;
  readonly command_id: string;
  readonly correlation_id: string;
  readonly created_at: Date;
  readonly status: "pending" | "claimed" | "published" | "failed";
}

export function mapOutboxRow(row: OutboxRow) {
  const projectionHints = row.payload.projectionHints.map((hint) => {
    if (!(hint === "today" || hint === "tasks" || hint === "calendar" || hint === "captures" || hint === "proposals" || hint === "knowledge" || hint === "review")) {
      throw new Error(`Unsupported projection hint from database: ${hint}`);
    }
    return hint as ProjectionHint;
  });
  const event: DurableEvent = {
    eventId: UUIDv7.parse(row.id),
    topic: row.topic,
    affectedRefs: row.payload.affectedRefs.map((ref) => ({ objectType: mapObjectType(ref.objectType), id: UUIDv7.parse(ref.id) })),
    projectionHints,
    ...(row.revision === null ? {} : { revision: Revision.parseBigInt(row.revision) }),
    commandId: UUIDv7.parse(row.command_id),
    correlationId: UUIDv7.parse(row.correlation_id),
    occurredAt: parseRfc3339Instant(row.created_at.toISOString()),
  };
  return { sequence: BigInt(row.sequence), event, status: row.status } as const;
}
