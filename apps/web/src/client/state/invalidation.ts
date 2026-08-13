import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { AffectedRefsAndProjectionHints } from "@xiangxu/contracts";

import { queryKeys, type ClientAuthEpoch } from "./query-keys";

export function exactInvalidationKeys(
  input: AffectedRefsAndProjectionHints,
  actorScope: ClientAuthEpoch,
): readonly QueryKey[] {
  const keys = new Map<string, QueryKey>();
  for (const hint of input.projectionHints) {
    const key = hint === "today" ? queryKeys.today(actorScope)
      : hint === "review" ? queryKeys.review(actorScope)
        : hint === "tasks" ? queryKeys.tasks(actorScope)
          : hint === "knowledge" ? queryKeys.knowledge(actorScope)
          : hint === "captures" ? queryKeys.captures(actorScope)
            : null;
    if (key !== null) keys.set(JSON.stringify(key), key);
  }
  for (const ref of input.affectedRefs) {
    const key = ref.objectType === "task" ? queryKeys.task(actorScope, ref.id)
      : ref.objectType === "capture_item" ? queryKeys.capture(actorScope, ref.id)
        : ref.objectType === "proposal" ? queryKeys.proposal(actorScope, ref.id)
          : null;
    if (key === null) continue;
    keys.set(JSON.stringify(key), key);
  }
  return [...keys.values()];
}

export async function invalidateAffectedQueries(
  queryClient: QueryClient,
  input: AffectedRefsAndProjectionHints,
  actorScope: ClientAuthEpoch,
): Promise<void> {
  for (const queryKey of exactInvalidationKeys(input, actorScope)) {
    await queryClient.invalidateQueries({ queryKey, exact: true });
  }
}

export const applyMutationInvalidation = invalidateAffectedQueries;
export const applySseInvalidation = invalidateAffectedQueries;
