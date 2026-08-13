import type { Proposal } from "@xiangxu/domain";

import type { ProposalGeneratorInput, StructuredProposalGenerator } from "./ports.js";

export class ProposalGeneratorUnavailable extends Error {}

export class DeterministicStructuredProposalGenerator implements StructuredProposalGenerator {
  async generate(input: ProposalGeneratorInput): Promise<Proposal> {
    const title = input.rawText.trim().replace(/\s+/gu, " ");
    return {
      id: input.proposalId,
      proposalType: "create",
      targetRefs: [{ objectType: "capture_item", id: input.capture.id }],
      baseRevisions: [{
        targetRef: { objectType: "capture_item", id: input.capture.id },
        baseRevision: input.capture.revision,
      }],
      patch: {
        kind: "task.create",
        captureId: input.capture.id,
        task: { title, commitmentState: "someday" },
      },
      rationale: "The captured text is actionable and can become a Task after explicit confirmation.",
      evidenceRefs: [{ objectType: "capture_item", id: input.capture.id }],
      impactSummary: "Creates one Task and records the confirmed Capture materialization.",
      riskLevel: "low",
      status: "ready",
      createdBy: input.createdBy,
    };
  }
}

export class UnavailableProposalGenerator implements StructuredProposalGenerator {
  async generate(): Promise<never> {
    throw new ProposalGeneratorUnavailable("Deterministic proposal generation is unavailable");
  }
}
