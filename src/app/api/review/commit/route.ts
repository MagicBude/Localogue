import { NextResponse } from "next/server";

import { buildCanonicalCommitPlan } from "@/application/review/commit-plan-service";
import { executeCanonicalCommit } from "@/application/review/commit-executor";
import { analyzeSingleEvidenceRecord } from "@/application/review/entity-resolution-service";
import type { ReviewDecisions } from "@/domain/entities/commit-plan";
import { findEvidenceRecordById } from "@/infrastructure/evidence/evidence-store";
import { findLatestCommitReceiptByEvidenceId } from "@/infrastructure/evidence/review-commit-store";
import {
  isPrivateLibraryConfigured,
  libraryRepository,
} from "@/infrastructure/repositories/repository-provider";
import { vocabularyRepository } from "@/infrastructure/repositories/vocabulary-provider";

interface CommitRequestBody {
  evidenceId?: string;
  decisions?: ReviewDecisions;
  fingerprint?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as CommitRequestBody;
  if (!body.evidenceId || !body.decisions || !body.fingerprint) {
    return NextResponse.json(
      { error: "缺少 evidenceId、decisions 或 fingerprint。" },
      { status: 400 },
    );
  }

  if (!isPrivateLibraryConfigured()) {
    return NextResponse.json(
      { error: "当前处于只读 Demo 模式，不能写入 Canonical Library。" },
      { status: 409 },
    );
  }

  const previousReceipt = await findLatestCommitReceiptByEvidenceId(body.evidenceId);
  if (previousReceipt) {
    return NextResponse.json(
      { error: "这条 Evidence 已经执行过 Canonical Commit。", receipt: previousReceipt },
      { status: 409 },
    );
  }

  const evidence = await findEvidenceRecordById(body.evidenceId);
  if (!evidence) {
    return NextResponse.json({ error: "Evidence 不存在。" }, { status: 404 });
  }

  // 执行前重新读取当前资料库并生成计划。
  // fingerprint 不一致说明用户看到的计划已经过期，必须重新预览，不能盲写。
  const analysis = await analyzeSingleEvidenceRecord(
    evidence,
    libraryRepository,
    vocabularyRepository,
  );
  const built = await buildCanonicalCommitPlan(
    evidence,
    analysis,
    body.decisions,
    libraryRepository,
    true,
  );

  if (built.plan.fingerprint !== body.fingerprint) {
    return NextResponse.json(
      {
        error: "Commit Plan 已过期：资料库或审核决策发生变化，请重新生成计划。",
        stalePlan: built.plan,
      },
      { status: 409 },
    );
  }
  if (built.plan.blockers.length) {
    return NextResponse.json(
      { error: "Commit Plan 仍有阻塞项。", plan: built.plan },
      { status: 409 },
    );
  }

  const receipt = await executeCanonicalCommit(built, libraryRepository);
  return NextResponse.json({ receipt, plan: built.plan });
}
