import {
  contractMetadataSchema,
  decodeSseEnvelope,
  encodeSseEnvelope,
  sseEnvelopeSchema,
  type ContractMetadata,
} from "./index.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertSame(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

const validMetadata = {
  contract: "xiangxu",
  contractVersion: "1.0.0",
  openapiVersion: "3.1.2",
} as const satisfies ContractMetadata;

assertSame(contractMetadataSchema.parse(validMetadata), validMetadata, "Valid metadata did not round-trip");
assert(!contractMetadataSchema.safeParse({ ...validMetadata, openapiVersion: "3.2.0" }).success, "Invalid metadata passed");

const envelope = sseEnvelopeSchema.parse({
  event: "system.contract-metadata",
  id: "stage-4.contract-smoke",
  data: validMetadata,
  version: "1",
});
assertSame(decodeSseEnvelope(encodeSseEnvelope(envelope)), envelope, "SSE envelope did not round-trip");
