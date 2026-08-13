import { revisionDecimalSchema, type RevisionDecimal } from "../schema/primitives.js";

const ETAG_PATTERN = /^"rev-([1-9][0-9]*)"$/;

export function formatRevisionEtag(revision: string): string {
  return `"rev-${revisionDecimalSchema.parse(revision)}"`;
}

export function parseRevisionEtag(value: string): RevisionDecimal {
  const match = ETAG_PATTERN.exec(value);
  if (match?.[1] === undefined) throw new Error("Malformed strong revision ETag");
  return revisionDecimalSchema.parse(match[1]);
}

export type IfMatchDecision =
  | { readonly outcome: "accepted"; readonly baseRevision: RevisionDecimal }
  | { readonly outcome: "rejected"; readonly status: 428; readonly code: "PRECONDITION_REQUIRED" }
  | { readonly outcome: "rejected"; readonly status: 400; readonly code: "VALIDATION_ERROR" };

export function parseRequiredIfMatch(value: string | undefined): IfMatchDecision {
  if (value === undefined || value.length === 0) {
    return { outcome: "rejected", status: 428, code: "PRECONDITION_REQUIRED" };
  }
  try {
    return { outcome: "accepted", baseRevision: parseRevisionEtag(value) };
  } catch {
    return { outcome: "rejected", status: 400, code: "VALIDATION_ERROR" };
  }
}

export type IfMatchComparison =
  | { readonly outcome: "matched"; readonly baseRevision: RevisionDecimal }
  | { readonly outcome: "rejected"; readonly status: 428; readonly code: "PRECONDITION_REQUIRED" }
  | { readonly outcome: "rejected"; readonly status: 400; readonly code: "VALIDATION_ERROR" }
  | {
      readonly outcome: "rejected";
      readonly status: 412;
      readonly code: "PRECONDITION_FAILED";
      readonly currentRevision: RevisionDecimal;
    };

export function compareRequiredIfMatch(value: string | undefined, currentRevision: string): IfMatchComparison {
  const parsed = parseRequiredIfMatch(value);
  if (parsed.outcome === "rejected") return parsed;
  const current = revisionDecimalSchema.parse(currentRevision);
  return parsed.baseRevision === current
    ? { outcome: "matched", baseRevision: parsed.baseRevision }
    : { outcome: "rejected", status: 412, code: "PRECONDITION_FAILED", currentRevision: current };
}
