import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createPendingOfflineCapture, HttpOfflineCaptureTransport, syncOfflineCapture, syncPendingOfflineCaptures, visibleOfflineCaptures } from "../../apps/web/src/client/offline/offline-capture";
import { establishClientSession, retireClientSession } from "../../apps/web/src/client/state/auth-epoch";
import { applyMutationInvalidation, applySseInvalidation, exactInvalidationKeys } from "../../apps/web/src/client/state/invalidation";
import { createClientQueryClient } from "../../apps/web/src/client/state/query-client";
import { queryKeys, type ClientAuthEpoch } from "../../apps/web/src/client/state/query-keys";

const taskA = "0198f1a0-1000-7000-8000-000000000001";
const taskB = "0198f1a0-1000-7000-8000-000000000002";
const localId = "0198f1a0-1000-7000-8000-000000000003";
const captureId = "0198f1a0-1000-7000-8000-000000000004";
const rawId = "0198f1a0-1000-7000-8000-000000000005";
const commandId = "0198f1a0-1000-7000-8000-000000000006";
const epochA = "0198f1a0-1000-7000-8000-000000000007" as ClientAuthEpoch;
const epochB = "0198f1a0-1000-7000-8000-000000000008" as ClientAuthEpoch;
const fingerprint = `sha256:${"a".repeat(64)}`;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mutation = {
  affectedRefs: [{ objectType: "task", id: taskA }],
  projectionHints: ["today", "tasks"],
} as const;

function pending(epoch = epochA) {
  return createPendingOfflineCapture({
    localId,
    authEpoch: epoch,
    capturedAt: "2026-08-13T08:00:00.000Z",
    requestFingerprint: fingerprint,
    payload: {
      commandId,
      sourceContext: { surface: "quick-capture" },
      captureId,
      rawPayload: { id: rawId, kind: "text", text: "offline capture" },
    },
  });
}

describe("Stage 6 exact TanStack invalidation", () => {
  it("uses one mapper for HTTP and SSE and invalidates only exact actor-scoped projections", async () => {
    const queryClient = createClientQueryClient();
    queryClient.setQueryData(queryKeys.today(epochA), { date: "2026-08-13" });
    queryClient.setQueryData(queryKeys.tasks(epochA), [taskA]);
    queryClient.setQueryData(queryKeys.task(epochA, taskA), { id: taskA });
    queryClient.setQueryData(queryKeys.task(epochA, taskB), { id: taskB });
    queryClient.setQueryData(queryKeys.task(epochB, taskA), { id: taskA });

    expect(exactInvalidationKeys(mutation, epochA)).toEqual([
      queryKeys.today(epochA),
      queryKeys.tasks(epochA),
      queryKeys.task(epochA, taskA),
    ]);
    expect(exactInvalidationKeys(mutation, epochA)).toEqual(exactInvalidationKeys(mutation, epochA));
    await applyMutationInvalidation(queryClient, mutation, epochA);

    expect(queryClient.getQueryState(queryKeys.today(epochA))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.tasks(epochA))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.task(epochA, taskA))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.task(epochA, taskB))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(queryKeys.task(epochB, taskA))?.isInvalidated).toBe(false);

    queryClient.resetQueries({ queryKey: queryKeys.task(epochA, taskA), exact: true });
    await applySseInvalidation(queryClient, mutation, epochA);
    expect(queryClient.getQueryState(queryKeys.task(epochA, taskA))?.isInvalidated).toBe(true);
  });

  it("fails closed for unknown hints and has no global invalidate call", async () => {
    expect(exactInvalidationKeys({ affectedRefs: [], projectionHints: ["unknown"] } as never, epochA)).toEqual([]);
    const source = await readFile(path.join(repositoryRoot, "apps/web/src/client/state/invalidation.ts"), "utf8");
    expect(source).not.toMatch(/invalidateQueries\(\s*\)/u);
    expect(source).toContain("exact: true");
  });

  it("rotates the non-authoritative client auth epoch", () => {
    expect(establishClientSession()).not.toBe(retireClientSession());
  });
});

