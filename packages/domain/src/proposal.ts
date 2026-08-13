import { Revision, UUIDv7, type ActorRef, type ObjectRef, type Revision as RevisionValue, type UUIDv7 as UUIDv7Value } from "./identity.js";
import type { CommitmentState } from "./task.js";

export type ProposalType =
  | "classify"
  | "reprioritize"
  | "reschedule"
  | "relate"
  | "create"
  | "update"
  | "memory"
  | "review_suggestion";
export type ProposalRiskLevel = "low" | "medium" | "high";
export type ProposalStatus = "draft" | "ready" | "applied" | "rejected" | "expired" | "cancelled";

export interface ProposalTarget {
  readonly targetRef: ObjectRef;
  readonly baseRevision: RevisionValue;
}

export interface ClassifyCapturePatch {
  readonly kind: "capture.classify";
  readonly captureId: UUIDv7Value;
  readonly candidateType: "task";
}

export interface CreateTaskFromCapturePatch {
  readonly kind: "task.create";
  readonly captureId: UUIDv7Value;
  readonly task: {
    readonly title: string;
    readonly commitmentState: CommitmentState;
    readonly dueAt?: string;
    readonly dueOn?: string;
  };
}

export type ProposalPatch = ClassifyCapturePatch | CreateTaskFromCapturePatch;

export interface Proposal {
  readonly id: UUIDv7Value;
  readonly proposalType: ProposalType;
  readonly targetRefs: readonly ObjectRef[];
  readonly baseRevisions: readonly ProposalTarget[];
  readonly patch: ProposalPatch;
  readonly rationale: string;
  readonly evidenceRefs: readonly ObjectRef[];
  readonly impactSummary: string;
  readonly riskLevel: ProposalRiskLevel;
  readonly status: ProposalStatus;
  readonly createdBy: ActorRef;
}

const proposalTypes = new Set<ProposalType>(["classify", "reprioritize", "reschedule", "relate", "create", "update", "memory", "review_suggestion"]);
const proposalStatuses = new Set<ProposalStatus>(["draft", "ready", "applied", "rejected", "expired", "cancelled"]);
const proposalRisks = new Set<ProposalRiskLevel>(["low", "medium", "high"]);
const objectTypes = new Set(["task", "time_block", "capture_item", "raw_payload", "proposal", "plan_snapshot", "execution_record", "review_snapshot", "change_record"]);
const actorTypes = new Set(["user", "system", "ai", "connector"]);

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Proposal must be an object");
  return value as Record<string, unknown>;
}

function exactKeys(candidate: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Object.keys(candidate).some((key) => !allowed.includes(key))) throw new Error(`${label} contains an unknown field`);
}

function objectRef(value: unknown): ObjectRef {
  const candidate = record(value);
  exactKeys(candidate, ["objectType", "id"], "Proposal ObjectRef");
  if (typeof candidate.objectType !== "string" || !objectTypes.has(candidate.objectType)) throw new Error("Proposal ObjectRef type is invalid");
  if (typeof candidate.id !== "string") throw new Error("Proposal ObjectRef ID is required");
  return { objectType: candidate.objectType as ObjectRef["objectType"], id: UUIDv7.parse(candidate.id) };
}

function actorRef(value: unknown): ActorRef {
  const candidate = record(value);
  exactKeys(candidate, ["actorType", "actorId"], "Proposal ActorRef");
  if (typeof candidate.actorType !== "string" || !actorTypes.has(candidate.actorType)) throw new Error("Proposal ActorRef type is invalid");
  if (typeof candidate.actorId !== "string") throw new Error("Proposal ActorRef ID is required");
  return { actorType: candidate.actorType as ActorRef["actorType"], actorId: UUIDv7.parse(candidate.actorId) };
}

function proposalPatch(value: unknown): ProposalPatch {
  const candidate = record(value);
  if (candidate.kind === "capture.classify") {
    exactKeys(candidate, ["kind", "captureId", "candidateType"], "Classification patch");
    if (typeof candidate.captureId !== "string" || candidate.candidateType !== "task") throw new Error("Classification patch is invalid");
    return { kind: "capture.classify", captureId: UUIDv7.parse(candidate.captureId), candidateType: "task" };
  }
  if (candidate.kind !== "task.create" || typeof candidate.captureId !== "string") throw new Error("Proposal patch is invalid");
  exactKeys(candidate, ["kind", "captureId", "task"], "Task creation patch");
  const task = record(candidate.task);
  exactKeys(task, ["title", "commitmentState", "dueAt", "dueOn"], "Task creation payload");
  if (typeof task.title !== "string" || task.title.trim().length === 0) throw new Error("Task patch title is required");
  if (task.commitmentState !== "committed" && task.commitmentState !== "someday") throw new Error("Task patch commitment is invalid");
  if (task.dueAt !== undefined && typeof task.dueAt !== "string") throw new Error("Task patch dueAt is invalid");
  if (task.dueOn !== undefined && typeof task.dueOn !== "string") throw new Error("Task patch dueOn is invalid");
  if (task.dueAt !== undefined && task.dueOn !== undefined) throw new Error("Task patch cannot contain both dueAt and dueOn");
  return {
    kind: "task.create",
    captureId: UUIDv7.parse(candidate.captureId),
    task: {
      title: task.title,
      commitmentState: task.commitmentState,
      ...(task.dueAt === undefined ? {} : { dueAt: task.dueAt }),
      ...(task.dueOn === undefined ? {} : { dueOn: task.dueOn }),
    },
  };
}

