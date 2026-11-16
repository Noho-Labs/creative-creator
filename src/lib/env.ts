import { z } from 'zod';
import { getBindings, type AppBindings } from '@/server/bindings';

const schema = z.object({
  CF_ACCESS_TEAM_DOMAIN: z.string().optional(),
  CF_ACCESS_AUD: z.string().optional(),
  DEV_USER_EMAIL: z.string().default('dev@noholabs.com'),
  CREATOR_EMAILS: z.string().default(''),
  DEV_AUTH: z.enum(['true', 'false']).default('false'),
  MOCK_IMAGES: z.enum(['true', 'false']).default('true'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-2'),
  OPENAI_TEXT_MODEL: z.string().default('gpt-5.4-mini'), // asset-needs classifier
  OPENAI_IMAGE_SIZE: z.string().default('1024x1536'), // portrait, social-friendly
  OPENAI_IMAGE_QUALITY: z.enum(['low', 'medium', 'high', 'auto']).default('medium'),
});

export function getEnv(bindings: AppBindings = getBindings()) {
  const parsed = schema.parse(bindings);
  if (parsed.MOCK_IMAGES === 'false' && !parsed.OPENAI_API_KEY) {
    throw new Error('MOCK_IMAGES=false requires OPENAI_API_KEY.');
  }
  return { ...parsed, mockImages: parsed.MOCK_IMAGES !== 'false' };
}

export type Settings = ReturnType<typeof getEnv>;
