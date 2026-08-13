import type { CasResult, InsertTaskInput, TaskCasPatch, TaskRepository } from "@xiangxu/application";
import type { Revision, Task, UUIDv7 } from "@xiangxu/domain";
import type { PoolClient } from "pg";

import { mapTaskRow, type TaskRow } from "./mapping.js";

const taskSelect = `
  SELECT o.id, o.title, o.owner_id, o.status, o.revision, o.created_at, o.updated_at,
         o.created_by_type, o.created_by_id, o.updated_by_type, o.updated_by_id,
         d.commitment_state, d.due_on::text, d.due_at, d.completed_at
  FROM core.objects o
  JOIN core.task_details d ON d.object_id = o.id`;

export class PgTaskRepository implements TaskRepository {
  constructor(private readonly client: PoolClient) {}

  async insert({ task }: InsertTaskInput): Promise<Task> {
    await this.client.query(
      `INSERT INTO core.objects
       (id, object_type, title, owner_id, status, revision, created_by_type, created_by_id,
        updated_by_type, updated_by_id, created_at, updated_at)
       VALUES ($1, 'task', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [task.id, task.title, task.ownerId, task.status, task.revision.toString(), task.createdBy.actorType, task.createdBy.actorId,
        task.updatedBy.actorType, task.updatedBy.actorId, task.createdAt, task.updatedAt],
    );
    await this.client.query(
      `INSERT INTO core.task_details (object_id, commitment_state, due_on, due_at, completed_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [task.id, task.commitmentState, task.dueOn ?? null, task.dueAt ?? null, task.completedAt ?? null],
    );
    const inserted = await this.getById(task.id);
    if (inserted === null) throw new Error("Inserted Task could not be read back");
    return inserted;
  }

  async getById(id: UUIDv7): Promise<Task | null> {
    const result = await this.client.query<TaskRow>(`${taskSelect} WHERE o.id = $1 AND o.deleted_at IS NULL`, [id]);
    return result.rows[0] === undefined ? null : mapTaskRow(result.rows[0]);
  }

  async listByOwner(ownerId: UUIDv7): Promise<readonly Task[]> {
    const result = await this.client.query<TaskRow>(
      `${taskSelect} WHERE o.owner_id=$1 AND o.deleted_at IS NULL ORDER BY o.created_at, o.id`,
      [ownerId],
    );
    return result.rows.map(mapTaskRow);
  }

  async updateCas(id: UUIDv7, baseRevision: Revision, patch: TaskCasPatch): Promise<CasResult<Task>> {
    const result = await this.client.query<TaskRow>(
      `WITH updated_object AS (
         UPDATE core.objects
            SET status = $3, updated_at = $4, updated_by_type = $5, updated_by_id = $6,
                revision = revision + 1
          WHERE id = $1 AND revision = $2 AND deleted_at IS NULL
          RETURNING *
       ), updated_detail AS (
         UPDATE core.task_details d SET completed_at = $7
           FROM updated_object o WHERE d.object_id = o.id
         RETURNING d.*
       )
       SELECT o.id, o.title, o.owner_id, o.status, o.revision, o.created_at, o.updated_at,
              o.created_by_type, o.created_by_id, o.updated_by_type, o.updated_by_id,
              d.commitment_state, d.due_on::text, d.due_at, d.completed_at
         FROM updated_object o JOIN updated_detail d ON d.object_id = o.id`,
      [id, baseRevision.toString(), patch.status, patch.updatedAt, patch.updatedBy.actorType, patch.updatedBy.actorId, patch.completedAt ?? null],
    );
    const row = result.rows[0];
    if (row === undefined) return { outcome: "conflict" };
    const value = mapTaskRow(row);
    return { outcome: "updated", value, newRevision: value.revision };
  }
}
