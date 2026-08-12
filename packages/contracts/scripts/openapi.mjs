import { fileURLToPath } from "node:url";

import { z } from "zod";

import { contractMetadataSchema, sseEnvelopeSchema } from "../dist/index.js";

export const openApiArtifact = fileURLToPath(
  new URL("../../../artifacts/openapi/xiangxu-v1.json", import.meta.url),
);

export function createOpenApiDocument() {
  return {
    openapi: "3.1.2",
    info: {
      title: "XIANGXU Contract Foundation",
      version: "1.0.0",
      description: "Generated. Do not hand-edit.",
    },
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    paths: {},
    components: {
      schemas: {
        ContractMetadata: z.toJSONSchema(contractMetadataSchema),
        SystemContractMetadataEvent: z.toJSONSchema(sseEnvelopeSchema),
      },
    },
    "x-xiangxu-generated": "Generated. Do not hand-edit.",
  };
}

export function serializeOpenApiDocument() {
  return `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`;
}
