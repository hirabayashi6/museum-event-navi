// 無料枠のLLMをまとめて扱う。1日の上限に当たったモデルは飛ばし、次のモデルに切り替える
const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODELS = (process.env.LLM_MODELS ?? "openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b").split(",");
const exhausted = new Set<string>();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// JSON を返してもらう。全モデルが上限なら "limit"
// gpt-oss は考える量を low にする（判定の質は同じで、1日の上限に使うトークンが1割ほど減る）
export async function askJson(prompt: string): Promise<unknown | "limit"> {
  const key = process.env.LLM_API_KEY ?? "";
  for (const model of MODELS) {
    if (exhausted.has(model)) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }], ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}) }),
      }).catch(() => null);
      if (!res) { await sleep(5000); continue; }
      if (res.status === 429) {
        const body = await res.text();
        const wait = Number(res.headers.get("retry-after") ?? "60");
        // 1日の上限、または長い待ちが必要なら、このモデルは今日は使わない
        if (/per day|TPD|RPD/.test(body) || wait > 60) { exhausted.add(model); break; }
        await sleep((wait + 1) * 1000);
        continue;
      }
      if (!res.ok) break;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      if (Number(res.headers.get("x-ratelimit-remaining-tokens") ?? "99999") < 3000) await sleep(15_000);
      const content = data.choices?.[0]?.message?.content ?? "{}";
      try { return JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1) || "{}"); } catch { return {}; }
    }
  }
  return "limit";
}
