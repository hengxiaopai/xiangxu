import { parseRuntimeId, revisionFromDecimal, type CompleteTask } from "@xiangxu/application";
import { completeTaskCommandSchema, parseRequiredIfMatch } from "@xiangxu/contracts";

import { taskHandlers } from "../../../../../../server/composition/runtime";
import { HttpProblemError, mutationJson, parseIdempotencyKey, problem, requestFingerprint, resolveRequestActor, uuidPath } from "../../../../../../server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const instance = new URL(request.url).pathname;
  try {
    const { actor } = await resolveRequestActor(request);
    const parsedIfMatch = parseRequiredIfMatch(request.headers.get("If-Match") ?? undefined);
    if (parsedIfMatch.outcome === "rejected") {
      return problem(new HttpProblemError(parsedIfMatch.status, parsedIfMatch.code, parsedIfMatch.code === "PRECONDITION_REQUIRED" ? "If-Match is required" : "If-Match is malformed"), instance);
    }
    const body = completeTaskCommandSchema.parse(await request.json());
    const taskId = uuidPath((await context.params).id);
    const fingerprintValue = { taskId, body, baseRevision: parsedIfMatch.baseRevision };
    const command: CompleteTask = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "task.complete",
      actor,
      idempotency: { key: parseIdempotencyKey(request), requestFingerprint: requestFingerprint(fingerprintValue) },
      sourceContext: { route: instance, surface: "dev-local" },
      baseRevision: revisionFromDecimal(parsedIfMatch.baseRevision),
      payload: { taskId },
    };
    return mutationJson(await taskHandlers.complete(command));
  } catch (error) {
    return problem(error, instance);
  }
}