export function validateProposal(value: unknown): Proposal {
  const candidate = record(value);
  exactKeys(candidate, [
    "id", "proposalType", "targetRefs", "baseRevisions", "patch", "rationale",
    "evidenceRefs", "impactSummary", "riskLevel", "status", "createdBy",
  ], "Proposal");
  if (typeof candidate.id !== "string") throw new Error("Proposal ID is required");
  if (typeof candidate.proposalType !== "string" || !proposalTypes.has(candidate.proposalType as ProposalType)) throw new Error("Proposal type is invalid");
  if (!Array.isArray(candidate.targetRefs) || !Array.isArray(candidate.baseRevisions)) throw new Error("Proposal targets are required");
  if (!Array.isArray(candidate.evidenceRefs)) throw new Error("Proposal evidence refs are required");
  if (typeof candidate.rationale !== "string" || candidate.rationale.length === 0) throw new Error("Proposal rationale is required");
  if (typeof candidate.impactSummary !== "string" || candidate.impactSummary.length === 0) throw new Error("Proposal impact is required");
  if (typeof candidate.riskLevel !== "string" || !proposalRisks.has(candidate.riskLevel as ProposalRiskLevel)) throw new Error("Proposal risk is invalid");
  if (typeof candidate.status !== "string" || !proposalStatuses.has(candidate.status as ProposalStatus)) throw new Error("Proposal status is invalid");
  const targetRefs = candidate.targetRefs.map(objectRef);
  const baseRevisions = candidate.baseRevisions.map((entry) => {
    const target = record(entry);
    exactKeys(target, ["targetRef", "baseRevision"], "Proposal target revision");
    if (typeof target.baseRevision !== "bigint") throw new Error("Proposal base revision is invalid");
    return { targetRef: objectRef(target.targetRef), baseRevision: Revision.parseBigInt(target.baseRevision) };
  });
  const patch = proposalPatch(candidate.patch);
  const proposal: Proposal = {
    id: UUIDv7.parse(candidate.id),
    proposalType: candidate.proposalType as ProposalType,
    targetRefs,
    baseRevisions,
    patch,
    rationale: candidate.rationale,
    evidenceRefs: candidate.evidenceRefs.map(objectRef),
    impactSummary: candidate.impactSummary,
    riskLevel: candidate.riskLevel as ProposalRiskLevel,
    status: candidate.status as ProposalStatus,
    createdBy: actorRef(candidate.createdBy),
  };
  if (proposal.targetRefs.length === 0 || proposal.baseRevisions.length === 0) {
    throw new Error("Proposal requires target refs and base revisions");
  }
  if (proposal.patch.kind === "capture.classify" && proposal.proposalType !== "classify") {
    throw new Error("Classification patch requires classify proposal type");
  }
  if (proposal.patch.kind === "task.create" && proposal.proposalType !== "create") {
    throw new Error("Task creation patch requires create proposal type");
  }
  const targetKeys = proposal.targetRefs.map((target) => `${target.objectType}:${target.id}`);
  const baseKeys = proposal.baseRevisions.map(({ targetRef }) => `${targetRef.objectType}:${targetRef.id}`);
  if (new Set(targetKeys).size !== targetKeys.length || new Set(baseKeys).size !== baseKeys.length) throw new Error("Proposal targets must be unique");
  if (targetKeys.length !== baseKeys.length || targetKeys.some((key) => !baseKeys.includes(key))) throw new Error("Proposal targets and base revisions must match");
  if (!targetKeys.includes(`capture_item:${proposal.patch.captureId}`)) throw new Error("Proposal patch Capture must be a target");
  return Object.freeze(value as Proposal);
}

export function isProposalStale(
  proposal: Proposal,
  currentRevisions: ReadonlyMap<string, RevisionValue>,
): boolean {
  return proposal.baseRevisions.some(({ targetRef, baseRevision }) => {
    const current = currentRevisions.get(`${targetRef.objectType}:${targetRef.id}`);
    return current === undefined || !Revision.equals(baseRevision, current);
  });
}

export function markProposalApplied(proposal: Proposal): Proposal {
  if (proposal.status !== "ready") throw new Error("Only a ready Proposal can be applied");
  return Object.freeze({ ...proposal, status: "applied" as const });
}
