import OpenAI from 'openai';
import { env } from '@/lib/env';

// Single composition point: adding campaign-brief context later is one line here.
export function buildImagePrompt(input: { concept: string; details: string }): string {
  const details = input.details.trim();
  return [
    `Generate a polished advertising creative image for this concept: ${input.concept}`,
    details ? `Details:\n${details}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function generateImage(prompt: string): Promise<Buffer> {
  if (env.mockImages) return mockImage(prompt);

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const result = await openai.images.generate({
    model: env.OPENAI_IMAGE_MODEL,
    prompt,
    size: env.OPENAI_IMAGE_SIZE as 'auto', // gpt-image-2 accepts flexible sizes beyond the SDK union
    quality: env.OPENAI_IMAGE_QUALITY,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${env.OPENAI_IMAGE_MODEL} returned no image data`);
  return Buffer.from(b64, 'base64');
}

// 64x64 solid-color tiles; the card's object-cover stretches them cleanly.
// The prompt hash picks a color so queued cards are visually distinct.
const PLACEHOLDER_PNGS = [
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAATklEQVR42u3PQQkAAAgEsOsq2N8GRvAtDFZgqZ7XIiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwWV7OoZaC+o1lAAAAAElFTkSuQmCC',
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVR42u3PQQkAAAgEsItgZWPZzgi+hcEKLDX9WgQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQELgtJNqEtSnCMWgAAAABJRU5ErkJggg==',
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAUElEQVR42u3PQQkAAAgEsGtmE/sHMIARfAuDFVim+rUICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICFwWAGEReKYdWCsAAAAASUVORK5CYII=',
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVR42u3PMQ0AAAgDsP34f3HJjwRukiY10EzXaxEQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQuCxmweF4NID8QAAAAABJRU5ErkJggg==',
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAUElEQVR42u3PQQkAAAgEsEtg/wKGs4URfAuDFViq57UICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICFwW59LBeEtKdBAAAAAASUVORK5CYII=',
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVR42u3PQQkAAAgEsCtpRxv6NYJvYbACS9e8FgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQGBywJvIUHSeX/8kwAAAABJRU5ErkJggg==',
];

async function mockImage(prompt: string): Promise<Buffer> {
  // Artificial delay so pending -> generating -> complete is observable in the UI.
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
  const i = [...prompt].reduce((a, c) => a + c.charCodeAt(0), 0) % PLACEHOLDER_PNGS.length;
  return Buffer.from(PLACEHOLDER_PNGS[i], 'base64');
}
