import "server-only";

/**
 * Đọc tệp từ FormData với giới hạn dung lượng rõ ràng (PRD §17).
 * Dùng chung cho mọi action upload để không có hai định nghĩa giới hạn.
 */

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export type UploadReadResult =
  | { ok: true; fileName: string; data: Uint8Array }
  | { ok: false; error: string };

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
