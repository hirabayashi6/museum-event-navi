"use client";
// 選んだ条件を端末に覚えておき、次に「さがす」を開いたときに戻す
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const KEY = "navi:lastQuery";

export function RememberFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    const q = params.toString();
    try {
      if (q) localStorage.setItem(KEY, q);
      else {
        const saved = localStorage.getItem(KEY);
        if (saved) router.replace(`${path}?${saved}`);
      }
    } catch {
      /* 保存できない環境では何もしない */
    }
  }, [params, router, path]);
  return null;
}
