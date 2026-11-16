import { and, asc, eq, inArray, notExists, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { campaigns, creatives, reviews, type CreativeRow } from '@/db/schema';
import { toCreativeDTO } from '@/lib/types';

export async function creativeDTOs(rows: CreativeRow[]) {
  if (!rows.length) return [];
  const reviewRows = await db.select().from(reviews).where(inArray(reviews.creativeId, rows.map((row) => row.id))).orderBy(asc(reviews.createdAt));
  return rows.map((row) => toCreativeDTO(row, reviewRows));
}

export async function nextReview(email: string) {
  const eligible = and(
    eq(creatives.reviewStatus, 'in_review'),
    eq(creatives.status, 'complete'),
    notExists(db.select({ id: reviews.id }).from(reviews).where(and(
      eq(reviews.creativeId, creatives.id), eq(reviews.version, creatives.version), eq(reviews.reviewerEmail, email),
    ))),
  );
  return db.transaction(async (tx) => {
    const [count] = await tx.select({ total: sql<number>`count(*)::int` }).from(creatives).where(eligible);
    const [item] = await tx.select({ creative: creatives, campaign: { name: campaigns.name, brief: campaigns.brief } })
      .from(creatives).innerJoin(campaigns, eq(campaigns.id, creatives.campaignId))
      .where(eligible).orderBy(asc(creatives.sentForReviewAt), asc(creatives.id)).limit(1);
    const reviewRows = item ? await tx.select().from(reviews).where(and(eq(reviews.creativeId, item.creative.id), eq(reviews.version, item.creative.version))).orderBy(asc(reviews.createdAt)) : [];
    return { creative: item ? toCreativeDTO(item.creative, reviewRows) : null, campaign: item?.campaign ?? null, remaining: count.total };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
