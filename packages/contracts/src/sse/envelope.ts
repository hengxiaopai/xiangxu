import { z } from "zod";

import { contractMetadataSchema } from "../schema/contract-metadata.js";

const sseDataSchema = z
  .object({
    version: z.literal("1"),
    data: contractMetadataSchema,
  })
  .strict();

export const sseEnvelopeSchema = z
  .object({
    event: z.literal("system.contract-metadata"),
    id: z.string().min(1).regex(/^[A-Za-z0-9._:-]+$/),
    data: contractMetadataSchema,
    version: z.literal("1"),
  })
  .strict();

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

  const payload = sseDataSchema.parse(JSON.parse(fields.get("data") ?? ""));
  return sseEnvelopeSchema.parse({
    event: fields.get("event"),
    id: fields.get("id"),
    data: payload.data,
    version: payload.version,
  });
}
