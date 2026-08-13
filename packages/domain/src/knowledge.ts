import type { ActorRef, Rfc3339Instant, UUIDv7 } from "./identity.js";

export interface Library {
  readonly id: UUIDv7;
  readonly ownerId: UUIDv7;
  readonly name: string;
  readonly description: string;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly createdAt: Rfc3339Instant;
  readonly createdBy: ActorRef;
  readonly archivedAt?: Rfc3339Instant;
}

export interface KnowledgeOverviewMetrics {
  readonly added: number;
  readonly unread: number;
  readonly reading: number;
  readonly settled: number;
  readonly longUnread: number;
}

export interface KnowledgeOverview {
  readonly metrics: KnowledgeOverviewMetrics;
  readonly libraries: readonly Library[];
}

export interface CreateLibraryInput {
  readonly id: UUIDv7;
  readonly ownerId: UUIDv7;
  readonly name: string;
  readonly description?: string;
  readonly createdAt: Rfc3339Instant;
  readonly createdBy: ActorRef;
}

export function createLibrary(input: CreateLibraryInput): Library {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("Library name is required");
  if (input.createdBy.actorType !== "user" || input.createdBy.actorId !== input.ownerId) {
    throw new Error("Library creation requires its owning user Actor");
  }
  return Object.freeze({
    id: input.id,
    ownerId: input.ownerId,
    name,
    description: input.description?.trim() ?? "",
    settings: Object.freeze({}),
    createdAt: input.createdAt,
    createdBy: input.createdBy,
  });
}
