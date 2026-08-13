import { proposalHandlers } from "../../../../../server/composition/runtime";
import { problem, proposalJson, resolveRequestActor, uuidPath } from "../../../../../server/http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const instance = new URL(request.url).pathname;
  try {
    const { actor } = await resolveRequestActor(request);
    return proposalJson(await proposalHandlers.get(actor, uuidPath((await context.params).id)));
  } catch (error) {
    return problem(error, instance);
  }
}
