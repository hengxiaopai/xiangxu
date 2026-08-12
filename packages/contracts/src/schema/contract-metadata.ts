import { z } from "zod";

export const contractMetadataSchema = z
  .object({
    contract: z.literal("xiangxu"),
    contractVersion: z.literal("1.0.0"),
    openapiVersion: z.literal("3.1.2"),
  })
  .strict();

export type ContractMetadata = z.infer<typeof contractMetadataSchema>;
