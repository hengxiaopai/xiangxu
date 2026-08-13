import type {
  CaptureRepository,
  CaptureWithRawPayload,
  CasResult,
  ProposalRepository,
  RawPayloadRecord,
} from "@xiangxu/application";
import {
  Revision,
  UUIDv7,
  validateProposal,
  type CaptureItem,
  type ObjectRef,
  type Proposal,
  type ProposalPatch,
  type UUIDv7 as UUIDv7Value,
} from "@xiangxu/domain";
import type { PoolClient } from "pg";

interface CaptureRow {
  readonly id: string;
  readonly owner_id: string;
  readonly raw_payload_id: string;
  readonly raw_payload_kind?: string;
  readonly text_content?: string;
  readonly content_hash?: string;
  readonly parse_status: CaptureItem["parseStatus"];
  readonly triage_status: CaptureItem["triageStatus"];
  readonly revision: string;
  readonly proposal_id: string | null;
  readonly materialized_object_ids: string[];
}

interface ProposalRow {
  readonly id: string;
  readonly proposal_type: Proposal["proposalType"];
  readonly structured_patch: ProposalPatch;
  readonly rationale: string;
  readonly evidence_refs: ObjectRef[];
  readonly impact_summary: string;
  readonly risk_level: Proposal["riskLevel"];
  readonly status: Proposal["status"];
  readonly created_by_type: Proposal["createdBy"]["actorType"];
  readonly created_by_id: string;
}

interface ProposalTargetRow {
  readonly target_type: ObjectRef["objectType"];
  readonly target_id: string;
  readonly base_revision: string;
}

const captureSelect = `
  SELECT c.id, c.owner_id, c.raw_payload_id, c.parse_status, c.triage_status,
         c.revision::text, c.proposal_id, c.materialized_object_ids
    FROM capture.capture_items c`;

function mapCapture(row: CaptureRow): CaptureItem {
  return Object.freeze({
    id: UUIDv7.parse(row.id),
    ownerId: UUIDv7.parse(row.owner_id),
    rawPayloadRef: { id: UUIDv7.parse(row.raw_payload_id), kind: "text" as const },
    parseStatus: row.parse_status,
    triageStatus: row.triage_status,
    revision: Revision.parseBigInt(row.revision),
    ...(row.proposal_id === null ? {} : { proposalId: UUIDv7.parse(row.proposal_id) }),
    materializedObjectIds: Object.freeze(row.materialized_object_ids.map((id) => UUIDv7.parse(id))),
  });
}

export class PgCaptureRepository implements CaptureRepository {
  constructor(private readonly client: PoolClient) {}

  async insertRawPayload(payload: RawPayloadRecord): Promise<RawPayloadRecord> {
    const result = await this.client.query<{
      id: string; owner_id: string; kind: string; text_content: string; content_hash: string;
    }>(
      `INSERT INTO capture.raw_payloads (id, owner_id, kind, text_content, content_hash)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, owner_id, kind, text_content, content_hash`,
      [payload.id, payload.ownerId, payload.kind, payload.textContent, payload.contentHash],
    );
    const row = result.rows[0];
    if (row === undefined || row.kind !== "text") throw new Error("RawPayload insert did not return a text row");
    return {
      id: UUIDv7.parse(row.id), ownerId: UUIDv7.parse(row.owner_id), kind: "text",
      textContent: row.text_content, contentHash: row.content_hash,
    };
  }

