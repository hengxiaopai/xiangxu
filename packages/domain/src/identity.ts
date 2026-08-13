declare const uuidV7Brand: unique symbol;
export type UUIDv7 = string & { readonly [uuidV7Brand]: "UUIDv7" };

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const UUIDv7 = {
  isValid(value: string): value is UUIDv7 {
    return UUID_V7_PATTERN.test(value);
  },
  parse(value: string): UUIDv7 {
    if (!UUID_V7_PATTERN.test(value)) {
      throw new Error("UUIDv7 must be canonical lowercase RFC 9562 version 7 text");
    }
    return value as UUIDv7;
  },
  toString(value: UUIDv7): string {
    return value;
  },
};

declare const revisionBrand: unique symbol;
export type Revision = bigint & { readonly [revisionBrand]: "Revision" };

export const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;
const REVISION_PATTERN = /^[1-9][0-9]*$/;

function assertRevision(value: bigint): Revision {
  if (value < 1n || value > POSTGRES_BIGINT_MAX) {
    throw new Error("Revision must fit the positive PostgreSQL bigint range");
  }
  return value as Revision;
}

export const Revision = {
  parseBigInt(value: bigint | string): Revision {
    if (typeof value === "string" && !REVISION_PATTERN.test(value)) {
      throw new Error("Revision text must be a canonical positive decimal string");
    }
    return assertRevision(typeof value === "bigint" ? value : BigInt(value));
  },
  increment(value: Revision): Revision {
    return assertRevision(value + 1n);
  },
  equals(left: Revision, right: Revision): boolean {
    return left === right;
  },
  toDecimalString(value: Revision): string {
    return value.toString(10);
  },
};

export type ActorType = "user" | "system" | "ai" | "connector";

export interface ActorRef {
  readonly actorType: ActorType;
  readonly actorId: UUIDv7;
}

export type SliceObjectType =
  | "task"
  | "time_block"
  | "capture_item"
  | "raw_payload"
  | "proposal"
  | "plan_snapshot"
  | "execution_record"
  | "review_snapshot"
  | "library"
  | "change_record";

export interface ObjectRef {
  readonly objectType: SliceObjectType;
  readonly id: UUIDv7;
}

const RFC3339_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

export type Rfc3339Instant = string & { readonly __rfc3339Instant: true };
export type IanaTimeZone = string & { readonly __ianaTimeZone: true };

export function parseRfc3339Instant(value: string): Rfc3339Instant {
  const match = RFC3339_INSTANT_PATTERN.exec(value);
  if (match === null) throw new Error("Instant must be valid RFC3339 text with an offset");
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    match[1],
    match[2],
    match[3],
    match[4],
    match[5],
    match[6],
    match[8],
    match[9],
  ].map((part) => (part === undefined ? undefined : Number(part)));
  const daysInMonth = new Date(Date.UTC(year ?? 0, month ?? 0, 0)).getUTCDate();
  if (
    month === undefined || month < 1 || month > 12 ||
    day === undefined || day < 1 || day > daysInMonth ||
    hour === undefined || hour > 23 ||
    minute === undefined || minute > 59 ||
    second === undefined || second > 59 ||
    (offsetHour !== undefined && offsetHour > 23) ||
    (offsetMinute !== undefined && offsetMinute > 59) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new Error("Instant must be valid RFC3339 text with an offset");
  }
  return value as Rfc3339Instant;
}

export function parseIanaTimeZone(value: string): IanaTimeZone {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
  } catch {
    throw new Error("Timezone must be a valid IANA timezone ID");
  }
  if (!value.includes("/") && value !== "UTC") {
    throw new Error("Timezone must be a named IANA timezone ID");
  }
  return value as IanaTimeZone;
}
