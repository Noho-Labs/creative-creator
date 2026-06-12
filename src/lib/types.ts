import type { CreativeRow } from '@/db/schema';

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

export function toCreativeDTO(row: CreativeRow): CreativeDTO {
  return {
    ...row,
    classifiedAt: row.classifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
