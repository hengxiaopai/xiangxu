import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const bootstrapSentinel = pgTable("infra_bootstrap_sentinel", {
  id: integer("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

const identity = pgSchema("identity");
const core = pgSchema("core");
const planning = pgSchema("planning");
const capture = pgSchema("capture");
const knowledge = pgSchema("knowledge");
const ai = pgSchema("ai");
const audit = pgSchema("audit");
const infra = pgSchema("infra");

export const users = identity.table(
  "users",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    devSubject: text("dev_subject").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_dev_subject_unique").on(table.devSubject)],
);

export const deviceSessions = identity.table(
  "device_sessions",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("device_sessions_token_hash_unique").on(table.tokenHash),
    index("device_sessions_user_active_idx").on(table.userId, table.expiresAt),
    check("device_sessions_expiry_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);

export const objects = core.table(
  "objects",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    objectType: text("object_type").notNull(),
    title: text("title").notNull(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    status: text("status").notNull(),
    sourceKind: text("source_kind").default("manual").notNull(),
    schemaVersion: smallint("schema_version").default(1).notNull(),
    revision: bigint("revision", { mode: "bigint" }).default(sql`1`).notNull(),
    createdByType: text("created_by_type").notNull(),
    createdById: uuid("created_by_id").notNull(),
    updatedByType: text("updated_by_type").notNull(),
    updatedById: uuid("updated_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check("objects_type_task", sql`${table.objectType} = 'task'`),
    check("objects_task_status", sql`${table.status} IN ('open', 'in_progress', 'waiting', 'completed', 'cancelled')`),
    check("objects_source_kind", sql`${table.sourceKind} IN ('manual', 'capture', 'connector', 'import', 'ai_assisted', 'system')`),
    check("objects_actor_types", sql`${table.createdByType} IN ('user', 'system', 'ai', 'connector') AND ${table.updatedByType} IN ('user', 'system', 'ai', 'connector')`),
    check("objects_revision_positive", sql`${table.revision} > 0`),
    check("objects_schema_version_positive", sql`${table.schemaVersion} > 0`),
    index("objects_owner_lookup_idx").on(table.ownerId, table.objectType, table.status, table.deletedAt),
  ],
);

export const taskDetails = core.table(
  "task_details",
  {
    objectId: uuid("object_id").primaryKey().references(() => objects.id),
    commitmentState: text("commitment_state").notNull(),
    dueOn: date("due_on"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    check("task_details_commitment", sql`${table.commitmentState} IN ('committed', 'someday')`),
    check("task_details_single_due", sql`${table.dueOn} IS NULL OR ${table.dueAt} IS NULL`),
  ],
);

export const libraries = knowledge.table(
  "libraries",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    settings: jsonb("settings").$type<Readonly<Record<string, unknown>>>().default(sql`'{}'::jsonb`).notNull(),
    createdByType: text("created_by_type").notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    check("libraries_name_nonempty", sql`length(btrim(${table.name})) > 0`),
    check("libraries_created_by_user", sql`${table.createdByType} = 'user' AND ${table.createdById} = ${table.ownerId}`),
    index("libraries_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

export const timeBlocks = planning.table(
  "time_blocks",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    taskId: uuid("task_id").notNull().references(() => taskDetails.objectId),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    locked: boolean("locked").default(false).notNull(),
    revision: bigint("revision", { mode: "bigint" }).default(sql`1`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("time_blocks_interval_valid", sql`${table.endAt} > ${table.startAt}`),
    check("time_blocks_revision_positive", sql`${table.revision} > 0`),
    index("time_blocks_owner_interval_idx").on(table.ownerId, table.startAt, table.endAt),
    index("time_blocks_task_idx").on(table.taskId),
  ],
);

export const planSnapshots = planning.table(
  "plan_snapshots",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    localDate: date("local_date").notNull(),
    timezone: text("timezone").notNull(),
    version: integer("version").notNull(),
    capacityMinutes: integer("capacity_minutes").notNull(),
    assumptionsAndEvidence: jsonb("assumptions_and_evidence")
      .$type<readonly Readonly<{ objectType: string; id: string }>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    committedByType: text("committed_by_type").notNull(),
    committedById: uuid("committed_by_id").notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("plan_snapshots_owner_date_version_unique").on(table.ownerId, table.localDate, table.version),
    index("plan_snapshots_owner_date_lookup_idx").on(table.ownerId, table.localDate, table.version),
    check("plan_snapshots_version_positive", sql`${table.version} > 0`),
    check("plan_snapshots_capacity_nonnegative", sql`${table.capacityMinutes} >= 0`),
    check("plan_snapshots_committed_by_type", sql`${table.committedByType} IN ('user','system','connector')`),
  ],
);

export const planSnapshotItems = planning.table(
  "plan_snapshot_items",
  {
    planSnapshotId: uuid("plan_snapshot_id").notNull().references(() => planSnapshots.id),
    taskId: uuid("task_id").notNull().references(() => taskDetails.objectId),
    itemOrder: integer("item_order").notNull(),
    timeBlockIds: uuid("time_block_ids").array().default(sql`ARRAY[]::uuid[]`).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.planSnapshotId, table.taskId] }),
    uniqueIndex("plan_snapshot_items_order_unique").on(table.planSnapshotId, table.itemOrder),
    check("plan_snapshot_items_order_positive", sql`${table.itemOrder} > 0`),
  ],
);

export const executionRecords = planning.table(
  "execution_records",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    targetObjectId: uuid("target_object_id").notNull().references(() => taskDetails.objectId),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    outcome: text("outcome").notNull(),
    source: text("source").notNull(),
    planSnapshotId: uuid("plan_snapshot_id").references(() => planSnapshots.id),
    timeBlockId: uuid("time_block_id").references(() => timeBlocks.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("execution_records_interval_valid", sql`${table.endedAt} > ${table.startedAt}`),
    check("execution_records_duration_positive", sql`${table.durationMinutes} > 0`),
    check("execution_records_outcome", sql`${table.outcome} IN ('completed','partial','stopped','interrupted')`),
    check("execution_records_source", sql`${table.source} IN ('focus_mode','manual','import')`),
    index("execution_records_owner_started_idx").on(table.ownerId, table.startedAt),
    index("execution_records_target_idx").on(table.targetObjectId, table.startedAt),
  ],
);

export const reviewSnapshots = planning.table(
  "review_snapshots",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    localDate: date("local_date").notNull(),
    timezone: text("timezone").notNull(),
    version: integer("version").notNull(),
    baselinePlanSnapshotId: uuid("baseline_plan_snapshot_id").notNull().references(() => planSnapshots.id),
    finalPlanSnapshotId: uuid("final_plan_snapshot_id").notNull().references(() => planSnapshots.id),
    executionRecordIds: uuid("execution_record_ids").array().default(sql`ARRAY[]::uuid[]`).notNull(),
    whatChanged: jsonb("what_changed")
      .$type<readonly Readonly<{ objectType: string; id: string }>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    deterministicMetrics: jsonb("deterministic_metrics")
      .$type<Readonly<Record<string, number>>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    aiInsightRefs: jsonb("ai_insight_refs")
      .$type<readonly Readonly<{ objectType: string; id: string }>[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    tomorrowProposalId: uuid("tomorrow_proposal_id").references(() => proposals.id),
    userReflectionNoteId: uuid("user_reflection_note_id"),
    createdByType: text("created_by_type").notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("review_snapshots_owner_date_version_unique").on(table.ownerId, table.localDate, table.version),
    index("review_snapshots_owner_date_lookup_idx").on(table.ownerId, table.localDate, table.version),
    check("review_snapshots_version_positive", sql`${table.version} > 0`),
    check("review_snapshots_created_by_type", sql`${table.createdByType} IN ('user','system','connector')`),
  ],
);

export const rawPayloads = capture.table(
  "raw_payloads",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    kind: text("kind").notNull(),
    textContent: text("text_content").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("raw_payloads_kind_text", sql`${table.kind} = 'text'`),
    check("raw_payloads_text_nonempty", sql`length(${table.textContent}) > 0`),
    check("raw_payloads_content_hash_sha256", sql`${table.contentHash} ~ '^sha256:[0-9a-f]{64}$'`),
    index("raw_payloads_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

export const captureItems = capture.table(
  "capture_items",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    ownerId: uuid("owner_id").notNull().references(() => users.id),
    rawPayloadId: uuid("raw_payload_id").notNull().references(() => rawPayloads.id),
    parseStatus: text("parse_status").default("pending").notNull(),
    triageStatus: text("triage_status").default("untriaged").notNull(),
    revision: bigint("revision", { mode: "bigint" }).default(sql`1`).notNull(),
    proposalId: uuid("proposal_id"),
    materializedObjectIds: uuid("materialized_object_ids").array().default(sql`ARRAY[]::uuid[]`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("capture_items_raw_payload_unique").on(table.rawPayloadId),
    check("capture_items_parse_status", sql`${table.parseStatus} IN ('pending','parsed','failed','partial')`),
    check("capture_items_triage_status", sql`${table.triageStatus} IN ('untriaged','proposal_ready','needs_review','accepted','archived')`),
    check("capture_items_revision_positive", sql`${table.revision} > 0`),
    index("capture_items_owner_triage_idx").on(table.ownerId, table.triageStatus, table.createdAt),
  ],
);

export const proposals = ai.table(
  "proposals",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    proposalType: text("proposal_type").notNull(),
    structuredPatch: jsonb("structured_patch").$type<Readonly<Record<string, unknown>>>().notNull(),
    rationale: text("rationale").notNull(),
    evidenceRefs: jsonb("evidence_refs").$type<readonly Readonly<Record<string, unknown>>[]>().notNull(),
    impactSummary: text("impact_summary").notNull(),
    riskLevel: text("risk_level").notNull(),
    status: text("status").notNull(),
    createdByType: text("created_by_type").notNull(),
    createdById: uuid("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("proposals_type", sql`${table.proposalType} IN ('classify','reprioritize','reschedule','relate','create','update','memory','review_suggestion')`),
    check("proposals_risk", sql`${table.riskLevel} IN ('low','medium','high')`),
    check("proposals_status", sql`${table.status} IN ('draft','ready','applied','rejected','expired','cancelled')`),
    check("proposals_created_by_type", sql`${table.createdByType} IN ('user','system','ai','connector')`),
    check("proposals_text_nonempty", sql`length(${table.rationale}) > 0 AND length(${table.impactSummary}) > 0`),
    index("proposals_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const proposalTargets = ai.table(
  "proposal_targets",
  {
    proposalId: uuid("proposal_id").notNull().references(() => proposals.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    baseRevision: bigint("base_revision", { mode: "bigint" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.proposalId, table.targetType, table.targetId] }),
    check("proposal_targets_type", sql`${table.targetType} IN ('task','time_block','capture_item','raw_payload','proposal','plan_snapshot','execution_record','review_snapshot','change_record')`),
    check("proposal_targets_base_revision_positive", sql`${table.baseRevision} > 0`),
    index("proposal_targets_target_idx").on(table.targetType, table.targetId),
  ],
);

export const changeRecords = audit.table(
  "change_records",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    baseRevision: bigint("base_revision", { mode: "bigint" }).notNull(),
    newRevision: bigint("new_revision", { mode: "bigint" }).notNull(),
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id").notNull(),
    command: text("command").notNull(),
    changedFieldFamilies: jsonb("changed_field_families").$type<readonly string[]>().notNull(),
    patchBefore: jsonb("patch_before").$type<Readonly<Record<string, unknown>>>().notNull(),
    patchAfter: jsonb("patch_after").$type<Readonly<Record<string, unknown>>>().notNull(),
    sourceContext: jsonb("source_context").$type<Readonly<Record<string, string>>>().notNull(),
    commandId: uuid("command_id").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    proposalId: uuid("proposal_id"),
    undoOf: uuid("undo_of"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("change_records_revisions_positive", sql`${table.baseRevision} > 0 AND ${table.newRevision} > 0`),
    check("change_records_actor_type", sql`${table.actorType} IN ('user', 'system', 'connector')`),
    index("change_records_target_idx").on(table.targetType, table.targetId, table.createdAt),
    index("change_records_correlation_idx").on(table.correlationId),
  ],
);

export const outboxEvents = infra.table(
  "outbox_events",
  {
    sequence: bigint("sequence", { mode: "bigint" }).generatedAlwaysAsIdentity().primaryKey(),
    id: uuid("id").default(sql`uuidv7()`).notNull(),
    topic: text("topic").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    revision: bigint("revision", { mode: "bigint" }),
    payload: jsonb("payload").$type<Readonly<Record<string, unknown>>>().notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimedBy: text("claimed_by"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastError: text("last_error"),
    commandId: uuid("command_id").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("outbox_events_id_unique").on(table.id),
    check("outbox_events_topic", sql`${table.topic} IN ('object.changed', 'proposal.ready', 'capture.triage.requested')`),
    check("outbox_events_status", sql`${table.status} IN ('pending', 'claimed', 'published', 'failed')`),
    check("outbox_events_attempts_nonnegative", sql`${table.attempts} >= 0`),
    check("outbox_events_revision_positive", sql`${table.revision} IS NULL OR ${table.revision} > 0`),
    index("outbox_events_pending_idx").on(table.status, table.availableAt, table.sequence),
    index("outbox_events_correlation_idx").on(table.correlationId),
  ],
);

export const idempotencyKeys = infra.table(
  "idempotency_keys",
  {
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id").notNull(),
    commandType: text("command_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    state: text("state").default("in_progress").notNull(),
    storedStatus: integer("stored_status"),
    storedBody: jsonb("stored_body").$type<Readonly<Record<string, unknown>>>(),
    storedEtagRevision: bigint("stored_etag_revision", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.actorType, table.actorId, table.commandType, table.idempotencyKey] }),
    check("idempotency_actor_type", sql`${table.actorType} IN ('user', 'system', 'ai', 'connector')`),
    check("idempotency_state", sql`${table.state} IN ('in_progress', 'completed')`),
    check("idempotency_etag_positive", sql`${table.storedEtagRevision} IS NULL OR ${table.storedEtagRevision} > 0`),
    index("idempotency_created_idx").on(table.createdAt),
  ],
);
