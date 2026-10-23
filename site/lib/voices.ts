// 親御さんの声：掲載にした声だけを読む（Supabase の voices 表。表示できるのは status が approved の行だけ）
export type VoiceAge = "baby" | "low" | "high" | "none";
export type Voice = { id: number; created_at: string; age: VoiceAge; pref: string | null; body: string; nickname: string | null };

export const voicesReady = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

export function supabaseHeaders(key: string): Record<string, string> {
  // 新形式のキー（sb_…）は apikey ヘッダーだけ、旧形式（JWT）は Authorization も付ける
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

export async function getVoices(limit = 60): Promise<Voice[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/voices?select=id,created_at,age,pref,body,nickname&order=created_at.desc&limit=${limit}`, {
    headers: supabaseHeaders(key),
    next: { revalidate: 600, tags: ["voices"] },
  }).catch(() => null);
  if (!res?.ok) return [];
  return (await res.json()) as Voice[];
}
