import { z } from "zod";

import { contractMetadataSchema } from "../schema/contract-metadata.js";
import {
  affectedRefsAndProjectionHintsSchema,
  projectionHintSchema,
  revisionDecimalSchema,
  uuidV7Schema,
} from "../schema/primitives.js";

const eventIdSchema = z.string().min(1).regex(/^[A-Za-z0-9._:-]+$/);
const envelope = <TEvent extends string, TData extends z.ZodType>(event: TEvent, data: TData) =>
  z.object({ event: z.literal(event), id: eventIdSchema, data, version: z.literal("1") }).strict();

const objectChangedDataSchema = affectedRefsAndProjectionHintsSchema.extend({
  revision: revisionDecimalSchema,
  changedFieldFamilies: z.array(z.string().min(1)),
});
const proposalReadyDataSchema = affectedRefsAndProjectionHintsSchema.extend({
  proposalId: uuidV7Schema,
  capability: z.string().min(1),
  surfaceHint: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]),
});
const jobProgressDataSchema = affectedRefsAndProjectionHintsSchema.extend({
  jobId: uuidV7Schema,
  jobClass: z.string().min(1),
  progress: z.number().min(0).max(1),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
});
const resyncRequiredDataSchema = z
  .object({
    affectedRefs: z.array(z.never()).max(0),
    projectionHints: z.array(projectionHintSchema),
    reason: z.literal("retention_gap"),
    latestEventId: eventIdSchema.optional(),
  })
  .strict();

export const sseEnvelopeSchema = z.discriminatedUnion("event", [
  envelope("system.contract-metadata", contractMetadataSchema),
  envelope("object.changed", objectChangedDataSchema),
  envelope("proposal.ready", proposalReadyDataSchema),
  envelope("job.progress", jobProgressDataSchema),
  envelope("system.resync-required", resyncRequiredDataSchema),
]);

export type SseEnvelope = z.infer<typeof sseEnvelopeSchema>;

export function encodeSseEnvelope(input: SseEnvelope): string {
  const envelope = sseEnvelopeSchema.parse(input);
  const payload = JSON.stringify({ version: envelope.version, data: envelope.data });
  return `id: ${envelope.id}\nevent: ${envelope.event}\ndata: ${payload}\n\n`;
}

export function decodeSseEnvelope(wire: string): SseEnvelope {
  const fields = new Map<string, string>();
  for (const line of wire.split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error("Invalid SSE field");
    fields.set(line.slice(0, separator), line.slice(separator + 1).trimStart());
  }

  const payload = z.object({ version: z.literal("1"), data: z.unknown() }).strict().parse(JSON.parse(fields.get("data") ?? ""));
  return sseEnvelopeSchema.parse({
    event: fields.get("event"),
    id: fields.get("id"),
    data: payload.data,
    version: payload.version,
  });
}
