import type { CreativeRow } from '@/db/schema';

export type CreativeStatus = 'pending' | 'generating' | 'complete' | 'failed';

// JSON-safe shape shared by API responses and client components (dates as ISO strings).
export type CreativeDTO = {
  id: string;
  campaignId: string;
  concept: string;
  details: string;
  status: CreativeStatus;
  imagePath: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export function toCreativeDTO(row: CreativeRow): CreativeDTO {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
