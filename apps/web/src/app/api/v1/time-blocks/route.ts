import {
  parseRuntimeId,
  parseRuntimeInstant,
  parseRuntimeTimezone,
  type CreateTimeBlock,
} from "@xiangxu/application";
import { createTimeBlockCommandSchema } from "@xiangxu/contracts";

import { timeBlockHandlers } from "../../../../server/composition/runtime";
import {
  mutationJson,
  parseIdempotencyKey,
  problem,
  requestFingerprint,
  resolveRequestActor,
} from "../../../../server/http";

export async function POST(request: Request) {
  const instance = "/api/v1/time-blocks";
  try {
    const { actor } = await resolveRequestActor(request);
    const body = createTimeBlockCommandSchema.parse(await request.json());
    const command: CreateTimeBlock = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "timeblock.create",
      actor,
      idempotency: { key: parseIdempotencyKey(request), requestFingerprint: requestFingerprint(body) },
      sourceContext: { route: instance, surface: "dev-local" },
      payload: {
        timeBlockId: parseRuntimeId(body.timeBlockId),
        taskId: parseRuntimeId(body.taskId),
        startAt: parseRuntimeInstant(body.startAt),
        endAt: parseRuntimeInstant(body.endAt),
        timezone: parseRuntimeTimezone(body.timezone),
        locked: body.locked,
      },
    };
    return mutationJson(await timeBlockHandlers.create(command));
  } catch (error) {
    return problem(error, instance);
  }
}
