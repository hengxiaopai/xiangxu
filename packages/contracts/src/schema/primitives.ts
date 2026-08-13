import { z } from "zod";

const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;

export const uuidV7Schema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  .describe("Canonical lowercase RFC 9562 UUID version 7 text");

export const revisionDecimalSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .max(19)
  .refine(
    (value) => /^[1-9][0-9]*$/.test(value) && value.length <= 19 && BigInt(value) <= POSTGRES_BIGINT_MAX,
    "Revision exceeds PostgreSQL bigint",
  )
  .describe("Canonical positive decimal PostgreSQL bigint; never a JSON number");

export const rfc3339InstantSchema = z.iso.datetime({ offset: true });
export const localDateSchema = z.iso.date();
export const ianaTimeZoneSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
      return value.includes("/") || value === "UTC";
    } catch {
      return false;
    }
  }, "Expected an IANA timezone ID");

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const requestFingerprintSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const actorRefSchema = z
  .object({
    actorType: z.enum(["user", "system", "ai", "connector"]),
    actorId: uuidV7Schema,
  })
  .strict();

export const objectRefSchema = z
  .object({
    objectType: z.enum([
      "task",
      "time_block",
      "capture_item",
      "raw_payload",
      "proposal",
      "plan_snapshot",
      "execution_record",
      "review_snapshot",
      "change_record",
    ]),
    id: uuidV7Schema,
  })
  .strict();

export const projectionHintSchema = z.enum(["today", "tasks", "calendar", "captures", "proposals", "review"]);

export const affectedRefsAndProjectionHintsSchema = z
  .object({
    affectedRefs: z.array(objectRefSchema),
    projectionHints: z.array(projectionHintSchema),
  })
  .strict();

export const sourceContextSchema = z
  .object({
    route: z.string().min(1).optional(),
    surface: z.string().min(1).optional(),
    clientId: z.string().min(1).optional(),
  })
  .strict();

export const commandMetadataSchema = z
  .object({
    commandId: uuidV7Schema,
    sourceContext: sourceContextSchema,
  })
  .strict();

export type RevisionDecimal = z.infer<typeof revisionDecimalSchema>;
export type ObjectRefDto = z.infer<typeof objectRefSchema>;
export type AffectedRefsAndProjectionHints = z.infer<typeof affectedRefsAndProjectionHintsSchema>;
