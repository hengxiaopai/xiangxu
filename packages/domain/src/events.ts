import type { ObjectRef, Revision, Rfc3339Instant, UUIDv7 } from "./identity.js";

export type ProjectionHint =
  | "today"
  | "tasks"
  | "calendar"
  | "captures"
  | "proposals"
  | "knowledge"
  | "review";

export interface DurableEvent {
  readonly eventId: UUIDv7;
  readonly topic: "object.changed" | "proposal.ready";
  readonly affectedRefs: readonly ObjectRef[];
  readonly projectionHints: readonly ProjectionHint[];
  readonly revision?: Revision;
  readonly commandId: UUIDv7;
  readonly correlationId: UUIDv7;
  readonly occurredAt: Rfc3339Instant;
}
