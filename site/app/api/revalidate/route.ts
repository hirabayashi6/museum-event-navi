// 巡回が終わったら呼ばれ、サイトのページを作り直す（取得した情報を随時反映）
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !same(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return Response.json({ ok: true, at: new Date().toISOString() });
}
