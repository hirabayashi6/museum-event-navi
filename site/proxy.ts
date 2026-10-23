// 社内検証中の Basic 認証。認証情報は環境変数のみ（未設定なら認証なし＝ローカル開発用）
import { NextResponse, type NextRequest } from "next/server";

function ok(request: NextRequest): boolean {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  // 環境変数が未設定、またはこのMacでの開発中は認証なし
  if (!user || !pass || process.env.NODE_ENV === "development") return true;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  return i >= 0 && decoded.slice(0, i) === user && decoded.slice(i + 1) === pass;
}

export function proxy(request: NextRequest) {
  // 再生成の依頼は合言葉で守るので、Basic 認証の対象外
  if (request.nextUrl.pathname === "/api/revalidate") return NextResponse.next();
  if (ok(request)) return NextResponse.next();
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="museum-event-navi"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
