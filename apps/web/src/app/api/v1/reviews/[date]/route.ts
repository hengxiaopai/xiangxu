import { parseRuntimeTimezone } from "@xiangxu/application";
import { ianaTimeZoneSchema, localDateSchema } from "@xiangxu/contracts";

import { dailyLoopHandlers } from "../../../../../server/composition/runtime";
import { problem, resolveRequestActor, reviewSnapshotJson } from "../../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ date: string }> }) {
  const instance = new URL(request.url).pathname;
  try {
    const { actor } = await resolveRequestActor(request);
    const date = localDateSchema.parse((await context.params).date);
    const timezone = parseRuntimeTimezone(ianaTimeZoneSchema.parse(new URL(request.url).searchParams.get("timezone")));
    return reviewSnapshotJson(await dailyLoopHandlers.getReview(actor, date, timezone));
  } catch (error) {
    return problem(error, instance);
  }
}
