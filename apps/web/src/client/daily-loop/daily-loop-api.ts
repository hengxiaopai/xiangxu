import {
  mutationResultSchema,
  createLibraryCommandSchema,
  knowledgeOverviewDtoSchema,
  planSnapshotDtoSchema,
  problemDetailsSchema,
  proposalDtoSchema,
  reviewSnapshotDtoSchema,
  taskDtoSchema,
  type PlanSnapshotDto,
  type KnowledgeOverviewDto,
  type ProposalDto,
  type ReviewSnapshotDto,
  type TaskDto,
} from "@xiangxu/contracts";

export type MutationResult = ReturnType<typeof mutationResultSchema.parse>;

export class ApiProblemError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function problemFrom(response: Response): Promise<never> {
  const parsed = problemDetailsSchema.safeParse(await response.json());
  throw new ApiProblemError(
    response.status,
    parsed.success ? parsed.data.code : "INTERNAL_ERROR",
    parsed.success ? parsed.data.detail ?? parsed.data.title : "请求失败",
  );
}

export async function getTasks(): Promise<readonly TaskDto[]> {
  const response = await fetch("/api/v1/tasks", { credentials: "same-origin" });
  if (!response.ok) return problemFrom(response);
  return taskDtoSchema.array().parse(await response.json());
}

export async function getKnowledgeOverview(): Promise<KnowledgeOverviewDto> {
  const response = await fetch("/api/v1/knowledge/overview", { credentials: "same-origin" });
  if (!response.ok) return problemFrom(response);
  return knowledgeOverviewDtoSchema.parse(await response.json());
}

export async function createLibrary(input: {
  readonly libraryId: string;
  readonly name: string;
  readonly description?: string;
  readonly commandId: string;
}): Promise<MutationResult> {
  const body = createLibraryCommandSchema.parse({
    commandId: input.commandId,
    sourceContext: { route: "/app/knowledge", surface: "knowledge-overview" },
    libraryId: input.libraryId,
    name: input.name,
    ...(input.description === undefined ? {} : { description: input.description }),
  });
  const response = await fetch("/api/v1/libraries", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": input.commandId },
    body: JSON.stringify(body),
  });
  if (!response.ok) return problemFrom(response);
  return mutationResultSchema.parse(await response.json());
}

export async function getToday(date: string, timezone: string): Promise<PlanSnapshotDto | null> {
  const query = new URLSearchParams({ date, timezone });
  const response = await fetch(`/api/v1/today?${query}`, { credentials: "same-origin" });
  if (response.status === 404) return null;
  if (!response.ok) return problemFrom(response);
  return planSnapshotDtoSchema.parse(await response.json());
}

export async function commitDailyPlan(input: {
  readonly date: string;
  readonly timezone: string;
  readonly capacityMinutes: number;
  readonly taskIds: readonly string[];
  readonly planSnapshotId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
}): Promise<MutationResult> {
  const response = await fetch("/api/v1/plans/commit", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      commandId: input.commandId,
      sourceContext: { route: "/app/today", surface: "daily-plan" },
      planSnapshotId: input.planSnapshotId,
      date: input.date,
      timezone: input.timezone,
      capacityMinutes: input.capacityMinutes,
      taskIds: input.taskIds,
      timeBlockIds: [],
    }),
  });
  if (!response.ok) return problemFrom(response);
  return mutationResultSchema.parse(await response.json());
}

export async function getReview(date: string, timezone: string): Promise<ReviewSnapshotDto | null> {
  const query = new URLSearchParams({ timezone });
  const response = await fetch(`/api/v1/reviews/${date}?${query}`, { credentials: "same-origin" });
  if (response.status === 404) return null;
  if (!response.ok) return problemFrom(response);
  return reviewSnapshotDtoSchema.parse(await response.json());
}

export async function createDailyReview(input: {
  readonly date: string;
  readonly timezone: string;
  readonly baselinePlanSnapshotId: string;
  readonly finalPlanSnapshotId: string;
  readonly reviewSnapshotId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
}): Promise<MutationResult> {
  const response = await fetch("/api/v1/reviews", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      commandId: input.commandId,
      sourceContext: { route: "/app/review", surface: "daily-review" },
      reviewSnapshotId: input.reviewSnapshotId,
      date: input.date,
      timezone: input.timezone,
      baselinePlanSnapshotId: input.baselinePlanSnapshotId,
      finalPlanSnapshotId: input.finalPlanSnapshotId,
      executionRecordIds: [],
    }),
  });
  if (!response.ok) return problemFrom(response);
  return mutationResultSchema.parse(await response.json());
}

export async function getProposal(id: string): Promise<ProposalDto> {
  const response = await fetch(`/api/v1/proposals/${id}`, { credentials: "same-origin" });
  if (!response.ok) return problemFrom(response);
  return proposalDtoSchema.parse(await response.json());
}

export async function applyProposal(proposal: ProposalDto, commandId: string): Promise<MutationResult> {
  const response = await fetch(`/api/v1/proposals/${proposal.id}/apply`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "Idempotency-Key": commandId },
    body: JSON.stringify({
      commandId,
      sourceContext: { route: "/app/today", surface: "proposal" },
      targets: proposal.baseRevisions,
    }),
  });
  if (!response.ok) return problemFrom(response);
  return mutationResultSchema.parse(await response.json());
}
