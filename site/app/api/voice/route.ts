// 親御さんの声の受付。必ず「確認待ち」で保存し、運営が目視で確認してから掲載する
import { NextResponse, type NextRequest } from "next/server";
import { PREFS } from "@/lib/types";
import { supabaseHeaders } from "@/lib/voices";

const AGES = ["baby", "low", "high", "none"] as const;
// 同じ送り元からの連投を抑える（1台のサーバーの中だけの簡易な制限）
const recent = new Map<string, number>();
const GAP_MS = 60_000;

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "closed" }, { status: 503 });
  // 自サイトのフォームからの送信だけを受け付ける
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ ok: false }, { status: 403 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const last = recent.get(ip) ?? 0;
  if (Date.now() - last < GAP_MS) return NextResponse.json({ ok: false, error: "wait" }, { status: 429 });

  const data = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data) return NextResponse.json({ ok: false }, { status: 400 });
  // 人には見えない欄に入力があれば機械の投稿とみなし、受け付けたふりをして捨てる
  if (str(data.website, 10)) return NextResponse.json({ ok: true });
  const body = str(data.body, 300);
  const age = AGES.find((a) => a === data.age) ?? "none";
  const prefIn = str(data.pref, 4);
  const pref = (PREFS as readonly string[]).includes(prefIn) ? prefIn : null;
  const nickname = str(data.nickname, 20) || null;
  // 短すぎる・リンクを含む投稿は受け付けない
  if (body.length < 5 || /https?:|www\.|\.(com|jp|net)\b/i.test(`${body} ${nickname ?? ""}`)) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  recent.set(ip, Date.now());
  const res = await fetch(`${url}/rest/v1/voices`, {
    method: "POST",
    headers: { ...supabaseHeaders(key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ age, pref, body, nickname }),
  }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ ok: false, error: "save" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
