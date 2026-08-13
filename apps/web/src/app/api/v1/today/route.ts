import { parseRuntimeTimezone } from "@xiangxu/application";
import { ianaTimeZoneSchema, localDateSchema } from "@xiangxu/contracts";

import { dailyLoopHandlers } from "../../../../server/composition/runtime";
import { planSnapshotJson, problem, resolveRequestActor } from "../../../../server/http";

export async function GET(request: Request) {
  const instance = "/api/v1/today";
  try {
    const { actor } = await resolveRequestActor(request);
    const url = new URL(request.url);
    const date = localDateSchema.parse(url.searchParams.get("date"));
    const timezone = parseRuntimeTimezone(ianaTimeZoneSchema.parse(url.searchParams.get("timezone")));
    return planSnapshotJson(await dailyLoopHandlers.getToday(actor, date, timezone));
  } catch (error) {
    return problem(error, instance);
  }
}
