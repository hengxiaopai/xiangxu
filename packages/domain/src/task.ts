import {
  Revision,
  type ActorRef,
  type Revision as RevisionValue,
  type Rfc3339Instant,
  type UUIDv7,
} from "./identity.js";

export type TaskStatus = "open" | "in_progress" | "waiting" | "completed" | "cancelled";
export type CommitmentState = "committed" | "someday";

export interface Task {
  readonly id: UUIDv7;
  readonly title: string;
  readonly ownerId: UUIDv7;
  readonly status: TaskStatus;
  readonly commitmentState: CommitmentState;
  readonly dueAt?: Rfc3339Instant;
  readonly dueOn?: string;
  readonly revision: RevisionValue;
  readonly createdAt: Rfc3339Instant;
  readonly updatedAt: Rfc3339Instant;
  readonly createdBy: ActorRef;
  readonly updatedBy: ActorRef;
  readonly completedAt?: Rfc3339Instant;
}

export type CreateTaskInput = Omit<Task, "status" | "revision" | "updatedAt" | "updatedBy" | "completedAt">;

export function createTask(input: CreateTaskInput): Task {
  if (input.title.trim().length === 0) throw new Error("Task title is required");
  return Object.freeze({
    ...input,
    title: input.title.trim(),
    status: "open" as const,
    revision: Revision.parseBigInt(1n),
    updatedAt: input.createdAt,
    updatedBy: input.createdBy,
  });
}

export function completeTask(task: Task, actor: ActorRef, completedAt: Rfc3339Instant): Task {
  if (task.status === "completed" || task.status === "cancelled") {
    throw new Error(`Task cannot transition from ${task.status} to completed`);
  }
  return Object.freeze({
    ...task,
    status: "completed" as const,
    completedAt,
    updatedAt: completedAt,
    updatedBy: actor,
    revision: Revision.increment(task.revision),
  });
}
