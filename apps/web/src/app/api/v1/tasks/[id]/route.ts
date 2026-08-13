import { taskHandlers } from "../../../../../server/composition/runtime";
import { problem, resolveRequestActor, taskJson, uuidPath } from "../../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const instance = new URL(request.url).pathname;
  try {
    const { actor } = await resolveRequestActor(request);
    const { id } = await context.params;
    return taskJson(await taskHandlers.get(actor, uuidPath(id)));
  } catch (error) {
    return problem(error, instance);
  }
}
