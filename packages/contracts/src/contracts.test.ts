/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import {
  canonicalizeValidatedRequest,
  captureItemDtoSchema,
  completeTaskCommandSchema,
  compareRequiredIfMatch,
  createCaptureCommandSchema,
  createTaskCommandSchema,
  createTimeBlockCommandSchema,
  decodeSseEnvelope,
  encodeSseEnvelope,
  formatRevisionEtag,
  idempotencyKeySchema,
  offlineCaptureCommandSchema,
  parseRequiredIfMatch,
  parseRevisionEtag,
  problemDetailsSchema,
  proposalDtoSchema,
  revisionDecimalSchema,
  sseEnvelopeSchema,
  taskDtoSchema,
  uuidV7Schema,
} from "./index.js";

const id = "0198f1a0-1234-7abc-8def-0123456789ab";
const ownerId = "0198f1a0-2234-7abc-8def-0123456789ab";
const rawId = "0198f1a0-3234-7abc-8def-0123456789ab";
const commandId = "0198f1a0-4234-7abc-8def-0123456789ab";
const actor = { actorType: "user", actorId: ownerId } as const;
const sourceContext = { route: "/login", surface: "quick-capture" };
const metadata = { commandId, sourceContext };

describe("transport primitives", () => {
  it("validates UUIDv7, revision and Idempotency-Key positives and negatives", () => {
    expect(uuidV7Schema.parse(id)).toBe(id);
    expect(uuidV7Schema.safeParse(id.toUpperCase()).success).toBe(false);
    expect(uuidV7Schema.safeParse("0198f1a0-1234-4abc-8def-0123456789ab").success).toBe(false);
    expect(revisionDecimalSchema.parse("9007199254740993")).toBe("9007199254740993");
    for (const value of ["", "0", "01", "-1", "1.0", "1e3", "9223372036854775808"]) {
      expect(revisionDecimalSchema.safeParse(value).success).toBe(false);
    }
    expect(idempotencyKeySchema.parse(commandId)).toBe(commandId);
    expect(idempotencyKeySchema.safeParse("spaces are invalid").success).toBe(false);
  });

  it("canonicalizes validated requests independent of object key order", () => {
    expect(canonicalizeValidatedRequest({ b: 2, a: { d: 4, c: 3 } })).toBe(
      canonicalizeValidatedRequest({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});

describe("ETag and If-Match", () => {
  it("round-trips an extreme revision without precision loss", () => {
    const revision = "9007199254740993";
    expect(formatRevisionEtag(revision)).toBe('"rev-9007199254740993"');
    expect(parseRevisionEtag('"rev-9007199254740993"')).toBe(revision);
    expect(parseRequiredIfMatch('"rev-9007199254740993"')).toEqual({ outcome: "accepted", baseRevision: revision });
  });

  it("rejects every malformed validator and maps missing input", () => {
    for (const value of ["rev-1", 'W/"rev-1"', "*", '"rev-0"', '"rev-01"', '"rev--1"', '"rev-1.0"', '"rev-1e3"', '"rev-1", "rev-2"', ""]) {
      expect(() => parseRevisionEtag(value)).toThrow();
    }
    expect(() => parseRevisionEtag('"rev-9223372036854775808"')).toThrow();
    expect(parseRequiredIfMatch(undefined)).toEqual({ outcome: "rejected", status: 428, code: "PRECONDITION_REQUIRED" });
    expect(parseRequiredIfMatch("rev-1")).toEqual({ outcome: "rejected", status: 400, code: "VALIDATION_ERROR" });
    expect(compareRequiredIfMatch('"rev-1"', "2")).toEqual({
      outcome: "rejected",
      status: 412,
      code: "PRECONDITION_FAILED",
      currentRevision: "2",
    });
  });
});

describe("Task, TimeBlock and Capture DTOs", () => {
  it("accepts Task create/complete without client authority fields", () => {
    const create = { ...metadata, taskId: id, title: "Freeze contracts", commitmentState: "committed" };
    expect(createTaskCommandSchema.parse(create)).toEqual(create);
    expect(createTaskCommandSchema.safeParse({ ...create, ownerId }).success).toBe(false);
    expect(completeTaskCommandSchema.parse(metadata)).toEqual(metadata);
    expect(taskDtoSchema.parse({
      id,
      title: "Freeze contracts",
      ownerId,
      status: "open",
      commitmentState: "committed",
      revision: "9007199254740993",
      createdAt: "2026-08-12T09:00:00+08:00",
      updatedAt: "2026-08-12T09:00:00+08:00",
      createdBy: actor,
      updatedBy: actor,
    }).revision).toBe("9007199254740993");
  });

  it("rejects invalid TimeBlock intervals and accepts an IANA timezone", () => {
    const value = {
      ...metadata,
      timeBlockId: rawId,
      taskId: id,
      startAt: "2026-08-12T10:00:00+08:00",
      endAt: "2026-08-12T11:00:00+08:00",
      timezone: "Asia/Shanghai",
      locked: true,
    };
    expect(createTimeBlockCommandSchema.parse(value)).toEqual(value);
    expect(createTimeBlockCommandSchema.safeParse({ ...value, endAt: value.startAt }).success).toBe(false);
    expect(createTimeBlockCommandSchema.safeParse({ ...value, timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("keeps raw payload input distinct from immutable rawPayloadRef output", () => {
    const command = { ...metadata, captureId: id, rawPayload: { id: rawId, kind: "text", text: "Call supplier" } };
    expect(createCaptureCommandSchema.parse(command)).toEqual(command);
    const capture = {
      id,
      ownerId,
      rawPayloadRef: { id: rawId, kind: "text" },
      parseStatus: "pending",
      triageStatus: "untriaged",
      revision: "1",
      materializedObjectIds: [],
    };
    expect(captureItemDtoSchema.parse(capture)).toEqual(capture);
    expect(captureItemDtoSchema.safeParse({ ...capture, rawText: "Call supplier" }).success).toBe(false);
  });
});

describe("Proposal, Problem Details and Offline contracts", () => {
  const targetRef = { objectType: "capture_item", id } as const;
  const proposal = {
    id: rawId,
    proposalType: "classify",
    targetRefs: [targetRef],
    baseRevisions: [{ targetRef, baseRevision: "9007199254740993" }],
    patch: { kind: "capture.classify", captureId: id, candidateType: "task" },
    rationale: "Actionable text",
    evidenceRefs: [targetRef],
    impactSummary: "Classification only",
    riskLevel: "low",
    status: "ready",
    createdBy: { actorType: "ai", actorId: ownerId },
  } as const;

  it("accepts the frozen Proposal schema and rejects revision or generic patches", () => {
    expect(proposalDtoSchema.parse(proposal).baseRevisions[0]?.baseRevision).toBe("9007199254740993");
    expect(proposalDtoSchema.safeParse({ ...proposal, revision: "1" }).success).toBe(false);
    expect(proposalDtoSchema.safeParse({ ...proposal, patch: { anything: true } }).success).toBe(false);
    expect(proposalDtoSchema.safeParse({ ...proposal, targetRefs: [], baseRevisions: [] }).success).toBe(false);
  });

  it("validates RFC 9457 and rejects incomplete problem payloads", () => {
    const problem = {
      type: "https://xiangxu.local/problems/revision-conflict",
      title: "Object changed",
      status: 409,
      code: "REVISION_CONFLICT",
      correlationId: commandId,
      conflict: { currentRevision: "9007199254740993" },
    };
    expect(problemDetailsSchema.parse(problem)).toEqual(problem);
    expect(problemDetailsSchema.safeParse({ title: "bad", status: 409 }).success).toBe(false);
    expect(problemDetailsSchema.safeParse({ ...problem, status: 500 }).success).toBe(false);
  });

  it("keeps the offline allowlist typed and capture-only", () => {
    const offline = {
      localId: id,
      commandType: "capture.create",
      payload: { ...metadata, captureId: id, rawPayload: { id: rawId, kind: "text", text: "Inbox" } },
      idempotencyKey: commandId,
      requestFingerprint: `sha256:${"a".repeat(64)}`,
      capturedAt: "2026-08-12T09:00:00+08:00",
      retryCount: 0,
      state: "pending",
    };
    expect(offlineCaptureCommandSchema.parse(offline)).toEqual(offline);
    expect(offlineCaptureCommandSchema.safeParse({ ...offline, commandType: "task.complete" }).success).toBe(false);
  });
});

describe("versioned SSE union", () => {
  it("round-trips object.changed with shared affected refs and projection hints", () => {
    const event = sseEnvelopeSchema.parse({
      event: "object.changed",
      id: "event-42",
      version: "1",
      data: {
        affectedRefs: [{ objectType: "task", id }],
        projectionHints: ["today", "tasks"],
        revision: "9007199254740993",
        changedFieldFamilies: ["status"],
      },
    });
    expect(decodeSseEnvelope(encodeSseEnvelope(event))).toEqual(event);
  });

  it("rejects invalid event names, numeric revisions and malformed data", () => {
    expect(sseEnvelopeSchema.safeParse({ event: "object.changed", id: "event-1", version: "1", data: { affectedRefs: [], projectionHints: [], revision: 2, changedFieldFamilies: [] } }).success).toBe(false);
    expect(sseEnvelopeSchema.safeParse({ event: "something.else", id: "event-1", version: "1", data: {} }).success).toBe(false);
  });
});
