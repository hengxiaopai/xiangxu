import type { ActorRef, ObjectRef, Revision, Rfc3339Instant, UUIDv7 } from "./identity.js";

export type ChangeCommand =
  | "create"
  | "update"
  | "status_change"
  | "apply_proposal"
  | "archive"
  | "delete";

export type ChangedFieldFamily = "identity" | "status" | "commitment" | "due" | "schedule" | "actual" | "triage";

export interface ChangeRecord {
  readonly id: UUIDv7;
  readonly entityRef: ObjectRef;
  readonly baseRevision: Revision;
  readonly newRevision: Revision;
  readonly actor: ActorRef;
  readonly command: ChangeCommand;
  readonly changedFieldFamilies: readonly ChangedFieldFamily[];
  readonly proposalId?: UUIDv7;
  readonly sourceContext: Readonly<{ route?: string; surface?: string; clientId?: string }>;
  readonly correlationId: UUIDv7;
  readonly createdAt: Rfc3339Instant;
  readonly undoOf?: UUIDv7;
}
