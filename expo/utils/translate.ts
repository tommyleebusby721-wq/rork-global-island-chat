import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';

export interface TranslationResult {
  translated: string;
  sourceLanguage: string;
  isSameLanguage: boolean;
}

const schema = z.object({
  translated: z.string().describe('The translated text in the target language. If source is already the target language, return the original text unchanged.'),
  sourceLanguage: z.string().describe('The detected language of the original text, e.g. "English", "Spanish", "French", "Haitian Creole", "Dutch", "Papiamento".'),
  isSameLanguage: z.boolean().describe('True if the source text is already in the target language.'),
});

export async function translateText(
  text: string,
  targetLanguage: string,
): Promise<TranslationResult> {
  const clean = text.trim();
  if (!clean) {
    return { translated: '', sourceLanguage: 'Unknown', isSameLanguage: true };
  }
  try {
    const result = await generateObject({
      schema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Detect the language of the following chat message and translate it to ${targetLanguage}. Preserve @mentions (tokens like @name) and emoji exactly. Keep the tone casual.\n\nMessage:\n"""${clean}"""`,
            },
          ],
        },
      ],
    });
    return result;
  } catch (e) {
    console.log('translateText error', e);
    throw e;
  }
}
