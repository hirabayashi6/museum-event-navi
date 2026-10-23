// 言語の切り替え：選んだ言語を端末に覚えさせ、元のページに戻す
import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("l");
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  // 戻り先は自サイト内のパスだけ（外部への転送に使われないように）
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
  const res = NextResponse.redirect(new URL(safeNext, request.url));
  if (lang === "ja" || lang === "en" || lang === "easy") {
    res.cookies.set("navi_lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return res;
}
