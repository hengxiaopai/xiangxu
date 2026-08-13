import {
  canonicalizeValidatedRequest,
  createCaptureCommandSchema,
  mutationResultSchema,
  offlineCaptureCommandSchema,
  problemDetailsSchema,
  type CreateCaptureCommandDto,
  type OfflineCaptureCommand,
} from "@xiangxu/contracts";
import { v7 as uuidv7 } from "uuid";

import type { ClientAuthEpoch } from "../state/query-keys";

export interface StoredOfflineCapture {
  readonly command: OfflineCaptureCommand;
  readonly authEpoch: ClientAuthEpoch;
  readonly automaticSyncBlocked: boolean;
}

export interface OfflineCaptureStore {
  put(record: StoredOfflineCapture): Promise<void>;
  list(): Promise<readonly StoredOfflineCapture[]>;
}

export function visibleOfflineCaptures(
  records: readonly StoredOfflineCapture[],
  currentEpoch: ClientAuthEpoch,
): readonly StoredOfflineCapture[] {
  return records.filter((record) => record.authEpoch === currentEpoch);
}

export type OfflineSyncOutcome =
  | { readonly outcome: "success"; readonly result: Readonly<Record<string, unknown>> }
  | { readonly outcome: "idempotency-conflict" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "retryable-failure" };

export interface OfflineCaptureTransport {
  create(command: OfflineCaptureCommand): Promise<OfflineSyncOutcome>;
}

export class HttpOfflineCaptureTransport implements OfflineCaptureTransport {
  constructor(private readonly fetcher: typeof globalThis.fetch = globalThis.fetch.bind(globalThis)) {}

  async create(command: OfflineCaptureCommand): Promise<OfflineSyncOutcome> {
    try {
      const validated = offlineCaptureCommandSchema.parse(command);
      const response = await this.fetcher("/api/v1/captures", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": validated.idempotencyKey,
        },
        body: JSON.stringify(validated.payload),
      });
      if (response.ok) return { outcome: "success", result: mutationResultSchema.parse(await response.json()) };
      if (response.status === 401) return { outcome: "unauthorized" };
      if (response.status === 409) {
        const problem = problemDetailsSchema.safeParse(await response.json());
        if (problem.success && problem.data.code === "IDEMPOTENCY_CONFLICT") return { outcome: "idempotency-conflict" };
      }
    } catch {
      return { outcome: "retryable-failure" };
    }
    return { outcome: "retryable-failure" };
  }
}

export async function queueOfflineCapture(
  store: OfflineCaptureStore,
  payload: CreateCaptureCommandDto,
  authEpoch: ClientAuthEpoch,
  now = new Date(),
): Promise<StoredOfflineCapture> {
  const validated = createCaptureCommandSchema.parse(payload);
  const localId = uuidv7();
  const record = createPendingOfflineCapture({
    localId,
    payload: validated,
    authEpoch,
    capturedAt: now.toISOString(),
    requestFingerprint: await browserFingerprint(validated),
  });
  await store.put(record);
  return record;
}

export function createPendingOfflineCapture(input: {
  readonly localId: string;
  readonly payload: CreateCaptureCommandDto;
  readonly authEpoch: ClientAuthEpoch;
  readonly capturedAt: string;
  readonly requestFingerprint: string;
}): StoredOfflineCapture {
  const command = offlineCaptureCommandSchema.parse({
    localId: input.localId,
    commandType: "capture.create",
    payload: createCaptureCommandSchema.parse(input.payload),
    idempotencyKey: input.localId,
    requestFingerprint: input.requestFingerprint,
    capturedAt: input.capturedAt,
    retryCount: 0,
    state: "pending",
  });
  return { command, authEpoch: input.authEpoch, automaticSyncBlocked: false };
}

export async function syncOfflineCapture(
  record: StoredOfflineCapture,
  currentEpoch: ClientAuthEpoch,
  transport: OfflineCaptureTransport,
): Promise<StoredOfflineCapture> {
  const command = offlineCaptureCommandSchema.parse(record.command);
  if (record.authEpoch !== currentEpoch) return transition(record, "conflict", true, command.retryCount);
  if (record.automaticSyncBlocked || command.state === "done" || command.state === "conflict" || command.state === "failed") {
    return record;
  }
  const syncing = transition(record, "syncing", false, command.retryCount + 1);
  const result = await transport.create(syncing.command);
  if (result.outcome === "success") return transition(syncing, "done", true, syncing.command.retryCount);
  if (result.outcome === "idempotency-conflict") return transition(syncing, "conflict", true, syncing.command.retryCount);
  if (result.outcome === "unauthorized") return transition(syncing, "pending", true, syncing.command.retryCount);
  return transition(syncing, "pending", false, syncing.command.retryCount);
}

export async function syncPendingOfflineCaptures(
  store: OfflineCaptureStore,
  currentEpoch: ClientAuthEpoch,
  transport: OfflineCaptureTransport,
): Promise<readonly StoredOfflineCapture[]> {
  const results: StoredOfflineCapture[] = [];
  for (const record of await store.list()) {
    const next = await syncOfflineCapture(record, currentEpoch, transport);
    if (next !== record) await store.put(next);
    results.push(next);
  }
  return results;
}

function transition(
  record: StoredOfflineCapture,
  state: OfflineCaptureCommand["state"],
  automaticSyncBlocked: boolean,
  retryCount: number,
): StoredOfflineCapture {
  return {
    ...record,
    command: offlineCaptureCommandSchema.parse({ ...record.command, state, retryCount }),
    automaticSyncBlocked,
  };
}

async function browserFingerprint(value: CreateCaptureCommandDto): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeValidatedRequest(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
