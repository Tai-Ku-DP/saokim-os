import "server-only";

/**
 * Đọc tệp từ FormData với giới hạn dung lượng rõ ràng (PRD §17).
 * Dùng chung cho mọi action upload để không có hai định nghĩa giới hạn.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export type UploadReadResult =
  | { ok: true; fileName: string; data: Uint8Array }
  | { ok: false; error: string };

export type MultiUploadReadResult =
  | { ok: true; files: { fileName: string; data: Uint8Array }[] }
  | { ok: false; error: string };

/**
 * Đọc NHIỀU tệp từ một input `multiple`.
 * Bỏ qua ô rỗng; chặn theo từng tệp và nói rõ tệp nào vượt giới hạn.
 */
export async function readUploads(
  formData: FormData,
  field = "files",
): Promise<MultiUploadReadResult> {
  const uploads = formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (uploads.length === 0) return { ok: false, error: "Chưa chọn tệp nào" };

  const files: { fileName: string; data: Uint8Array }[] = [];
  for (const upload of uploads) {
    if (upload.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: `Tệp "${upload.name}" vượt 25MB` };
    }
    files.push({ fileName: upload.name, data: new Uint8Array(await upload.arrayBuffer()) });
  }

  return { ok: true, files };
}

export async function readUpload(formData: FormData, field = "file"): Promise<UploadReadResult> {
  const upload = formData.get(field);

  if (!(upload instanceof File) || upload.size === 0) {
    return { ok: false, error: "Chọn tệp để tải lên" };
  }
  if (upload.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Tệp vượt 25MB. Nén lại hoặc gửi link" };
  }

  return {
    ok: true,
    fileName: upload.name,
    data: new Uint8Array(await upload.arrayBuffer()),
  };
}
