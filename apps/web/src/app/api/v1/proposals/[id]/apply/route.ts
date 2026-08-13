import { parseRuntimeId, revisionFromDecimal, type ApplyProposal } from "@xiangxu/application";
import { applyProposalCommandSchema } from "@xiangxu/contracts";

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
    const { actor } = await resolveRequestActor(request);
    const body = applyProposalCommandSchema.parse(await request.json());
    const proposalId = uuidPath((await context.params).id);
    const command: ApplyProposal = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "proposal.apply",
      actor,
      idempotency: {
        key: parseIdempotencyKey(request),
        requestFingerprint: requestFingerprint({ proposalId, body }),
      },
      sourceContext: { route: instance, surface: "dev-local" },
      payload: {
        proposalId,
        targets: body.targets.map(({ targetRef, baseRevision }) => ({
          ref: { objectType: targetRef.objectType, id: parseRuntimeId(targetRef.id) },
          baseRevision: revisionFromDecimal(baseRevision),
        })),
      },
    };
    return mutationJson(await proposalHandlers.apply(command));
  } catch (error) {
    return problem(error, instance);
  }
}
