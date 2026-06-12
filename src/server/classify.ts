import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '@/lib/env';

export type AssetNeeds = {
  needsScreenshot: boolean;
  needsAppIcon: boolean;
  needsLogo: boolean;
  screenshotRequest: string | null;
};

const SYSTEM_PROMPT = `You decide which brand assets an ad-creative image generation needs.
Given a campaign brief and one creative (a one-line concept plus optional details), answer:
- needs_screenshot: does the ad clearly need to show the app's actual UI (a screenshot)?
- needs_app_icon: does the ad clearly need the app's icon (e.g. phone home screen, app-store framing)?
- needs_logo: does the ad clearly need the brand logo (e.g. branded lockup, watermark, end-card)?
Be conservative — only true when the creative concretely calls for it, not merely because the campaign is about an app.
If needs_screenshot is true, set screenshot_request to one sentence telling a human exactly which app screen to capture and upload for this creative; otherwise set it to null.`;

const responseSchema = z.object({
  needs_screenshot: z.boolean(),
  needs_app_icon: z.boolean(),
  needs_logo: z.boolean(),
  screenshot_request: z.string().nullable(),
});

export async function classifyCreative(input: {
  brief: string;
  concept: string;
  details: string;
}): Promise<AssetNeeds> {
  if (env.mockImages) return mockClassify(input);

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_TEXT_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Campaign brief:\n${input.brief}\n\nCreative concept: ${input.concept}\n\nCreative details:\n${input.details.trim() || '(none)'}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'asset_needs',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['needs_screenshot', 'needs_app_icon', 'needs_logo', 'screenshot_request'],
          properties: {
            needs_screenshot: { type: 'boolean' },
            needs_app_icon: { type: 'boolean' },
            needs_logo: { type: 'boolean' },
            screenshot_request: { type: ['string', 'null'] },
          },
        },
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error(`${env.OPENAI_TEXT_MODEL} returned no classification`);
  const parsed = responseSchema.parse(JSON.parse(raw));
  return {
    needsScreenshot: parsed.needs_screenshot,
    needsAppIcon: parsed.needs_app_icon,
    needsLogo: parsed.needs_logo,
    screenshotRequest: parsed.needs_screenshot
      ? (parsed.screenshot_request ?? `Upload an app screenshot for: "${input.concept}"`)
      : null,
  };
}

// Deterministic keyword heuristic so the full flow (including the
// awaiting-screenshot gate) is testable in mock mode with zero API spend.
function mockClassify(input: { concept: string; details: string }): AssetNeeds {
  const text = `${input.concept}\n${input.details}`.toLowerCase();
  const needsScreenshot = /screenshot|app screen|in-app|app ui/.test(text);
  return {
    needsScreenshot,
    needsAppIcon: /\bicon\b|home screen|app store/.test(text),
    needsLogo: /\blogo\b|brand mark|lockup/.test(text),
    screenshotRequest: needsScreenshot
      ? `Upload a screenshot of the app view this creative references: "${input.concept}"`
      : null,
  };
}
