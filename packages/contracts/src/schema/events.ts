import { z } from "zod";

import { affectedRefsAndProjectionHintsSchema, revisionDecimalSchema, rfc3339InstantSchema, uuidV7Schema } from "./primitives.js";

export const durableEventSchema = affectedRefsAndProjectionHintsSchema.extend({
  eventId: uuidV7Schema,
  topic: z.enum(["object.changed", "proposal.ready"]),
  revision: revisionDecimalSchema.optional(),
  commandId: uuidV7Schema,
  correlationId: uuidV7Schema,
  occurredAt: rfc3339InstantSchema,
});

export type DurableEventDto = z.infer<typeof durableEventSchema>;
