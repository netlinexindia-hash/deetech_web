import type { MediaItem, Paginated } from "@deetech/shared-types";
import type { DbPool } from "../db/pool.js";

interface MediaRow {
  id: number;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string;
  created_at: Date;
}

/** `storage_path` is where the bytes live; `url` is how the browser gets them. */
function toItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    fileName: row.file_name,
    url: `/media/${row.storage_path}`,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    width: row.width,
    height: row.height,
    altText: row.alt_text,
    createdAt: row.created_at.toISOString(),
  };
}

export class MediaRepository {
  constructor(private readonly pool: DbPool) {}

  async create(input: {
    fileName: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    altText: string;
    uploadedBy: number | null;
  }): Promise<MediaItem> {
    const { rows } = await this.pool.query<MediaRow>(
      `INSERT INTO media
         (file_name, storage_path, mime_type, size_bytes, width, height, alt_text, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.fileName,
        input.storagePath,
        input.mimeType,
        input.sizeBytes,
        input.width,
        input.height,
        input.altText,
        input.uploadedBy,
      ],
    );
    return toItem(rows[0]!);
  }

  async list(page: number, perPage: number): Promise<Paginated<MediaItem>> {
    const offset = (page - 1) * perPage;
    const { rows } = await this.pool.query<MediaRow & { total_count: string }>(
      `SELECT *, count(*) OVER () AS total_count
         FROM media ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [perPage, offset],
    );
    const total = rows[0] ? Number(rows[0].total_count) : 0;
    return {
      items: rows.map(toItem),
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  }

  async findById(id: number): Promise<MediaItem | null> {
    const { rows } = await this.pool.query<MediaRow>(
      `SELECT * FROM media WHERE id = $1`,
      [id],
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  async updateAltText(id: number, altText: string): Promise<MediaItem | null> {
    const { rows } = await this.pool.query<MediaRow>(
      `UPDATE media SET alt_text = $2 WHERE id = $1 RETURNING *`,
      [id, altText],
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  async remove(id: number): Promise<MediaItem | null> {
    const { rows } = await this.pool.query<MediaRow>(
      `DELETE FROM media WHERE id = $1 RETURNING *`,
      [id],
    );
    return rows[0] ? toItem(rows[0]) : null;
  }
}
