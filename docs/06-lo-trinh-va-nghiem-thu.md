# 06 — Lộ trình, migration & nghiệm thu

## 0. Trạng thái triển khai (cập nhật cuối)

| Phase | Nội dung | Trạng thái | Bằng chứng |
|---|---|---|---|
| P0 | Nền tảng Next 16 + Tailwind 4 + shadcn, pin version | ✅ | build pass, 22 route |
| P1 | Design token + app shell + ⌘K + light/dark | ✅ | smoke test 2 vai trò |
| P2 | 39 bảng Drizzle + migration + seed + better-auth + RBAC 2 tầng | ✅ | 32 test (ma trận quyền + isolation) |
| P3 | Today · Projects · File review · Approvals · Handover | ✅ | 12 test bất biến + smoke HTTP |
| P4 | Onboarding hub (template 8 loại dự án + cổng kickoff) | ✅ | 12 test (AC-ONB-001→005) |
| P5 | AI gateway + generative UI + 8 tool đọc + 3 tool ghi có xác nhận | ✅ | 29 test + smoke HTTP (stream, cap, 401) |
| P6 | Growth + Retaining (Brand Home) | ✅ | 10 test (AC-GRO/RET) |
| P7 | Outbox worker + notification + n8n + Inbox/Clients/Reports | ✅ | 7 test outbox (retry/backoff/idempotency) + smoke |
| P8 | Hardening, a11y, docs, artifacts Postgres | ✅ | 99 test tổng; `pg:dry-run` đếm 145 dòng |

**Cổng chất lượng cuối:** `npm run typecheck` · `npm run lint` · `npm run build` (22 route) ·
`npm test` (**99 test / 10 file**) — tất cả xanh.

**Đo NFR-PERF (PRD §17 yêu cầu dashboard < 3s):** đo trên dev server với dữ liệu seed —
`/today` 0.046s · `/projects` 0.036s · `/onboarding` 0.043s · `/brand-vault` 0.043s.

**Chưa làm (có lý do, không phải bỏ sót):**
- Chữ ký số / phê duyệt pháp lý → phase sau (PRD §24).
- Zalo hai chiều → hiện một chiều qua n8n; hai chiều cần Zalo OA API + kịch bản.
- `src/db/pg/*` → cố ý chưa viết (bước ~1 ngày, viết lúc migrate); runbook + script copy
  đã sẵn sàng trong docs/01 §8.
- SSO/2FA → plugin 2FA đã bật được, SSO để phase sau.
- Chart library → cố ý không dùng ở MVP (ADR-006).


---

## 1. Phase triển khai (map PRD §21)

| Phase | Nội dung | Map PRD | Cổng nghiệm thu |
|---|---|---|---|
| **P0** | Dựng nền: Next 16 + Tailwind 4 + token + shadcn, pin version, git | — | `npm run build` pass; `typecheck` + `lint` sạch |
| **P1** | Design system + app shell + ⌘K + light/dark | §18 | Shell render ở mọi route; điều hướng bàn phím; không có số spacing lạ |
| **P2** | Drizzle schema + migration + seed + better-auth (org/admin/OTP) + guard + login/invite | §13, §14, §17 | Vitest ma trận quyền + isolation pass; login 4 tài khoản seed |
| **P3** | Today + Projects + Project overview + File review (version/comment/approval) + Handover | §9, §21 Phase 1 | AC-DEL-001→006 có test; 2 luồng e2e pass |
| **P4** | Onboarding hub (checklist, brand brief, document request, tiến độ) | §8 | AC-ONB-001→005 có test |
| **P5** | AI gateway + catalog tool + renderer + 6 tính năng AI MVP + `ai_run` + cost cap | §10.3, §18 (AI-native) | Checklist AI `docs/04` §9 pass |
| **P6** | Growth + Retaining (roadmap, service request → signal CRM, brand vault, brand health) | §10, §11, §21 Phase 2–3 | AC-GRO-001→003, AC-RET-001→003 có test |
| **P7** | Outbox + mail + n8n/Zalo webhook + notification center + dashboard staff/reports | §15, §20 | Trigger §15 tạo đúng outbox; dashboard tải < 3s |
| **P8** | Hardening: a11y, hiệu năng, test bổ sung, hoàn thiện docs, runbook Postgres chạy thử | §17, §22, §23 | DoD §4; `copy-sqlite-to-pg` dry-run đếm đúng dòng |

**Sau P3 đã có lát cắt dọc để demo.** Từ P4 trở đi có thể cắt/nối tiếp mà không phá kiến trúc.

---

## 2. Migration từ PMS hiện tại (PRD §19, §24)