describe("Stage 6 offline Capture state machine", () => {
  it("keeps UUIDv7 and Idempotency-Key stable across lost acknowledgement replay", async () => {
    const original = pending();
    const attempts: unknown[] = [];
    let call = 0;
    const transport = {
      create: async (command: typeof original.command) => {
        attempts.push(command);
        call++;
        return call === 1
          ? { outcome: "retryable-failure" as const }
          : { outcome: "success" as const, result: { affectedRefs: [], projectionHints: [] } };
      },
    };
    const afterLostAck = await syncOfflineCapture(original, epochA, transport);
    const completed = await syncOfflineCapture(afterLostAck, epochA, transport);
    expect(afterLostAck.command.state).toBe("pending");
    expect(completed.command.state).toBe("done");
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({ localId, idempotencyKey: localId, payload: original.command.payload });
    expect(attempts[1]).toMatchObject({ localId, idempotencyKey: localId, payload: original.command.payload });
  });

  it("makes same-key conflict visible and never silently creates a new key", async () => {
    const original = pending();
    const conflicted = await syncOfflineCapture(original, epochA, {
      create: async () => ({ outcome: "idempotency-conflict" }),
    });
    expect(conflicted.command.state).toBe("conflict");
    expect(conflicted.command.idempotencyKey).toBe(original.command.idempotencyKey);
  });

  it("replays the exact frozen CreateCapture payload and Idempotency-Key through HTTP", async () => {
    const original = pending();
    let request: { readonly input: string | URL | Request; readonly init?: RequestInit } | undefined;
    const transport = new HttpOfflineCaptureTransport(async (input, init) => {
      request = { input, ...(init === undefined ? {} : { init }) };
      return Response.json({
        affectedRefs: [{ objectType: "capture_item", id: captureId }],
        projectionHints: ["captures"],
        changeId: "0198f1a0-1000-7000-8000-000000000009",
        revision: "1",
      }, { status: 201 });
    });
    expect((await transport.create(original.command)).outcome).toBe("success");
    expect(request?.input).toBe("/api/v1/captures");
    expect(new Headers(request?.init?.headers).get("Idempotency-Key")).toBe(localId);
    expect(JSON.parse(String(request?.init?.body))).toEqual(original.command.payload);
  });

  it("maps real HTTP authority and idempotency failures without inventing a new command", async () => {
    const original = pending();
    const unauthorized = new HttpOfflineCaptureTransport(async () => new Response(null, { status: 401 }));
    expect((await unauthorized.create(original.command)).outcome).toBe("unauthorized");
    const conflict = new HttpOfflineCaptureTransport(async () => Response.json({
      type: "https://xiangxu.local/problems/idempotency-conflict",
      title: "Idempotency Conflict",
      status: 409,
      code: "IDEMPOTENCY_CONFLICT",
      correlationId: "0198f1a0-1000-7000-8000-000000000009",
      instance: "/api/v1/captures",
    }, { status: 409 }));
    expect((await conflict.create(original.command)).outcome).toBe("idempotency-conflict");
  });

  it("keeps network and malformed-response failures retryable", async () => {
    const original = pending();
    const offline = new HttpOfflineCaptureTransport(async () => { throw new TypeError("network unavailable"); });
    expect((await offline.create(original.command)).outcome).toBe("retryable-failure");
    const malformed = new HttpOfflineCaptureTransport(async () => Response.json({ invented: true }, { status: 201 }));
    expect((await malformed.create(original.command)).outcome).toBe("retryable-failure");
  });

  it("blocks automatic replay after 401 or auth epoch rotation", async () => {
    const unauthorized = await syncOfflineCapture(pending(), epochA, {
      create: async () => ({ outcome: "unauthorized" }),
    });
    expect(unauthorized.command.state).toBe("pending");
    expect(unauthorized.automaticSyncBlocked).toBe(true);

    let sent = false;
    const crossed = await syncOfflineCapture(pending(), epochB, {
      create: async () => { sent = true; return { outcome: "success", result: {} }; },
    });
    expect(crossed.command.state).toBe("conflict");
    expect(sent).toBe(false);
    expect(visibleOfflineCaptures([pending()], epochB)).toEqual([]);
  });

  it("restores queued records through the store boundary", async () => {
    let records = [pending()];
    const store = {
      put: async (record: (typeof records)[number]) => { records = [record]; },
      list: async () => records,
    };
    const result = await syncPendingOfflineCaptures(store, epochA, {
      create: async () => ({ outcome: "success", result: {} }),
    });
    expect(result[0]?.command.state).toBe("done");
    expect(records[0]?.command.state).toBe("done");
  });

  it("uses native IndexedDB and does not add forbidden offline transports", async () => {
    const source = await readFile(path.join(repositoryRoot, "apps/web/src/client/offline/indexeddb-capture-queue.ts"), "utf8");
    expect(source).toContain("globalThis.indexedDB");
    expect(source).not.toMatch(/fake-indexeddb|Dexie|localForage|localStorage|ServiceWorker|Workbox/iu);
  });
});
