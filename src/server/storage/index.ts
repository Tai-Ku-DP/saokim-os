import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

/**
 * StoragePort (ADR-005). PRD §24 còn để mở câu hỏi lưu tệp (app / Drive / hybrid),
 * nên mọi truy cập tệp đi qua port này; đổi nhà cung cấp không chạm domain.
 *
 * Key do tầng service sinh: `<projectId>/<fileId>/v<n>-<slug>`.
 * Driver `local` ghi vào `.data/uploads` (gitignore). Driver `s3`/`gdrive-link` bổ sung sau.
 */

export type StoredObject = {
  key: string;
  sizeBytes: number;
};

export interface StoragePort {
  put(key: string, data: Uint8Array): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

const ROOT = process.env.STORAGE_LOCAL_ROOT ?? ".data/uploads";

const localDriver: StoragePort = {
  async put(key, data) {
    const target = path.join(ROOT, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    return { key, sizeBytes: data.byteLength };
  },

  async get(key) {
    return fs.readFile(path.join(ROOT, key));
  },

  async remove(key) {
    await fs.rm(path.join(ROOT, key), { force: true });
  },
};

function selectDriver(): StoragePort {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver !== "local") {
    throw new Error(
      `STORAGE_DRIVER="${driver}" chưa triển khai. MVP dùng "local" (docs/01 §4).`,
    );
  }
  return localDriver;
}

export const storage: StoragePort = selectDriver();

/** Slug hoá tên tệp để key an toàn trên mọi hệ thống tệp. */
export function slugifyFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

export function buildStorageKey(projectId: string, fileId: string, versionNumber: number, fileName: string) {
  return `${projectId}/${fileId}/v${versionNumber}-${slugifyFileName(fileName)}`;
}
