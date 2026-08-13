import { createHash, randomBytes } from "node:crypto";

import {
  DevSessionHandlers,
  CaptureHandlers,
  DeterministicStructuredProposalGenerator,
  KnowledgeHandlers,
  PlanReviewHandlers,
  ProposalHandlers,
  TaskHandlers,
  TimeBlockHandlers,
  parseRuntimeId,
  parseRuntimeInstant,
  type RuntimeValues,
  type SessionCrypto,
} from "@xiangxu/application";
import {
  PgDeviceSessionRepository,
  PgIdentityRepository,
  PgSseEventStream,
  PgUnitOfWork,
  createPostgresPool,
} from "@xiangxu/infrastructure";
import { v7 as uuidv7 } from "uuid";

const COOKIE_NAME = "xiangxu_dev_session";
const SESSION_SECONDS = 8 * 60 * 60;

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (value === undefined || value.length === 0) throw new Error("DATABASE_URL is required");
  return value;
}

const runtime: RuntimeValues = {
  now: () => parseRuntimeInstant(new Date().toISOString()),
  newId: () => parseRuntimeId(uuidv7()),
};

const sessionCrypto: SessionCrypto = {
  createOpaqueToken: () => randomBytes(32).toString("base64url"),
  hashToken: (token) => createHash("sha256").update(token, "utf8").digest("hex"),
};

let services: {
  readonly tasks: TaskHandlers;
  readonly timeBlocks: TimeBlockHandlers;
  readonly captures: CaptureHandlers;
  readonly proposals: ProposalHandlers;
  readonly dailyLoop: PlanReviewHandlers;
  readonly knowledge: KnowledgeHandlers;
  readonly sessions: DevSessionHandlers;
  readonly stream: PgSseEventStream;
} | undefined;

function runtimeServices() {
  if (services !== undefined) return services;
  const pool = createPostgresPool(requiredDatabaseUrl());
  services = {
    tasks: new TaskHandlers(new PgUnitOfWork(pool), runtime),
    timeBlocks: new TimeBlockHandlers(new PgUnitOfWork(pool), runtime),
    captures: new CaptureHandlers(new PgUnitOfWork(pool), runtime),
    proposals: new ProposalHandlers(
      new PgUnitOfWork(pool), runtime, new DeterministicStructuredProposalGenerator(),
    ),
    dailyLoop: new PlanReviewHandlers(new PgUnitOfWork(pool), runtime),
    knowledge: new KnowledgeHandlers(new PgUnitOfWork(pool), runtime),
    sessions: new DevSessionHandlers(
      new PgIdentityRepository(pool),
      new PgDeviceSessionRepository(pool),
      sessionCrypto,
      runtime,
    ),
    stream: new PgSseEventStream(pool),
  };
  return services;
}

export const taskHandlers = {
  create: (...args: Parameters<TaskHandlers["create"]>) => runtimeServices().tasks.create(...args),
  get: (...args: Parameters<TaskHandlers["get"]>) => runtimeServices().tasks.get(...args),
  list: (...args: Parameters<TaskHandlers["list"]>) => runtimeServices().tasks.list(...args),
  complete: (...args: Parameters<TaskHandlers["complete"]>) => runtimeServices().tasks.complete(...args),
};

export const timeBlockHandlers = {
  create: (...args: Parameters<TimeBlockHandlers["create"]>) => runtimeServices().timeBlocks.create(...args),
  move: (...args: Parameters<TimeBlockHandlers["move"]>) => runtimeServices().timeBlocks.move(...args),
};

export const captureHandlers = {
  create: (...args: Parameters<CaptureHandlers["create"]>) => runtimeServices().captures.create(...args),
  get: (...args: Parameters<CaptureHandlers["get"]>) => runtimeServices().captures.get(...args),
};

export const proposalHandlers = {
  get: (...args: Parameters<ProposalHandlers["get"]>) => runtimeServices().proposals.get(...args),
  generate: (...args: Parameters<ProposalHandlers["generate"]>) => runtimeServices().proposals.generate(...args),
  apply: (...args: Parameters<ProposalHandlers["apply"]>) => runtimeServices().proposals.apply(...args),
};

export const dailyLoopHandlers = {
  commitPlan: (...args: Parameters<PlanReviewHandlers["commitPlan"]>) => runtimeServices().dailyLoop.commitPlan(...args),
  getToday: (...args: Parameters<PlanReviewHandlers["getToday"]>) => runtimeServices().dailyLoop.getToday(...args),
  createReview: (...args: Parameters<PlanReviewHandlers["createReview"]>) => runtimeServices().dailyLoop.createReview(...args),
  getReview: (...args: Parameters<PlanReviewHandlers["getReview"]>) => runtimeServices().dailyLoop.getReview(...args),
};

export const knowledgeHandlers = {
  createLibrary: (...args: Parameters<KnowledgeHandlers["createLibrary"]>) => runtimeServices().knowledge.createLibrary(...args),
  listLibraries: (...args: Parameters<KnowledgeHandlers["listLibraries"]>) => runtimeServices().knowledge.listLibraries(...args),
  getOverview: (...args: Parameters<KnowledgeHandlers["getOverview"]>) => runtimeServices().knowledge.getOverview(...args),
};

export const devSessionHandlers = {
  establish: (...args: Parameters<DevSessionHandlers["establish"]>) => runtimeServices().sessions.establish(...args),
  resolve: (...args: Parameters<DevSessionHandlers["resolve"]>) => runtimeServices().sessions.resolve(...args),
  end: (...args: Parameters<DevSessionHandlers["end"]>) => runtimeServices().sessions.end(...args),
};

export const sseEventStream = {
  currentCursor: () => runtimeServices().stream.currentCursor(),
  replay: (...args: Parameters<PgSseEventStream["replay"]>) => runtimeServices().stream.replay(...args),
};

export function sseRuntimeConfig() {
  const pollMilliseconds = positiveRuntimeInteger(process.env.XIANGXU_SSE_POLL_MS, 250);
  const heartbeatMilliseconds = positiveRuntimeInteger(process.env.XIANGXU_SSE_HEARTBEAT_MS, 15_000);
  const replayLimit = positiveRuntimeInteger(process.env.XIANGXU_SSE_REPLAY_LIMIT, 100);
  return { pollMilliseconds, heartbeatMilliseconds, replayLimit } as const;
}

function positiveRuntimeInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error("SSE runtime values must be positive integers");
  return parsed;
}

export function isDevSessionEnabled(): boolean {
  const profile = process.env.XIANGXU_RUNTIME_PROFILE;
  return (profile === "local" || profile === "test") && process.env.XIANGXU_DEV_SESSION_ENABLED === "1";
}

export function sessionExpiry() {
  return parseRuntimeInstant(new Date(Date.now() + SESSION_SECONDS * 1000).toISOString());
}

export const devSessionCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_SECONDS,
} as const;

export function hashCanonicalRequest(canonicalRequest: string): string {
  return `sha256:${createHash("sha256").update(canonicalRequest, "utf8").digest("hex")}`;
}

export function hashTextContent(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}
