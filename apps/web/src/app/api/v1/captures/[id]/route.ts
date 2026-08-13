import { captureHandlers } from "../../../../../server/composition/runtime";
import { captureJson, problem, resolveRequestActor, uuidPath } from "../../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const instance = new URL(request.url).pathname;
  try {
    const { actor } = await resolveRequestActor(request);
    return captureJson(await captureHandlers.get(actor, uuidPath((await context.params).id)));
  } catch (error) {
    return problem(error, instance);
  }
}
