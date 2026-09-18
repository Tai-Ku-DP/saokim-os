import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, readUpload, readUploads } from "@/server/upload";

/**
 * Quy tắc đọc tệp upload — tách khỏi Server Action để test được không cần session.
 * Đây là chỗ từng gây hiểu nhầm: input nhiều tệp rỗng vẫn gửi lên, phải bỏ qua.
 */

function formDataWith(field: string, files: File[]): FormData {
  const fd = new FormData();
  for (const file of files) fd.append(field, file);
  return fd;
}

const pdf = (name: string, bytes = 100) =>
  new File([new Uint8Array(bytes)], name, { type: "application/pdf" });

describe("readUploads — nhiều tệp", () => {
  it("trả về danh sách tệp kèm tên và nội dung", async () => {
    const fd = formDataWith("files", [pdf("a.pdf", 10), pdf("b.pdf", 20)]);
    const result = await readUploads(fd);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files.map((f) => f.fileName)).toEqual(["a.pdf", "b.pdf"]);
    expect(result.files[0]?.data.byteLength).toBe(10);
  });

  it("input rỗng hoặc không có tệp → báo lỗi rõ ràng (không tạo bản ghi rác)", async () => {
    expect((await readUploads(new FormData())).ok).toBe(false);

    const empty = formDataWith("files", [new File([], "rong.pdf")]);
    const result = await readUploads(empty);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Chưa chọn tệp nào");
  });

  it("bỏ qua ô rỗng nhưng vẫn nhận tệp có nội dung", async () => {
    const fd = formDataWith("files", [new File([], "rong.pdf"), pdf("that.pdf", 5)]);
    const result = await readUploads(fd);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files).toHaveLength(1);
  });

  it("tệp vượt 25MB bị chặn và nói rõ tệp nào", async () => {
    const big = pdf("qua-to.pdf", MAX_UPLOAD_BYTES + 1);
    const result = await readUploads(formDataWith("files", [big]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("qua-to.pdf");
      expect(result.error).toContain("25MB");
    }
  });

  it("đúng 25MB vẫn cho qua (biên)", async () => {
    const result = await readUploads(formDataWith("files", [pdf("vua-du.pdf", MAX_UPLOAD_BYTES)]));
    expect(result.ok).toBe(true);
  });
});

describe("readUpload — một tệp (dùng cho phiên bản tệp dự án)", () => {
  it("đọc được một tệp", async () => {
    const result = await readUpload(formDataWith("file", [pdf("logo.pdf", 7)]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fileName).toBe("logo.pdf");
  });

  it("thiếu tệp → lỗi", async () => {
    const result = await readUpload(new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Chọn tệp để tải lên");
  });
});
