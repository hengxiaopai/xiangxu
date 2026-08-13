import type {
  ActorRef,
  CaptureItem,
  ChangeRecord,
  DurableEvent,
  ExecutionRecord,
  IanaTimeZone,
  ObjectRef,
  PlanSnapshot,
  Proposal,
  ReviewSnapshot,
  Revision,
  Rfc3339Instant,
  Task,
  TaskStatus,
  TimeBlock,
  UUIDv7,
} from "@xiangxu/domain";

export interface InsertTaskInput {
  readonly task: Task;
}

export interface TaskCasPatch {
  readonly status: TaskStatus;
  readonly completedAt?: Rfc3339Instant;
  readonly updatedAt: Rfc3339Instant;
  readonly updatedBy: ActorRef;
}

export type CasResult<T> =
  | { readonly outcome: "updated"; readonly value: T; readonly newRevision: Revision }
  | { readonly outcome: "conflict" };

export interface TaskRepository {
  insert(input: InsertTaskInput): Promise<Task>;
  getById(id: UUIDv7): Promise<Task | null>;
  listByOwner(ownerId: UUIDv7): Promise<readonly Task[]>;
  updateCas(id: UUIDv7, baseRevision: Revision, patch: TaskCasPatch): Promise<CasResult<Task>>;
}

export interface TimeBlockCasPatch {
  readonly startAt: Rfc3339Instant;
  readonly endAt: Rfc3339Instant;
  readonly timezone: TimeBlock["timezone"];
}

export interface TimeBlockRepository {
  insert(block: TimeBlock): Promise<TimeBlock>;
  getById(id: UUIDv7): Promise<TimeBlock | null>;
  updateCas(id: UUIDv7, baseRevision: Revision, patch: TimeBlockCasPatch): Promise<CasResult<TimeBlock>>;
  findOverlap(
    ownerId: UUIDv7,
    startAt: Rfc3339Instant,
    endAt: Rfc3339Instant,
    excludeId?: UUIDv7,
  ): Promise<TimeBlock | null>;
}

export interface PlanningLock {
  acquireOwner(ownerId: UUIDv7): Promise<void>;
  acquireDaily(ownerId: UUIDv7, date: string): Promise<void>;
}

export interface OwnedPlanSnapshot {
  readonly ownerId: UUIDv7;
  readonly snapshot: PlanSnapshot;
}

export interface PlanSnapshotRepository {
  nextVersionUnderLock(ownerId: UUIDv7, date: string): Promise<number>;
  insert(ownerId: UUIDv7, snapshot: PlanSnapshot): Promise<PlanSnapshot>;
  getById(id: UUIDv7): Promise<OwnedPlanSnapshot | null>;
  getLatest(ownerId: UUIDv7, date: string, timezone: IanaTimeZone): Promise<PlanSnapshot | null>;
}

export interface ExecutionRecordRepository {
  getOwnedByIds(ownerId: UUIDv7, ids: readonly UUIDv7[]): Promise<readonly ExecutionRecord[]>;
}

export interface ReviewSnapshotRepository {
  nextVersionUnderLock(ownerId: UUIDv7, date: string): Promise<number>;
  insert(
    ownerId: UUIDv7,
    version: number,
    createdBy: ActorRef,
    createdAt: Rfc3339Instant,
    snapshot: ReviewSnapshot,
  ): Promise<ReviewSnapshot>;
  getLatest(ownerId: UUIDv7, date: string, timezone: IanaTimeZone): Promise<ReviewSnapshot | null>;
}

export interface RawPayloadRecord {
  readonly id: UUIDv7;
  readonly ownerId: UUIDv7;
  readonly kind: "text";
  readonly textContent: string;
  readonly contentHash: string;
}

export interface CaptureWithRawPayload {
  readonly capture: CaptureItem;
  readonly rawPayload: RawPayloadRecord;
}

export interface CaptureRepository {
  insertRawPayload(payload: RawPayloadRecord): Promise<RawPayloadRecord>;
  insert(capture: CaptureItem): Promise<CaptureItem>;
  getById(id: UUIDv7): Promise<CaptureItem | null>;
  getWithRawPayload(id: UUIDv7): Promise<CaptureWithRawPayload | null>;
  applyProposalCas(
    id: UUIDv7,
    baseRevision: Revision,
    proposalId: UUIDv7,
    materializedObjectId: UUIDv7,
  ): Promise<CasResult<CaptureItem>>;
}

