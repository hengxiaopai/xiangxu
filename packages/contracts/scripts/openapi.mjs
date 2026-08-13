import { fileURLToPath } from "node:url";

import { z } from "zod";

import {
  actorRefSchema,
  affectedRefsAndProjectionHintsSchema,
  applyProposalCommandSchema,
  captureItemDtoSchema,
  changeRecordDtoSchema,
  commitDailyPlanCommandSchema,
  completeTaskCommandSchema,
  contractMetadataSchema,
  createCaptureCommandSchema,
  createReviewSnapshotCommandSchema,
  createTaskCommandSchema,
  createTimeBlockCommandSchema,
  devSessionRequestSchema,
  devSessionResponseSchema,
  durableEventSchema,
  executionRecordDtoSchema,
  generateStructuredTriageProposalCommandSchema,
  moveTimeBlockCommandSchema,
  mutationResultSchema,
  objectRefSchema,
  offlineCaptureCommandSchema,
  planSnapshotDtoSchema,
  problemDetailsSchema,
  proposalDtoSchema,
  proposalPatchSchema,
  proposalTargetSchema,
  revisionDecimalSchema,
  reviewSnapshotDtoSchema,
  sseEnvelopeSchema,
  taskDtoSchema,
  timeBlockDtoSchema,
  uuidV7Schema,
} from "../dist/index.js";

export const openApiArtifact = fileURLToPath(
  new URL("../../../artifacts/openapi/xiangxu-v1.json", import.meta.url),
);

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const jsonResponse = (name, description = "Success") => ({
  description,
  content: { "application/json": { schema: ref(name) } },
});
const problemResponse = { description: "RFC 9457 Problem Details", content: { "application/problem+json": { schema: ref("ProblemDetails") } } };
const requestBody = (name) => ({ required: true, content: { "application/json": { schema: ref(name) } } });
const idParameter = { name: "id", in: "path", required: true, schema: ref("UUIDv7") };
const dateParameter = { name: "date", in: "path", required: true, schema: { type: "string", format: "date" } };
const ifMatchParameter = { name: "If-Match", in: "header", required: true, schema: { type: "string", pattern: '^"rev-[1-9][0-9]*"$' } };
const idempotencyParameter = { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8, maxLength: 128 } };
const errors = { "400": problemResponse, "401": problemResponse, "404": problemResponse, "409": problemResponse, "412": problemResponse, "428": problemResponse, "500": problemResponse, "503": problemResponse };

const schemaEntries = {
  ContractMetadata: contractMetadataSchema,
  UUIDv7: uuidV7Schema,
  RevisionDecimal: revisionDecimalSchema,
  ActorRef: actorRefSchema,
  ObjectRef: objectRefSchema,
  AffectedRefsAndProjectionHints: affectedRefsAndProjectionHintsSchema,
  ProblemDetails: problemDetailsSchema,
  Task: taskDtoSchema,
  TimeBlock: timeBlockDtoSchema,
  CaptureItem: captureItemDtoSchema,
  Proposal: proposalDtoSchema,
  ProposalPatch: proposalPatchSchema,
  ProposalTarget: proposalTargetSchema,
  MutationResult: mutationResultSchema,
  ChangeRecord: changeRecordDtoSchema,
  PlanSnapshot: planSnapshotDtoSchema,
  ExecutionRecord: executionRecordDtoSchema,
  ReviewSnapshot: reviewSnapshotDtoSchema,
  DurableEvent: durableEventSchema,
  SseEventEnvelope: sseEnvelopeSchema,
  OfflineCaptureCommand: offlineCaptureCommandSchema,
  CreateTaskCommand: createTaskCommandSchema,
  CompleteTaskCommand: completeTaskCommandSchema,
  CreateTimeBlockCommand: createTimeBlockCommandSchema,
  MoveTimeBlockCommand: moveTimeBlockCommandSchema,
  CreateCaptureCommand: createCaptureCommandSchema,
  GenerateStructuredTriageProposalCommand: generateStructuredTriageProposalCommandSchema,
  ApplyProposalCommand: applyProposalCommandSchema,
  CommitDailyPlanCommand: commitDailyPlanCommandSchema,
  CreateReviewSnapshotCommand: createReviewSnapshotCommandSchema,
  DevSessionRequest: devSessionRequestSchema,
  DevSessionResponse: devSessionResponseSchema,
};

