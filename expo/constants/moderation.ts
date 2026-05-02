export const TERMS_VERSION = '2026-04-21';

export const TERMS_URL = 'https://tropicalx.app/terms';
export const PRIVACY_URL = 'https://tropicalx.app/privacy';
export const SUPPORT_URL = 'https://tropicalx.app/support';

const BANNED_WORDS: string[] = [
  'nigger','nigga','faggot','fag','retard','retarded','kike','chink','spic','tranny',
  'cunt','whore','slut','rapist','rape','pedo','pedophile','childporn','cp',
  'kys','killyourself','kill yourself',
];

const LEET_MAP: Record<string, string> = {
  '0': 'o','1': 'i','3': 'e','4': 'a','5': 's','7': 't','@': 'a','$': 's','!': 'i',
};

function normalize(input: string): string {
  const lower = input.toLowerCase();
  let out = '';
  for (const ch of lower) out += LEET_MAP[ch] ?? ch;
  return out.replace(/[^a-z\s]/g, '');
}

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

export function moderateText(text: string): ModerationResult {
  const t = text.trim();
  if (!t) return { ok: true };
  const normalized = normalize(t);
  const compact = normalized.replace(/\s+/g, '');
  for (const w of BANNED_WORDS) {
    if (!w) continue;
    if (normalized.includes(w) || compact.includes(w.replace(/\s+/g, ''))) {
      return { ok: false, reason: 'Message blocked for hateful or abusive language.' };
    }
  }
  return { ok: true };
}
