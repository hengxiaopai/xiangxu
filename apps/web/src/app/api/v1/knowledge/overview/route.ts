import { knowledgeHandlers } from "../../../../../server/composition/runtime";
import { knowledgeOverviewJson, problem, resolveRequestActor } from "../../../../../server/http";

export async function GET(request: Request) {
  const instance = "/api/v1/knowledge/overview";
  try {
    const { actor } = await resolveRequestActor(request);
    return knowledgeOverviewJson(await knowledgeHandlers.getOverview(actor));
  } catch (error) {
    return problem(error, instance);
  }
}
