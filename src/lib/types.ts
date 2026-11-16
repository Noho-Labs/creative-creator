import type { CreativeRow, ReviewRow } from '@/db/schema';

export type ReviewDecision = 'approve' | 'deny' | 'changes';
export type ReviewSummary = {
  counts: Record<ReviewDecision, number>;
  reviews: { email: string; decision: ReviewDecision; note: string; createdAt: string }[];
};

export type CreativeStatus =
  | 'pending'
  | 'generating'
  | 'awaiting_screenshot'
  | 'complete'
  | 'failed';

// JSON-safe shape shared by API responses and client components (dates as ISO strings).
export type CreativeDTO = {
  id: string;
  campaignId: string;
  concept: string;
  details: string;
  status: CreativeStatus;
  reviewStatus: 'draft' | 'in_review' | 'approved' | 'rejected';
  version: number;
  sentForReviewAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  revisionNotes: string | null;
  reviewSummary: ReviewSummary;
  imagePath: string | null;
  error: string | null;
  needsAppIcon: boolean | null;
  needsLogo: boolean | null;
  needsScreenshot: boolean | null;
  screenshotRequest: string | null;
  screenshotPath: string | null;
  classifiedAt: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export function toCreativeDTO(row: CreativeRow, reviewRows: ReviewRow[] = []): CreativeDTO {
  const current = reviewRows.filter((review) => review.creativeId === row.id && review.version === row.version);
  const counts = { approve: 0, deny: 0, changes: 0 };
  for (const review of current) counts[review.decision]++;
  return {
    ...row,
    sentForReviewAt: row.sentForReviewAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    reviewSummary: { counts, reviews: current.map((review) => ({ email: review.reviewerEmail, decision: review.decision, note: review.note, createdAt: review.createdAt.toISOString() })) },
    classifiedAt: row.classifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
