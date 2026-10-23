"use client";
// 家族への共有：LINEで送る／リンクをコピー（スマホは端末の共有シート）
import { useState } from "react";

export function ShareButtons({ title, lineLabel, shareLabel, copiedLabel }: { title: string; lineLabel: string; shareLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      /* 共有をやめた場合など */
    }
  };
  return (
    <div className="share">
      <a className="btn btn-line" href={`https://line.me/R/share?text=${encodeURIComponent(title)}%20`} target="_blank" rel="noopener noreferrer" onClick={(ev) => { ev.currentTarget.href = `https://line.me/R/share?text=${encodeURIComponent(`${title} ${window.location.href}`)}`; }}>{lineLabel}</a>
      <button className="btn btn-line" type="button" onClick={share}>{copied ? copiedLabel : shareLabel}</button>
    </div>
  );
}
