import {
  parseRuntimeId,
  parseRuntimeTimezone,
  type CommitDailyPlan,
} from "@xiangxu/application";
import { commitDailyPlanCommandSchema } from "@xiangxu/contracts";

import { dailyLoopHandlers } from "../../../../../server/composition/runtime";
import {
  mutationJson,
  parseIdempotencyKey,
  problem,
  requestFingerprint,
  resolveRequestActor,
} from "../../../../../server/http";

export async function POST(request: Request) {
  const instance = "/api/v1/plans/commit";
  try {
    const { actor } = await resolveRequestActor(request);
    const body = commitDailyPlanCommandSchema.parse(await request.json());
    const command: CommitDailyPlan = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "plan.commit-daily",
      actor,
      idempotency: { key: parseIdempotencyKey(request), requestFingerprint: requestFingerprint(body) },
      sourceContext: { route: instance, surface: "daily-loop" },
      payload: {
        planSnapshotId: parseRuntimeId(body.planSnapshotId),
        date: body.date,
        timezone: parseRuntimeTimezone(body.timezone),
        capacityMinutes: body.capacityMinutes,
        taskIds: body.taskIds.map(parseRuntimeId),
        timeBlockIds: body.timeBlockIds.map(parseRuntimeId),
      },
    };
    return mutationJson(await dailyLoopHandlers.commitPlan(command));
  } catch (error) {
    return problem(error, instance);
  }
}
