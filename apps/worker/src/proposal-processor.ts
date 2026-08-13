export interface ProposalGenerationJobIntent {
  readonly outboxEventId: string;
  readonly outboxSequence: string;
  readonly captureId: string;
  readonly commandId: string;
  readonly correlationId: string;
}

export interface ProposalGenerationApplication {
  generate(intent: ProposalGenerationJobIntent): Promise<unknown>;
}

export class ProposalGenerationProcessor {
  constructor(private readonly application: ProposalGenerationApplication) {}

  async process(intent: ProposalGenerationJobIntent): Promise<unknown> {
    const values = [intent.outboxEventId, intent.outboxSequence, intent.captureId, intent.commandId, intent.correlationId];
    if (values.some((value) => typeof value !== "string" || value.length === 0)) {
      throw new Error("Proposal generation job intent is incomplete");
    }
    if (!/^[1-9][0-9]*$/.test(intent.outboxSequence)) {
      throw new Error("Proposal generation Outbox sequence must be a positive decimal bigint");
    }
    return this.application.generate(intent);
  }
}