| PRD §19.1 Giữ lại | Cách làm trong BrandCare OS |
|---|---|
| Quản lý dự án | `project` + `milestone` + `task` (mở rộng theo project_type) |
| Upload/download file | `file_asset` + `file_version` (thêm versioning bất biến) |
| Feedback thiết kế | `feedback` (thêm thread + anchor + trạng thái xử lý) |
| Duyệt mẫu | `approval` (thêm sign-off, lý do, audit log) |
| Tương tác khách hàng | `interaction_event` + `notification` |

| PRD §19.3 Hạn chế/bỏ | Lý do |
|---|---|
| Giao diện cũ | Giảm trải nghiệm khách hàng — thay bằng 3 bề mặt |
| Quy trình chỉ hợp dự án thiết kế | Không đủ cho strategy/website/marcom/video/consulting |
| Trao đổi không cấu trúc | Không scale — thay bằng feedback gắn version |
| Thao tác thủ công lặp lại | Thay bằng template + automation (outbox/n8n) |

**Chiến lược migrate (một chiều, không ghi ngược):**
1. **Audit dữ liệu trước** (PRD §22.1): đếm dự án/file/feedback theo năm; xác định cái gì còn dùng.
2. Mapping cột PMS → schema mới; những trường không map được → ghi vào `notes` (JSON) để không mất thông tin.
3. Import theo thứ tự FK: organization → company_profile → user/member → project → project_member → file_asset → file_version → feedback → approval → milestone/task.
4. File: **link-based trước** (giữ URL cũ trong `storage_key`), chuyển dần sang storage mới. Không di chuyển toàn bộ file trong 1 lần.
5. Chạy dry-run trên bản copy, đếm số dòng + spot-check 20 bản ghi mỗi bảng trước khi làm thật.
6. Giữ PMS cũ **read-only** ít nhất 1 sprint sau khi chuyển.

---

## 3. Definition of Done (PRD §23)

Một feature xong khi **tất cả** điều sau đúng:

```
[ ] Functional : đúng yêu cầu + acceptance criteria tương ứng
[ ] Permission : đúng role, company, project, file (có test)
[ ] UX         : có loading / empty / error / readonly; CTA ≤ 3 từ
[ ] Data       : lưu đúng entity, có validation zod, tuân 8 quy tắc portability
[ ] Notification: trigger (nếu có) tạo bản ghi outbox đúng
[ ] Audit      : hành động quan trọng có audit_log
[ ] Integration: đồng bộ đúng phạm vi phase (nếu có)
[ ] Test       : có unit test (domain/quyền) hoặc e2e scenario
[ ] Docs       : cập nhật docs liên quan nếu hành vi khác mô tả
[ ] Build      : typecheck + lint + build sạch
```

---

## 4. Acceptance criteria → test ID (truy vết PRD ↔ code)

### Onboarding (§8.5)
| ID | Test |
|---|---|
| AC-ONB-001 | `test/onboarding.spec.ts`: tạo dự án theo `project_type` → checklist sinh đúng template |
| AC-ONB-002 | client upload tài liệu theo từng `checklist_item` |
| AC-ONB-003 | PM nhận notification khi client upload |
| AC-ONB-004 | client thấy `completion_rate` chính xác |
| AC-ONB-005 | chuyển `ready_for_kickoff` bị chặn khi thiếu mục bắt buộc; PM override phải có `reason` |

### Delivery (§9.6)
| ID | Test |
|---|---|
| AC-DEL-001 | client chỉ thấy file/task/milestone được phân quyền (`requireProjectAccess`) |
| AC-DEL-002 | nhiều version, lịch sử không ghi đè |
| AC-DEL-003 | feedback gắn đúng file + version (+ anchor) |
| AC-DEL-004 | version `approved` không sửa được — chỉ tạo version mới |
| AC-DEL-005 | có comment/approval mới → người phụ trách nhận notification |
| AC-DEL-006 | dashboard hiển thị đúng milestone, task overdue, approval pending |

### Growth (§10.5)
| ID | Test |
|---|---|
| AC-GRO-001 | sau khi dự án xong, hiện next steps đúng theo project_type |
| AC-GRO-002 | client gửi được service request từ Brand Home |
| AC-GRO-003 | service request → ghi `opportunity` (signal CRM) |
| AC-GRO-004 | account nhận notification khi khách xem dịch vụ/gửi yêu cầu |
| AC-GRO-005 | resource/case study tag được theo ngành/dịch vụ/giai đoạn |

### Retaining (§11.5)
| ID | Test |
|---|---|
| AC-RET-001 | file bàn giao chuyển vào Brand Vault sau khi dự án hoàn tất |
| AC-RET-002 | client xem/tải tài sản được phân quyền |
| AC-RET-003 | client gửi design request / service request sau dự án |
| AC-RET-004 | account/CS thấy lịch sử tương tác + thời điểm gần nhất |
| AC-RET-005 | tạo reminder cho dịch vụ định kỳ / mốc chăm sóc |