  async insert(capture: CaptureItem): Promise<CaptureItem> {
    const result = await this.client.query<CaptureRow>(
      `INSERT INTO capture.capture_items
       (id, owner_id, raw_payload_id, parse_status, triage_status, revision, proposal_id, materialized_object_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, owner_id, raw_payload_id, parse_status, triage_status, revision::text,
                 proposal_id, materialized_object_ids`,
      [capture.id, capture.ownerId, capture.rawPayloadRef.id, capture.parseStatus, capture.triageStatus,
        capture.revision.toString(), capture.proposalId ?? null, [...capture.materializedObjectIds]],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Capture insert did not return a row");
    return mapCapture(row);
  }

  async getById(id: UUIDv7Value): Promise<CaptureItem | null> {
    const result = await this.client.query<CaptureRow>(`${captureSelect} WHERE c.id=$1`, [id]);
    const row = result.rows[0];
    return row === undefined ? null : mapCapture(row);
  }

  async getWithRawPayload(id: UUIDv7Value): Promise<CaptureWithRawPayload | null> {
    const result = await this.client.query<CaptureRow>(
      `SELECT c.id, c.owner_id, c.raw_payload_id, c.parse_status, c.triage_status,
              c.revision::text, c.proposal_id, c.materialized_object_ids,
              r.kind AS raw_payload_kind, r.text_content, r.content_hash
         FROM capture.capture_items c
         JOIN capture.raw_payloads r ON r.id=c.raw_payload_id
        WHERE c.id=$1`,
      [id],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    if (row.raw_payload_kind !== "text" || row.text_content === undefined || row.content_hash === undefined) {
      throw new Error("Capture RawPayload row is invalid");
    }
    const capture = mapCapture(row);
    return {
      capture,
      rawPayload: {
        id: capture.rawPayloadRef.id,
        ownerId: capture.ownerId,
        kind: "text",
        textContent: row.text_content,
        contentHash: row.content_hash,
      },
    };
  }

  async applyProposalCas(
    id: UUIDv7Value,
    baseRevision: Revision,
    proposalId: UUIDv7Value,
    materializedObjectId: UUIDv7Value,
  ): Promise<CasResult<CaptureItem>> {
    const result = await this.client.query<CaptureRow>(
      `UPDATE capture.capture_items
          SET triage_status='accepted', proposal_id=$3,
              materialized_object_ids=array_append(materialized_object_ids,$4),
              revision=revision+1, updated_at=now()
        WHERE id=$1 AND revision=$2 AND triage_status <> 'archived'
        RETURNING id, owner_id, raw_payload_id, parse_status, triage_status, revision::text,
                  proposal_id, materialized_object_ids`,
      [id, baseRevision.toString(), proposalId, materializedObjectId],
    );
    const row = result.rows[0];
    if (row === undefined) return { outcome: "conflict" };
    const value = mapCapture(row);
    return { outcome: "updated", value, newRevision: value.revision };
  }
}

export class PgProposalRepository implements ProposalRepository {
  constructor(private readonly client: PoolClient) {}

  async insert(proposal: Proposal): Promise<Proposal> {
    await this.client.query(
      `INSERT INTO ai.proposals
       (id, proposal_type, structured_patch, rationale, evidence_refs, impact_summary,
        risk_level, status, created_by_type, created_by_id)
       VALUES ($1,$2,$3::jsonb,$4,$5::jsonb,$6,$7,$8,$9,$10)`,
      [proposal.id, proposal.proposalType, JSON.stringify(proposal.patch), proposal.rationale,
        JSON.stringify(proposal.evidenceRefs), proposal.impactSummary, proposal.riskLevel,
        proposal.status, proposal.createdBy.actorType, proposal.createdBy.actorId],
    );
    for (const target of proposal.baseRevisions) {
      await this.client.query(
        `INSERT INTO ai.proposal_targets (proposal_id, target_type, target_id, base_revision)
         VALUES ($1,$2,$3,$4)`,
        [proposal.id, target.targetRef.objectType, target.targetRef.id, target.baseRevision.toString()],
      );
    }
    const inserted = await this.getById(proposal.id);
    if (inserted === null) throw new Error("Proposal insert could not be read back");
    return inserted;
  }

  async getById(id: UUIDv7Value): Promise<Proposal | null> {
    return this.read(id, false);
  }

  async getByIdForUpdate(id: UUIDv7Value): Promise<Proposal | null> {
    return this.read(id, true);
  }

  private async read(id: UUIDv7Value, forUpdate: boolean): Promise<Proposal | null> {
    const result = await this.client.query<ProposalRow>(
      `SELECT id, proposal_type, structured_patch, rationale, evidence_refs, impact_summary,
              risk_level, status, created_by_type, created_by_id
         FROM ai.proposals WHERE id=$1${forUpdate ? " FOR UPDATE" : ""}`,
      [id],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const targets = await this.client.query<ProposalTargetRow>(
      `SELECT target_type, target_id, base_revision::text
         FROM ai.proposal_targets WHERE proposal_id=$1 ORDER BY target_type,target_id`,
      [id],
    );
    const baseRevisions = targets.rows.map((target) => ({
      targetRef: { objectType: target.target_type, id: UUIDv7.parse(target.target_id) },
      baseRevision: Revision.parseBigInt(target.base_revision),
    }));
    return validateProposal({
      id: UUIDv7.parse(row.id),
      proposalType: row.proposal_type,
      targetRefs: baseRevisions.map(({ targetRef }) => targetRef),
      baseRevisions,
      patch: row.structured_patch,
      rationale: row.rationale,
      evidenceRefs: row.evidence_refs,
      impactSummary: row.impact_summary,
      riskLevel: row.risk_level,
      status: row.status,
      createdBy: { actorType: row.created_by_type, actorId: UUIDv7.parse(row.created_by_id) },
    });
  }

  async markApplied(id: UUIDv7Value): Promise<boolean> {
    const result = await this.client.query(
      `UPDATE ai.proposals SET status='applied' WHERE id=$1 AND status='ready'`,
      [id],
    );
    return result.rowCount === 1;
  }
}
