import { parseRuntimeId, type CreateCapture } from "@xiangxu/application";
import { createCaptureCommandSchema } from "@xiangxu/contracts";

import { captureHandlers, hashTextContent } from "../../../../server/composition/runtime";
import {
  mutationJson,
  parseIdempotencyKey,
  problem,
  requestFingerprint,
  resolveRequestActor,
} from "../../../../server/http";

export async function POST(request: Request) {
  const instance = "/api/v1/captures";
  try {
    const { actor } = await resolveRequestActor(request);
    const body = createCaptureCommandSchema.parse(await request.json());
    const command: CreateCapture = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "capture.create",
      actor,
      idempotency: { key: parseIdempotencyKey(request), requestFingerprint: requestFingerprint(body) },
      sourceContext: { route: instance, surface: "dev-local" },
      payload: {
        captureId: parseRuntimeId(body.captureId),
        rawPayloadId: parseRuntimeId(body.rawPayload.id),
        rawPayloadKind: body.rawPayload.kind,
      },
    };
    return mutationJson(await captureHandlers.create(command, {
      text: body.rawPayload.text,
      contentHash: hashTextContent(body.rawPayload.text),
    }));
  } catch (error) {
    return problem(error, instance);
  }
}
