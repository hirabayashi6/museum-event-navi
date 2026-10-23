"use client";
// 親御さんの声の投稿フォーム（名前や連絡先は聞かない）
import { useState } from "react";

type Labels = { body: string; hint: string; age: string; ages: [string, string][]; pref: string; prefs: [string, string][]; nick: string; note: string; send: string; thanks: string; error: string };

export function VoiceForm({ labels }: { labels: Labels }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setState("sending");
    const res = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(f.entries())),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  };
  if (state === "done") return <p className="voice-thanks">{labels.thanks}</p>;
  return (
    <form className="voice-form" onSubmit={submit}>
      <label className="vf-wide">
        <span>{labels.body}</span>
        <textarea name="body" required minLength={5} maxLength={300} rows={4} placeholder={labels.hint} />
      </label>
      <label>
        <span>{labels.age}</span>
        <select name="age" defaultValue="none">{labels.ages.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </label>
      <label>
        <span>{labels.pref}</span>
        <select name="pref" defaultValue="">{labels.prefs.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </label>
      <label>
        <span>{labels.nick}</span>
        <input name="nickname" maxLength={20} autoComplete="off" />
      </label>
      {/* 人には見えない欄（機械の投稿よけ） */}
      <input className="vf-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="note vf-wide">{labels.note}</p>
      <div className="vf-wide">
        <button className="btn" type="submit" disabled={state === "sending"}>{labels.send}</button>
        {state === "error" && <span className="note vf-err">{labels.error}</span>}
      </div>
    </form>
  );
}
