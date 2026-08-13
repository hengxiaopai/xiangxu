import type { CreateTask } from "@xiangxu/application";
import { createTaskCommandSchema } from "@xiangxu/contracts";
import { parseRuntimeId, parseRuntimeInstant } from "@xiangxu/application";

import { taskHandlers } from "../../../../server/composition/runtime";
import { mutationJson, parseIdempotencyKey, problem, requestFingerprint, resolveRequestActor, taskListJson } from "../../../../server/http";

export async function GET(request: Request) {
  const instance = "/api/v1/tasks";
  try {
    const { actor } = await resolveRequestActor(request);
    return taskListJson(await taskHandlers.list(actor));
  } catch (error) {
    return problem(error, instance);
  }
}

export async function POST(request: Request) {
  const instance = "/api/v1/tasks";
  try {
    const { actor } = await resolveRequestActor(request);
    const body = createTaskCommandSchema.parse(await request.json());
    const command: CreateTask = {
      commandId: parseRuntimeId(body.commandId),
      commandType: "task.create",
      actor,
      idempotency: { key: parseIdempotencyKey(request), requestFingerprint: requestFingerprint(body) },
      sourceContext: { route: instance, surface: "dev-local" },
      payload: {
        taskId: parseRuntimeId(body.taskId),
        title: body.title,
        commitmentState: body.commitmentState,
        ...(body.dueAt === undefined ? {} : { dueAt: parseRuntimeInstant(body.dueAt) }),
        ...(body.dueOn === undefined ? {} : { dueOn: body.dueOn }),
      },
    };
    return mutationJson(await taskHandlers.create(command));
  } catch (error) {
    return problem(error, instance);
  }
}
