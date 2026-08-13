import {
  parseRuntimeId,
  parseRuntimeTimezone,
  type CreateReviewSnapshot,
} from "@xiangxu/application";
import { createReviewSnapshotCommandSchema } from "@xiangxu/contracts";

import { dailyLoopHandlers } from "../../../../server/composition/runtime";
import {
  mutationJson,
  parseIdempotencyKey,
  problem,
  requestFingerprint,
  resolveRequestActor,
} from "../../../../server/http";

export async function POST(request: Request) {
  const instance = "/api/v1/reviews";
  try {
    const { actor } = await resolveRequestActor(request);
    const body = createReviewSnapshotCommandSchema.parse(await request.json());
    const command: CreateReviewSnapshot = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "review.create-snapshot",
      actor,
      idempotency: { key: parseIdempotencyKey(request), requestFingerprint: requestFingerprint(body) },
      sourceContext: { route: instance, surface: "daily-loop" },
      payload: {
        reviewSnapshotId: parseRuntimeId(body.reviewSnapshotId),
        date: body.date,
        timezone: parseRuntimeTimezone(body.timezone),
        baselinePlanSnapshotId: parseRuntimeId(body.baselinePlanSnapshotId),
        finalPlanSnapshotId: parseRuntimeId(body.finalPlanSnapshotId),
        executionRecordIds: body.executionRecordIds.map(parseRuntimeId),
      },
    };
    return mutationJson(await dailyLoopHandlers.createReview(command));
  } catch (error) {
    return problem(error, instance);
  }
}
