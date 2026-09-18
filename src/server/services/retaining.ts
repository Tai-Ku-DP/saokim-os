import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  brandAsset,
  brandGuideline,
  brandHealthSnapshot,
  brandScanResult,
  growthRecommendation,
  project,
  servicePackage,
} from "@/db/sqlite/schema";
import type { ProjectType } from "@/db/types";
import { can, type AuthContext } from "@/server/auth/access";
import { requireOrgScope } from "@/server/auth/project-access";
import { DomainError } from "./errors";

/**
 * Growth + Retaining (PRD §10, §11).
 *
 * QUAN TRỌNG: quyết định gợi ý dịch vụ là RULE TẤT ĐỊNH (dưới đây), không phải model.
 * AI chỉ được diễn giải và sắp thứ tự (docs/04 §5) — tránh gợi ý dịch vụ tuỳ tiện.
 */

/** PRD §10.3 — sau khi hoàn thành dự án loại X thì nên làm gì tiếp. */
export const NEXT_STEPS_BY_PROJECT_TYPE: Record<ProjectType, string[]> = {
  brand_strategy: ["Nhận diện thương hiệu", "Marcom"],
  brand_identity: ["Brand guideline", "Website doanh nghiệp", "Profile / Brochure"],
  website: ["Website care", "Design request"],
  profile: ["Design request", "Brand audit"],
  packaging: ["Design request", "Brand guideline"],
  video: ["Marcom", "Design request"],
  marcom: ["Brand audit", "Design request"],
  consulting: ["Chiến lược thương hiệu", "Nhận diện thương hiệu"],
};

export type RoadmapStage = {
  key: string;
  title: string;
  description: string;
  state: "done" | "current" | "next";
  serviceNames: string[];
};

export type Roadmap = {
  organizationId: string;
  brandStage: "startup" | "scaleup" | "corporate" | null;
  stages: RoadmapStage[];
  healthScore: number | null;
};

const STAGE_DEFINITIONS: { key: string; title: string; description: string; types: ProjectType[] }[] = [
  {
    key: "foundation",
    title: "Nền tảng thương hiệu",
    description: "Chiến lược, định vị, nhận diện cơ bản",
    types: ["brand_strategy", "brand_identity"],
  },
  {
    key: "system",
    title: "Hệ thống & ứng dụng",
    description: "Guideline, profile, bao bì, website",
    types: ["profile", "packaging", "website"],
  },
  {
    key: "growth",
    title: "Tăng trưởng & truyền thông",
    description: "Marcom, video, chiến dịch",
    types: ["marcom", "video", "consulting"],
  },
];

/** Lộ trình theo giai đoạn: giai đoạn đã xong / đang làm / tiếp theo. */
export async function buildRoadmap(ctx: AuthContext, organizationId: string): Promise<Roadmap> {
  if (ctx.kind === "client") requireOrgScope(ctx, organizationId);

  const projects = await db
    .select({ projectType: project.projectType, status: project.status })
    .from(project)
    .where(and(eq(project.organizationId, organizationId), isNull(project.deletedAt)));

  const completedTypes = new Set(
    projects.filter((p) => p.status === "completed").map((p) => p.projectType),
  );
  const activeTypes = new Set(
    projects.filter((p) => p.status !== "completed").map((p) => p.projectType),
  );

  const health = await latestHealthScore(organizationId);

  const stages: RoadmapStage[] = STAGE_DEFINITIONS.map((stage) => {
    const allDone = stage.types.every((type) => completedTypes.has(type));
    const anyStarted = stage.types.some(
      (type) => completedTypes.has(type) || activeTypes.has(type),
    );

    const serviceNames = Array.from(
      new Set(
        stage.types
          .filter((type) => completedTypes.has(type))
          .flatMap((type) => NEXT_STEPS_BY_PROJECT_TYPE[type]),
      ),
    );

    return {
      key: stage.key,
      title: stage.title,
      description: stage.description,
      state: allDone ? "done" : anyStarted ? "current" : "next",
      serviceNames,
    };
  });

  // Giai đoạn "next" đầu tiên chuyển thành current nếu chưa có gì đang chạy.
  if (!stages.some((s) => s.state === "current")) {
    const firstNext = stages.find((s) => s.state === "next");
    if (firstNext) firstNext.state = "current";
  }

  return {
    organizationId,
    brandStage: null,
    stages,
    healthScore: health,
  };
}

export type BrandAssetRow = {
  id: string;
  type: string;
  name: string;
  value: Record<string, string>;
  usageNote: string | null;
  tags: string[];
};

export type BrandHome = {
  organizationId: string;
  assets: BrandAssetRow[];
  guideline: { title: string; sections: { key: string; title: string; content: string }[] } | null;
  healthScore: number | null;
  healthBreakdown: { key: string; label: string; score: number }[];
  scan: {
    score: number | null;
    scannedAt: Date | null;
    findings: { key: string; label: string; severity: string }[];
    recommendation: { serviceId?: string; text: string }[];
  } | null;
  lastInteractionAt: Date | null;
};

