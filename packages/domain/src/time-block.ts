import {
  Revision,
  parseIanaTimeZone,
  parseRfc3339Instant,
  type ActorRef,
  type IanaTimeZone,
  type Revision as RevisionValue,
  type Rfc3339Instant,
  type UUIDv7,
} from "./identity.js";

export interface TimeBlock {
  readonly id: UUIDv7;
  readonly ownerId: UUIDv7;
  readonly taskId: UUIDv7;
  readonly startAt: Rfc3339Instant;
  readonly endAt: Rfc3339Instant;
  readonly timezone: IanaTimeZone;
  readonly locked: boolean;
  readonly revision: RevisionValue;
}

export interface TimeBlockInput extends Omit<TimeBlock, "startAt" | "endAt" | "timezone"> {
  readonly startAt: string;
  readonly endAt: string;
  readonly timezone: string;
}

function validateInterval(startAt: Rfc3339Instant, endAt: Rfc3339Instant): void {
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    throw new Error("TimeBlock end must be after start");
  }
}

export function createTimeBlock(input: TimeBlockInput): TimeBlock {
  const startAt = parseRfc3339Instant(input.startAt);
  const endAt = parseRfc3339Instant(input.endAt);
  validateInterval(startAt, endAt);
  return Object.freeze({ ...input, startAt, endAt, timezone: parseIanaTimeZone(input.timezone) });
}

export function moveTimeBlock(
  block: TimeBlock,
  actor: ActorRef,
  start: string,
  end: string,
  timezone: string,
): TimeBlock {
  if (block.locked && (actor.actorType === "ai" || actor.actorType === "system")) {
    throw new Error("TIMEBLOCK_LOCKED");
  }
  const startAt = parseRfc3339Instant(start);
  const endAt = parseRfc3339Instant(end);
  validateInterval(startAt, endAt);
  return Object.freeze({
    ...block,
    startAt,
    endAt,
    timezone: parseIanaTimeZone(timezone),
    revision: Revision.increment(block.revision),
  });
}