export function createOpenApiDocument() {
  return {
    openapi: "3.1.2",
    info: {
      title: "XIANGXU Contract Foundation",
      version: "1.0.0",
      description: "Generated. Do not hand-edit.",
    },
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    paths: {
      "/api/v1/today": {
        get: { operationId: "getToday", parameters: [{ name: "date", in: "query", required: true, schema: { type: "string", format: "date" } }, { name: "timezone", in: "query", required: true, schema: { type: "string" } }], responses: { "200": jsonResponse("PlanSnapshot"), ...errors } },
      },
      "/api/v1/tasks": {
        get: { operationId: "listTasks", responses: { "200": { description: "Task list", content: { "application/json": { schema: { type: "array", items: ref("Task") } } } }, ...errors } },
        post: { operationId: "createTask", parameters: [idempotencyParameter], requestBody: requestBody("CreateTaskCommand"), responses: { "201": jsonResponse("MutationResult", "Created"), ...errors } },
      },
      "/api/v1/tasks/{id}": {
        get: { operationId: "getTask", parameters: [idParameter], responses: { "200": jsonResponse("Task"), ...errors } },
      },
      "/api/v1/tasks/{id}/complete": {
        post: { operationId: "completeTask", parameters: [idParameter, ifMatchParameter, idempotencyParameter], requestBody: requestBody("CompleteTaskCommand"), responses: { "200": jsonResponse("MutationResult"), ...errors } },
      },
      "/api/v1/time-blocks": {
        post: { operationId: "createTimeBlock", parameters: [idempotencyParameter], requestBody: requestBody("CreateTimeBlockCommand"), responses: { "201": jsonResponse("MutationResult", "Created"), ...errors } },
      },
      "/api/v1/time-blocks/{id}": {
        patch: { operationId: "moveTimeBlock", parameters: [idParameter, ifMatchParameter, idempotencyParameter], requestBody: requestBody("MoveTimeBlockCommand"), responses: { "200": jsonResponse("MutationResult"), ...errors } },
      },
      "/api/v1/calendar": {
        get: { operationId: "getCalendarRange", parameters: [{ name: "startAt", in: "query", required: true, schema: { type: "string", format: "date-time" } }, { name: "endAt", in: "query", required: true, schema: { type: "string", format: "date-time" } }, { name: "timezone", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "TimeBlock list", content: { "application/json": { schema: { type: "array", items: ref("TimeBlock") } } } }, ...errors } },
      },
      "/api/v1/captures": {
        get: { operationId: "listCaptures", responses: { "200": { description: "Capture list", content: { "application/json": { schema: { type: "array", items: ref("CaptureItem") } } } }, ...errors } },
        post: { operationId: "createCapture", parameters: [idempotencyParameter], requestBody: requestBody("CreateCaptureCommand"), responses: { "201": jsonResponse("MutationResult", "Created"), ...errors } },
      },
      "/api/v1/captures/{id}": {
        get: { operationId: "getCapture", parameters: [idParameter], responses: { "200": jsonResponse("CaptureItem"), ...errors } },
      },
      "/api/v1/captures/{id}/triage-proposals": {
        post: { operationId: "generateStructuredTriageProposal", parameters: [idParameter, idempotencyParameter], requestBody: requestBody("GenerateStructuredTriageProposalCommand"), responses: { "202": jsonResponse("MutationResult", "Accepted"), ...errors } },
      },
      "/api/v1/proposals/{id}": {
        get: { operationId: "getProposal", parameters: [idParameter], responses: { "200": jsonResponse("Proposal"), ...errors } },
      },
      "/api/v1/proposals/{id}/apply": {
        post: { operationId: "applyProposal", parameters: [idParameter, idempotencyParameter], requestBody: requestBody("ApplyProposalCommand"), responses: { "200": jsonResponse("MutationResult"), ...errors } },
      },
      "/api/v1/plans/commit": {
        post: { operationId: "commitDailyPlan", parameters: [idempotencyParameter], requestBody: requestBody("CommitDailyPlanCommand"), responses: { "201": jsonResponse("MutationResult", "Created"), ...errors } },
      },
      "/api/v1/reviews": {
        post: { operationId: "createReviewSnapshot", parameters: [idempotencyParameter], requestBody: requestBody("CreateReviewSnapshotCommand"), responses: { "201": jsonResponse("MutationResult", "Created"), ...errors } },
      },
      "/api/v1/reviews/{date}": {
        get: { operationId: "getReview", parameters: [dateParameter, { name: "timezone", in: "query", required: true, schema: { type: "string" } }], responses: { "200": jsonResponse("ReviewSnapshot"), ...errors } },
      },
      "/api/v1/stream": {
        get: { operationId: "replaySseEvents", parameters: [{ name: "Last-Event-ID", in: "header", required: false, schema: { type: "string" } }, { name: "channels", in: "query", required: false, schema: { type: "array", items: { type: "string" } } }], responses: { "200": { description: "Versioned SSE event stream", content: { "text/event-stream": { schema: ref("SseEventEnvelope") } } }, ...errors } },
      },
      "/api/dev/session": {
        post: { operationId: "createDevSession", description: "Development profile only; production is unavailable and fails closed. The server resolves the actor.", requestBody: requestBody("DevSessionRequest"), responses: { "200": jsonResponse("DevSessionResponse"), "404": problemResponse } },
        delete: { operationId: "deleteDevSession", description: "Development profile only; clears the opaque HttpOnly session cookie.", responses: { "204": { description: "Session cleared" }, "404": problemResponse } },
      },
    },
    components: {
      schemas: {
        ...Object.fromEntries(Object.entries(schemaEntries).map(([name, schema]) => [name, z.toJSONSchema(schema)])),
      },
    },
    "x-xiangxu-generated": "Generated. Do not hand-edit.",
  };
}

export function serializeOpenApiDocument() {
  return `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`;
}