### NFR (§17)
| ID | Test |
|---|---|
| NFR-PERF | dashboard render < 3s với seed data |
| NFR-PRIVACY | **isolation test**: org A không đọc được bất kỳ bản ghi nào của org B (gồm cả qua AI) |
| NFR-AUDIT | upload/comment/approve/delete/status change đều có `audit_log` |
| NFR-RESPONSIVE | dùng tốt ở 375px, 768px, 1440px |

---

## 5. Bộ test

| Loại | Công cụ | Phạm vi |
|---|---|---|
| Unit | Vitest | domain rules, state machine (project/version/approval), format vi-VN |
| Permission | Vitest | ma trận role × action (`docs/03` §4) + `requireProjectAccess` |
| Isolation | Vitest | mọi repository: query của org A không trả bản ghi org B |
| Repository | Vitest | SQLite in-memory; bất biến §05.6 (đặc biệt version approved) |
| Integration | Vitest | onboarding flow, file review flow, outbox idempotency |
| AI | Vitest (mock provider) | tool schema hợp lệ; write tool bị chặn khi thiếu quyền; cap chi phí |
| E2E | Playwright (`channel: "chrome"`, không tải browser) | (a) invite → onboarding → hoàn tất; (b) upload → comment → approve → khoá; (c) AI panel → tool card → confirm mới ghi |

---

## 6. Câu hỏi mở của PRD §24 → trạng thái quyết định

| Nhóm | Câu hỏi PRD | Quyết định hiện tại | Owner |
|---|---|---|---|
| PMS hiện tại | Dữ liệu nào cần migrate? | Migrate dự án đang mở + 12 tháng gần nhất; còn lại archive | Bạn + PM |
| File storage | App / Drive / hybrid? | Dev: local. Sản xuất: **hoãn** — đã cô lập sau `StoragePort`; mặc định nghiêng hybrid (metadata trong app, file trên Drive, link-based) | Bạn |
| Approval | Cần chữ ký số không? | MVP: approval vận hành (không pháp lý). Chữ ký số để phase sau | Bạn |
| Zalo | một chiều hay hai chiều? | MVP: **một chiều** (notification qua n8n → Zalo OA). Hai chiều để sau | Bạn |
| Odoo | upsell tạo tự động hay chỉ signal? | Chỉ **signal**: ghi `opportunity` + `crm_ref`, Account quyết định trong Odoo | Bạn |
| BrandScan | real-time API hay import định kỳ? | MVP: **import** kết quả (bảng `brand_scan_result`); API để sau | Bạn |
| Client roles | Client Owner mời thêm user? Giới hạn số user? | Có, giới hạn mềm 10 user/công ty (cấu hình được) | Bạn |
| Pricing | Miễn phí hay trả phí? | MVP: miễn phí cho khách Sao Kim; billing để phase sau | Bạn |
| Analytics | Event nào cần theo dõi ở MVP? | 6 event: login, view_file, download, view_service, comment, approve | Đã chốt trong `interaction_event` |
| Security | SSO/2FA/IP restriction? | 2FA bật được (plugin có sẵn) cho khách lớn; SSO để phase sau | Bạn |

---

## 7. Rủi ro & đối sách (PRD §22.2 + rủi ro kỹ thuật)

| Rủi ro | Ảnh hưởng | Đối sách |
|---|---|---|
| Khách vẫn dùng Zalo/email thay vì portal | adoption thấp | Notification kèm deep-link quay lại portal; mọi trao đổi quan trọng phải có bản ghi trong portal |
| Scope 4 hub quá lớn | chậm tiến độ | 9 phase, mỗi phase có cổng; P3 là lát cắt demo |
| Hiểu sai thành app quản lý task | mất giá trị chiến lược | 3 bề mặt + Today/Brand Home; anti-pattern list trong `docs/00` §7 |
| Dữ liệu cũ không sạch | migration khó | audit trước, dry-run, giữ `notes` JSON cho trường không map |
| Nội bộ không cập nhật dữ liệu | dashboard mất tin cậy | stage-gate: *không ghi vào hệ thống = không tồn tại* |
| SQLite → Postgres phát sinh viết lại | tốn thời gian | 8 quy tắc portability áp từ P2; repository trả domain type |
| AI trả kết quả kém/ảo giác | mất niềm tin | AI chỉ đọc + diễn giải trên dữ liệu có ID; rule engine tất định cho quyết định; luôn có đường thao tác tay |
| Hết dung lượng đĩa khi cài dependency | chặn build | đã xử lý ở P0; kiểm tra dung lượng trước mỗi lần cài |
| Chi phí AI vượt kiểm soát | chi phí | cap theo org/ngày, model mặc định `deepseek-flash`, prompt cache-friendly |
| Turbopack + dependency có webpack config | build fail | nếu gặp: `next build --webpack` (đã ghi trong `docs/01`) |