/** Brand Home: tài sản, guideline, sức khỏe thương hiệu (PRD §11). */
export async function getBrandHome(ctx: AuthContext, organizationId: string): Promise<BrandHome> {
  if (ctx.kind === "client") requireOrgScope(ctx, organizationId);
  if (!can(ctx, { vault: ["read"] })) {
    throw new DomainError("INVALID_INPUT", "Bạn không có quyền xem tài sản thương hiệu");
  }

  const assets = await db
    .select({
      id: brandAsset.id,
      type: brandAsset.type,
      name: brandAsset.name,
      value: brandAsset.value,
      usageNote: brandAsset.usageNote,
      tags: brandAsset.tags,
    })
    .from(brandAsset)
    .where(eq(brandAsset.organizationId, organizationId))
    .orderBy(brandAsset.type, brandAsset.name);

  const guidelines = await db
    .select({
      title: brandGuideline.title,
      sections: brandGuideline.sections,
    })
    .from(brandGuideline)
    .where(
      and(eq(brandGuideline.organizationId, organizationId), eq(brandGuideline.status, "published")),
    )
    .orderBy(desc(brandGuideline.publishedAt))
    .limit(1);

  const snapshots = await db
    .select({
      score: brandHealthSnapshot.score,
      breakdown: brandHealthSnapshot.breakdown,
      takenAt: brandHealthSnapshot.takenAt,
    })
    .from(brandHealthSnapshot)
    .where(eq(brandHealthSnapshot.organizationId, organizationId))
    .orderBy(desc(brandHealthSnapshot.takenAt))
    .limit(1);

  const scans = await db
    .select({
      score: brandScanResult.score,
      scannedAt: brandScanResult.scannedAt,
      findings: brandScanResult.findings,
      recommendation: brandScanResult.recommendation,
    })
    .from(brandScanResult)
    .where(eq(brandScanResult.organizationId, organizationId))
    .orderBy(desc(brandScanResult.scannedAt))
    .limit(1);

  return {
    organizationId,
    assets,
    guideline: guidelines[0] ?? null,
    healthScore: snapshots[0]?.score ?? null,
    healthBreakdown: snapshots[0]?.breakdown ?? [],
    scan: scans[0]
      ? {
          score: scans[0].score,
          scannedAt: scans[0].scannedAt,
          findings: scans[0].findings,
          recommendation: scans[0].recommendation,
        }
      : null,
    lastInteractionAt: null,
  };
}

/** Đề xuất dịch vụ đang mở (rule + AI diễn giải ở tầng UI). */
export async function listOpenRecommendations(ctx: AuthContext, organizationId: string) {
  if (ctx.kind === "client") requireOrgScope(ctx, organizationId);

  return db
    .select({
      id: growthRecommendation.id,
      serviceId: growthRecommendation.serviceId,
      serviceName: servicePackage.name,
      serviceDescription: servicePackage.description,
      priority: growthRecommendation.priority,
      status: growthRecommendation.status,
      trigger: growthRecommendation.trigger,
    })
    .from(growthRecommendation)
    .leftJoin(servicePackage, eq(growthRecommendation.serviceId, servicePackage.id))
    .where(eq(growthRecommendation.organizationId, organizationId))
    .orderBy(desc(growthRecommendation.priority))
    .limit(10);
}

/**
 * Sinh đề xuất từ dự án đã hoàn thành (AC-GRO-001) — tất định, không dùng model.
 * Trả về số đề xuất được tạo mới.
 */
export async function generateRecommendationsFromCompletedProjects(
  ctx: AuthContext,
  organizationId: string,
): Promise<number> {
  if (ctx.kind === "client") requireOrgScope(ctx, organizationId);

  const completed = await db
    .select({ id: project.id, projectType: project.projectType })
    .from(project)
    .where(
      and(
        eq(project.organizationId, organizationId),
        eq(project.status, "completed"),
        isNull(project.deletedAt),
      ),
    );

  if (completed.length === 0) return 0;

  const packages = await db
    .select({ id: servicePackage.id, name: servicePackage.name })
    .from(servicePackage);

  const existing = await db
    .select({ serviceId: growthRecommendation.serviceId, projectId: growthRecommendation.projectId })
    .from(growthRecommendation)
    .where(eq(growthRecommendation.organizationId, organizationId));

  const existingKeys = new Set(existing.map((r) => `${r.projectId}:${r.serviceId}`));
  let created = 0;

  db.transaction((tx) => {
    for (const proj of completed) {
      const wanted = NEXT_STEPS_BY_PROJECT_TYPE[proj.projectType] ?? [];
      wanted.forEach((serviceName, index) => {
        const pkg = packages.find((p) => p.name === serviceName);
        if (!pkg) return;
        const key = `${proj.id}:${pkg.id}`;
        if (existingKeys.has(key)) return;
        existingKeys.add(key);

        tx.insert(growthRecommendation)
          .values({
            organizationId,
            projectId: proj.id,
            trigger: { rule: `after_${proj.projectType}`, input: { projectId: proj.id } },
            serviceId: pkg.id,
            priority: wanted.length - index,
            status: "new",
          })
          .run();
        created += 1;
      });
    }
  });

  return created;
}

async function latestHealthScore(organizationId: string): Promise<number | null> {
  const rows = await db
    .select({ score: brandHealthSnapshot.score })
    .from(brandHealthSnapshot)
    .where(eq(brandHealthSnapshot.organizationId, organizationId))
    .orderBy(desc(brandHealthSnapshot.takenAt))
    .limit(1);
  return rows[0]?.score ?? null;
}
