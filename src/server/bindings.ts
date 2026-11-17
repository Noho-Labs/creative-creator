import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1Database, Queue, R2Bucket } from '@cloudflare/workers-types';

export type GenerationJob = { creativeId: string };

export interface AppBindings {
  DB: D1Database;
  IMAGES: R2Bucket;
  GEN_QUEUE: Queue<GenerationJob>;
  DEV_AUTH?: string;
  DEV_USER_EMAIL?: string;
  CREATOR_EMAILS?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  MOCK_IMAGES?: string;
  OPENAI_API_KEY?: string;
  OPENAI_IMAGE_MODEL?: string;
  OPENAI_TEXT_MODEL?: string;
  OPENAI_IMAGE_SIZE?: string;
  OPENAI_IMAGE_QUALITY?: string;
}

export function getBindings(): AppBindings {
  return getCloudflareContext().env as unknown as AppBindings;
}
