export type ClientAuthEpoch = string & { readonly __clientAuthEpoch: true };

export const queryKeys = {
  today: (actorScope: ClientAuthEpoch) => ["today", actorScope] as const,
  review: (actorScope: ClientAuthEpoch) => ["review", actorScope] as const,
  tasks: (actorScope: ClientAuthEpoch) => ["tasks", actorScope] as const,
  task: (actorScope: ClientAuthEpoch, taskId: string) => ["task", actorScope, taskId] as const,
  captures: (actorScope: ClientAuthEpoch) => ["captures", actorScope] as const,
  capture: (actorScope: ClientAuthEpoch, captureId: string) => ["capture", actorScope, captureId] as const,
  proposal: (actorScope: ClientAuthEpoch, proposalId: string) => ["proposal", actorScope, proposalId] as const,
} as const;
