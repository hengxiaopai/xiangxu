import { parseRuntimeId, type GenerateStructuredTriageProposal } from "@xiangxu/application";
import { generateStructuredTriageProposalCommandSchema } from "@xiangxu/contracts";

import { proposalHandlers } from "../../../../../../server/composition/runtime";
import {
  mutationJson,
  parseIdempotencyKey,
  problem,
  requestFingerprint,
  resolveRequestActor,
  uuidPath,
} from "../../../../../../server/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const instance = new URL(request.url).pathname;
  try {
    const { actor: userActor } = await resolveRequestActor(request);
    const body = generateStructuredTriageProposalCommandSchema.parse(await request.json());
    const captureId = uuidPath((await context.params).id);
    const command: GenerateStructuredTriageProposal = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "proposal.generate-structured-triage",
      actor: { actorType: "system", actorId: userActor.actorId },
      idempotency: {
        key: parseIdempotencyKey(request),
        requestFingerprint: requestFingerprint({ captureId, body }),
      },
      sourceContext: { route: instance, surface: "dev-local-worker-trigger" },
      payload: { captureId },
    };
    return mutationJson(await proposalHandlers.generate(command));
  } catch (error) {
    return problem(error, instance);
  }
}