export interface ProposalRepository {
  insert(proposal: Proposal): Promise<Proposal>;
  getById(id: UUIDv7): Promise<Proposal | null>;
  getByIdForUpdate(id: UUIDv7): Promise<Proposal | null>;
  markApplied(id: UUIDv7): Promise<boolean>;
}

export interface ProposalGeneratorInput {
  readonly proposalId: UUIDv7;
  readonly capture: CaptureItem;
  readonly rawText: string;
  readonly createdBy: ActorRef;
}

export interface StructuredProposalGenerator {
  generate(input: ProposalGeneratorInput): Promise<unknown>;
}

export interface ChangeRecordRepository {
  append(record: ChangeRecord): Promise<void>;
  readByCorrelationId(correlationId: UUIDv7): Promise<readonly ChangeRecord[]>;
  readChangedRefs(actorId: UUIDv7, from: Rfc3339Instant, through: Rfc3339Instant): Promise<readonly ObjectRef[]>;
}

export interface OutboxRepository {
  append(event: DurableEvent): Promise<bigint>;
  appendCaptureTriageRequested(intent: CaptureTriageRequested): Promise<bigint>;
  readByCorrelationId(correlationId: UUIDv7): Promise<readonly DurableOutboxRecord[]>;
}

export interface CaptureTriageRequested {
  readonly eventId: UUIDv7;
  readonly captureId: UUIDv7;
  readonly commandId: UUIDv7;
  readonly correlationId: UUIDv7;
  readonly occurredAt: Rfc3339Instant;
}

export interface DurableOutboxRecord {
  readonly sequence: bigint;
  readonly event: DurableEvent;
  readonly status: "pending" | "claimed" | "published" | "failed";
}

export interface TransactionRepositories {
  readonly tasks: TaskRepository;
  readonly timeBlocks: TimeBlockRepository;
  readonly planningLock: PlanningLock;
  readonly planSnapshots: PlanSnapshotRepository;
  readonly executionRecords: ExecutionRecordRepository;
  readonly reviewSnapshots: ReviewSnapshotRepository;
  readonly captures: CaptureRepository;
  readonly proposals: ProposalRepository;
  readonly changes: ChangeRecordRepository;
  readonly outbox: OutboxRepository;
  readonly idempotency: IdempotencyRepository;
}

export interface UnitOfWork {
  transaction<T>(operation: (repositories: TransactionRepositories) => Promise<T>): Promise<T>;
}

export interface DeviceSessionRecord {
  readonly id: UUIDv7;
  readonly userId: UUIDv7;
  readonly expiresAt: Rfc3339Instant;
  readonly revokedAt?: Rfc3339Instant;
  readonly createdAt: Rfc3339Instant;
}

export interface CreateDeviceSessionInput {
  readonly userId: UUIDv7;
  readonly tokenHash: string;
  readonly expiresAt: Rfc3339Instant;
}

export interface DeviceSessionRepository {
  create(input: CreateDeviceSessionInput): Promise<DeviceSessionRecord>;
  findActiveByTokenHash(tokenHash: string, asOf: Rfc3339Instant): Promise<DeviceSessionRecord | null>;
  revoke(id: UUIDv7, revokedAt: Rfc3339Instant): Promise<boolean>;
}

export interface DevUserRepository {
  ensureDevUser(devSubject: string): Promise<UUIDv7>;
}

export interface IdempotencyKeyIdentity {
  readonly actor: ActorRef;
  readonly commandType: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export type IdempotencyReservation =
  | { readonly outcome: "first-execution" }
  | { readonly outcome: "in-progress" }
  | { readonly outcome: "exact-replay"; readonly storedResult: StoredCommandResult }
  | { readonly outcome: "conflict" };

export interface StoredCommandResult {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
  readonly etagRevision?: Revision;
}

export interface IdempotencyRepository {
  reserve(identity: IdempotencyKeyIdentity): Promise<IdempotencyReservation>;
  complete(identity: IdempotencyKeyIdentity, result: StoredCommandResult): Promise<void>;
}
