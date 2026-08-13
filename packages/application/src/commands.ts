import type {
  ActorRef,
  CommitmentState,
  IanaTimeZone,
  ObjectRef,
  ProposalPatch,
  Revision,
  Rfc3339Instant,
  UUIDv7,
} from "@xiangxu/domain";

export interface SourceContext {
  readonly route?: string;
  readonly surface?: string;
  readonly clientId?: string;
}

export interface IdempotencyContext {
  readonly key: string;
  readonly requestFingerprint: string;
}

export interface CommandEnvelope<TType extends string, TPayload> {
  readonly commandId: UUIDv7;
  readonly commandType: TType;
  readonly actor: ActorRef;
  readonly idempotency: IdempotencyContext;
  readonly sourceContext: SourceContext;
  readonly baseRevision?: Revision;
  readonly payload: TPayload;
}

export type CreateTask = CommandEnvelope<
  "task.create",
  {
    readonly taskId: UUIDv7;
    readonly title: string;
    readonly commitmentState: CommitmentState;
    readonly dueAt?: Rfc3339Instant;
    readonly dueOn?: string;
  }
>;

export type CompleteTask = CommandEnvelope<"task.complete", { readonly taskId: UUIDv7 }>;

export type CreateTimeBlock = CommandEnvelope<
  "timeblock.create",
  {
    readonly timeBlockId: UUIDv7;
    readonly taskId: UUIDv7;
    readonly startAt: Rfc3339Instant;
    readonly endAt: Rfc3339Instant;
    readonly timezone: IanaTimeZone;
    readonly locked: boolean;
  }
>;

export type MoveTimeBlock = CommandEnvelope<
  "timeblock.move",
  {
    readonly timeBlockId: UUIDv7;
    readonly startAt: Rfc3339Instant;
    readonly endAt: Rfc3339Instant;
    readonly timezone: IanaTimeZone;
  }
>;

export type CreateCapture = CommandEnvelope<
  "capture.create",
  { readonly captureId: UUIDv7; readonly rawPayloadId: UUIDv7; readonly rawPayloadKind: "text" }
>;

export type GenerateStructuredTriageProposal = CommandEnvelope<
  "proposal.generate-structured-triage",
  { readonly captureId: UUIDv7 }
>;

export type ApplyProposal = CommandEnvelope<
  "proposal.apply",
  { readonly proposalId: UUIDv7; readonly targets: readonly { readonly ref: ObjectRef; readonly baseRevision: Revision }[] }
>;

export type CommitDailyPlan = CommandEnvelope<
  "plan.commit-daily",
  {
    readonly planSnapshotId: UUIDv7;
    readonly date: string;
    readonly timezone: IanaTimeZone;
    readonly capacityMinutes: number;
    readonly taskIds: readonly UUIDv7[];
    readonly timeBlockIds: readonly UUIDv7[];
  }
>;

export type CreateReviewSnapshot = CommandEnvelope<
  "review.create-snapshot",
  {
    readonly reviewSnapshotId: UUIDv7;
    readonly date: string;
    readonly timezone: IanaTimeZone;
    readonly baselinePlanSnapshotId: UUIDv7;
    readonly finalPlanSnapshotId: UUIDv7;
    readonly executionRecordIds: readonly UUIDv7[];
  }
>;

export type CreateLibrary = CommandEnvelope<
  "knowledge.library.create",
  {
    readonly libraryId: UUIDv7;
    readonly name: string;
    readonly description?: string;
  }
>;

export type StageOneCommand =
  | CreateTask
  | CompleteTask
  | CreateTimeBlock
  | MoveTimeBlock
  | CreateCapture
  | GenerateStructuredTriageProposal
  | ApplyProposal
  | CommitDailyPlan
  | CreateReviewSnapshot
  | CreateLibrary;

export interface StructuredProposalCandidate {
  readonly proposalType: "classify" | "create";
  readonly patch: ProposalPatch;
}
