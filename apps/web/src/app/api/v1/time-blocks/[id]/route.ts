import {
  parseRuntimeId,
  parseRuntimeInstant,
  parseRuntimeTimezone,
  revisionFromDecimal,
  type MoveTimeBlock,
} from "@xiangxu/application";
import { moveTimeBlockCommandSchema, parseRequiredIfMatch } from "@xiangxu/contracts";

import { timeBlockHandlers } from "../../../../../server/composition/runtime";
import {
  HttpProblemError,
  mutationJson,
  parseIdempotencyKey,
  problem,
  requestFingerprint,
  resolveRequestActor,
  uuidPath,
} from "../../../../../server/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const instance = new URL(request.url).pathname;
  try {
    const { actor } = await resolveRequestActor(request);
    const parsedIfMatch = parseRequiredIfMatch(request.headers.get("If-Match") ?? undefined);
    if (parsedIfMatch.outcome === "rejected") {
      return problem(
        new HttpProblemError(
          parsedIfMatch.status,
          parsedIfMatch.code,
          parsedIfMatch.code === "PRECONDITION_REQUIRED" ? "If-Match is required" : "If-Match is malformed",
        ),
        instance,
      );
    }
    const body = moveTimeBlockCommandSchema.parse(await request.json());
    const timeBlockId = uuidPath((await context.params).id);
    const fingerprintValue = { timeBlockId, body, baseRevision: parsedIfMatch.baseRevision };
    const command: MoveTimeBlock = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "timeblock.move",
      actor,
      idempotency: { key: parseIdempotencyKey(request), requestFingerprint: requestFingerprint(fingerprintValue) },
      sourceContext: { route: instance, surface: "dev-local" },
      baseRevision: revisionFromDecimal(parsedIfMatch.baseRevision),
      payload: {
        timeBlockId,
        startAt: parseRuntimeInstant(body.startAt),
        endAt: parseRuntimeInstant(body.endAt),
        timezone: parseRuntimeTimezone(body.timezone),
      },
    };
    return mutationJson(await timeBlockHandlers.move(command));
  } catch (error) {
    return problem(error, instance);
  }
}
