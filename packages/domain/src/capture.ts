import { Revision, type Revision as RevisionValue, type UUIDv7 } from "./identity.js";

export type RawPayloadKind = "text";

export interface RawPayloadRef {
  readonly id: UUIDv7;
  readonly kind: RawPayloadKind;
}

export type CaptureParseStatus = "pending" | "parsed" | "failed" | "partial";
export type CaptureTriageStatus =
  | "untriaged"
  | "proposal_ready"
  | "needs_review"
  | "accepted"
  | "archived";

export interface CaptureItem {
  readonly id: UUIDv7;
  readonly ownerId: UUIDv7;
  readonly rawPayloadRef: RawPayloadRef;
  readonly parseStatus: CaptureParseStatus;
  readonly triageStatus: CaptureTriageStatus;
  readonly revision: Revision;
  readonly proposalId?: UUIDv7;
  readonly materializedObjectIds: readonly UUIDv7[];
}

export function createCaptureItem(input: {
  readonly id: UUIDv7;
  readonly ownerId: UUIDv7;
  readonly rawPayloadRef: RawPayloadRef;
}): CaptureItem {
  return Object.freeze({
    ...input,
    parseStatus: "pending" as const,
    triageStatus: "untriaged" as const,
    revision: Revision.parseBigInt(1n),
    materializedObjectIds: [] as readonly UUIDv7[],
  });
}

export function acceptCaptureProposal(
  capture: CaptureItem,
  proposalId: UUIDv7,
  materializedObjectId: UUIDv7,
): CaptureItem {
  if (capture.triageStatus === "archived") throw new Error("Archived Capture cannot accept a Proposal");
  return Object.freeze({
    ...capture,
    triageStatus: "accepted" as const,
    proposalId,
    materializedObjectIds: Object.freeze([...capture.materializedObjectIds, materializedObjectId]),
    revision: Revision.increment(capture.revision),
  });
}

export function captureRevision(capture: CaptureItem): RevisionValue {
  return capture.revision;
}
