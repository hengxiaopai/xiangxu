import { Revision, type ActorRef, type Revision as RevisionValue } from "@xiangxu/domain";

export type RevisionDecision =
  | { readonly outcome: "matched"; readonly revision: RevisionValue }
  | { readonly outcome: "conflict"; readonly code: "REVISION_CONFLICT"; readonly currentRevision: RevisionValue };

export function decideRevision(baseRevision: RevisionValue, currentRevision: RevisionValue): RevisionDecision {
  return Revision.equals(baseRevision, currentRevision)
    ? { outcome: "matched", revision: currentRevision }
    : { outcome: "conflict", code: "REVISION_CONFLICT", currentRevision };
}

export interface IdempotencyIdentity {
  readonly actor: ActorRef;
  readonly commandType: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
}

export type IdempotencyDecision<TResult> =
  | { readonly outcome: "first-execution" }
  | { readonly outcome: "exact-replay"; readonly storedSuccessfulResult: TResult }
  | { readonly outcome: "conflict"; readonly code: "IDEMPOTENCY_CONFLICT" };

export interface IdempotencyRecord<TResult> extends IdempotencyIdentity {
  readonly successfulResult: TResult;
}

export function decideIdempotency<TResult>(
  incoming: IdempotencyIdentity,
  stored?: IdempotencyRecord<TResult>,
): IdempotencyDecision<TResult> {
  if (stored === undefined) return { outcome: "first-execution" };
  const sameScope =
    stored.actor.actorType === incoming.actor.actorType &&
    stored.actor.actorId === incoming.actor.actorId &&
    stored.commandType === incoming.commandType &&
    stored.idempotencyKey === incoming.idempotencyKey;
  if (sameScope && stored.requestFingerprint === incoming.requestFingerprint) {
    return { outcome: "exact-replay", storedSuccessfulResult: stored.successfulResult };
  }
  return { outcome: "conflict", code: "IDEMPOTENCY_CONFLICT" };
}
