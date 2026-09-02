import { NextResponse } from "next/server";

import { buildCanonicalCommitPlan } from "@/application/review/commit-plan-service";
import { analyzeSingleEvidenceRecord } from "@/application/review/entity-resolution-service";
import type { ReviewDecisions } from "@/domain/entities/commit-plan";
import { findEvidenceRecordById } from "@/infrastructure/evidence/evidence-store";
import { getEvidenceLifecycle } from "@/infrastructure/evidence/evidence-lifecycle-store";
import { findLatestActiveCommitReceiptByEvidenceId } from "@/infrastructure/evidence/review-commit-store";
import {
  isPrivateLibraryConfigured,
  libraryRepository,
} from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";

interface PlanRequestBody {
  evidenceId?: string;
  decisions?: ReviewDecisions;
}

export async function POST(request: Request) {
  const body = (await request.json()) as PlanRequestBody;
  if (!body.evidenceId || !body.decisions) {
    return NextResponse.json({ error: "缺少 evidenceId 或 decisions。" }, { status: 400 });
  }

  const evidence = await findEvidenceRecordById(body.evidenceId);
  if (!evidence) {
    return NextResponse.json({ error: "Evidence 不存在。" }, { status: 404 });
  }

  const lifecycle = await getEvidenceLifecycle(evidence.id);
  if (lifecycle.status === "ignored") {
    return NextResponse.json({ error: "这条 Evidence 已被忽略。请先恢复为待审核状态。" }, { status: 409 });
  }

  const [analysis, receipt] = await Promise.all([
    analyzeSingleEvidenceRecord(evidence, libraryRepository, vocabularyRepository),
    findLatestActiveCommitReceiptByEvidenceId(evidence.id),
  ]);

  const built = await buildCanonicalCommitPlan(
    evidence,
    analysis,
    body.decisions,
    libraryRepository,
    isPrivateLibraryConfigured(),
  );

  return NextResponse.json({
    plan: built.plan,
    alreadyCommitted: receipt,
  });
}
