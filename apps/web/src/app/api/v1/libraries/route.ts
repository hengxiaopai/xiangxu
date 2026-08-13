import { parseRuntimeId, type CreateLibrary } from "@xiangxu/application";
import { createLibraryCommandSchema } from "@xiangxu/contracts";

import { knowledgeHandlers } from "../../../../server/composition/runtime";
import {
  libraryListJson,
  mutationJson,
  parseIdempotencyKey,
  problem,
  requestFingerprint,
  resolveRequestActor,
} from "../../../../server/http";

export async function GET(request: Request) {
  const instance = "/api/v1/libraries";
  try {
    const { actor } = await resolveRequestActor(request);
    return libraryListJson(await knowledgeHandlers.listLibraries(actor));
  } catch (error) {
    return problem(error, instance);
  }
}

export async function POST(request: Request) {
  const instance = "/api/v1/libraries";
  try {
    const { actor } = await resolveRequestActor(request);
    const body = createLibraryCommandSchema.parse(await request.json());
    const command: CreateLibrary = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "knowledge.library.create",
      actor,
      idempotency: { key: parseIdempotencyKey(request), requestFingerprint: requestFingerprint(body) },
      sourceContext: {
        route: instance,
        surface: body.sourceContext.surface ?? "knowledge-overview",
        ...(body.sourceContext.clientId === undefined ? {} : { clientId: body.sourceContext.clientId }),
      },
      payload: {
        libraryId: parseRuntimeId(body.libraryId),
        name: body.name,
        ...(body.description === undefined ? {} : { description: body.description }),
      },
    };
    return mutationJson(await knowledgeHandlers.createLibrary(command));
  } catch (error) {
    return problem(error, instance);
  }
}
