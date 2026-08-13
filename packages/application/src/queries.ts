import type { IanaTimeZone, Rfc3339Instant, UUIDv7 } from "@xiangxu/domain";

export interface QueryContext {
  readonly actorId: UUIDv7;
  readonly correlationId: UUIDv7;
}

export interface Query<TType extends string, TParameters> {
  readonly queryType: TType;
  readonly context: QueryContext;
  readonly parameters: TParameters;
}

export type GetToday = Query<"today.get", { readonly date: string; readonly timezone: IanaTimeZone }>;
export type GetTask = Query<"task.get", { readonly taskId: UUIDv7 }>;
export type ListTasks = Query<"task.list", { readonly cursor?: string; readonly limit: number }>;
export type GetCalendarRange = Query<
  "calendar.range",
  { readonly startAt: Rfc3339Instant; readonly endAt: Rfc3339Instant; readonly timezone: IanaTimeZone }
>;
export type ListCaptures = Query<"capture.list", { readonly cursor?: string; readonly limit: number }>;
export type GetCapture = Query<"capture.get", { readonly captureId: UUIDv7 }>;
export type GetProposal = Query<"proposal.get", { readonly proposalId: UUIDv7 }>;
export type GetReview = Query<"review.get", { readonly date: string; readonly timezone: IanaTimeZone }>;
export type ReplaySseEvents = Query<"sse.replay", { readonly lastEventId?: string; readonly channels?: readonly string[] }>;

export type StageOneQuery =
  | GetToday
  | GetTask
  | ListTasks
  | GetCalendarRange
  | ListCaptures
  | GetCapture
  | GetProposal
  | GetReview
  | ReplaySseEvents;
