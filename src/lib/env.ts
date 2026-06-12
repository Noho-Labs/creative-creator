import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  MOCK_IMAGES: z.enum(['true', 'false']).default('true'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-2'),
  OPENAI_TEXT_MODEL: z.string().default('gpt-5.4-mini'), // asset-needs classifier
  OPENAI_IMAGE_SIZE: z.string().default('1024x1536'), // portrait, social-friendly
  OPENAI_IMAGE_QUALITY: z.enum(['low', 'medium', 'high', 'auto']).default('medium'),
  DATA_DIR: z.string().default('./data'),
});

const parsed = schema.parse(process.env);

if (parsed.MOCK_IMAGES === 'false' && !parsed.OPENAI_API_KEY) {
  throw new Error('MOCK_IMAGES=false requires OPENAI_API_KEY (set it in .env.local).');
}

export const env = { ...parsed, mockImages: parsed.MOCK_IMAGES !== 'false' };
