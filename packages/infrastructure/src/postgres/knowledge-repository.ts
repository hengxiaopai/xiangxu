import type { KnowledgeRepository } from "@xiangxu/application";
import {
  UUIDv7,
  parseRfc3339Instant,
  type KnowledgeOverview,
  type Library,
} from "@xiangxu/domain";
import type { PoolClient } from "pg";

import { mapActorRef } from "./mapping.js";

interface LibraryRow {
  readonly id: string;
  readonly owner_id: string;
  readonly name: string;
  readonly description: string;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly created_by_type: string;
  readonly created_by_id: string;
  readonly created_at: Date;
  readonly archived_at: Date | null;
}

function mapLibraryRow(row: LibraryRow): Library {
  return {
    id: UUIDv7.parse(row.id),
    ownerId: UUIDv7.parse(row.owner_id),
    name: row.name,
    description: row.description,
    settings: Object.freeze({ ...row.settings }),
    createdAt: parseRfc3339Instant(row.created_at.toISOString()),
    createdBy: mapActorRef(row.created_by_type, row.created_by_id),
    ...(row.archived_at === null ? {} : { archivedAt: parseRfc3339Instant(row.archived_at.toISOString()) }),
  };
}

const librarySelection = `
  id::text, owner_id::text, name, description, settings,
  created_by_type, created_by_id::text, created_at, archived_at
`;

export class PgKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly client: PoolClient) {}

  async insertLibrary(library: Library): Promise<Library> {
    const result = await this.client.query<LibraryRow>(
      `INSERT INTO knowledge.libraries
       (id, owner_id, name, description, settings, created_by_type, created_by_id, created_at, archived_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
       RETURNING ${librarySelection}`,
      [
        library.id,
        library.ownerId,
        library.name,
        library.description,
        JSON.stringify(library.settings),
        library.createdBy.actorType,
        library.createdBy.actorId,
        library.createdAt,
        library.archivedAt ?? null,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error("Library insert did not return a row");
    return mapLibraryRow(row);
  }

  async listLibraries(ownerId: Library["ownerId"]): Promise<readonly Library[]> {
    const result = await this.client.query<LibraryRow>(
      `SELECT ${librarySelection}
         FROM knowledge.libraries
        WHERE owner_id = $1 AND archived_at IS NULL
        ORDER BY created_at DESC, id DESC`,
      [ownerId],
    );
    return result.rows.map(mapLibraryRow);
  }

  async getOverview(ownerId: Library["ownerId"]): Promise<KnowledgeOverview> {
    const libraries = await this.listLibraries(ownerId);
    return {
      metrics: { added: 0, unread: 0, reading: 0, settled: 0, longUnread: 0 },
      libraries,
    };
  }
}
