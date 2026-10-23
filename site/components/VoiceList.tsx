// 親御さんの声の一覧（掲載にした声だけが渡される）
import { t, prefLabel, type Lang } from "@/lib/i18n";
import type { Voice } from "@/lib/voices";

const AGE_KEY = { baby: "ageBaby", low: "ageLow", high: "ageHigh", none: "voiceAgeNone" } as const;

export function VoiceList({ voices, lang }: { voices: Voice[]; lang: Lang }) {
  return (
    <ul className="voice-list">
      {voices.map((v) => (
        <li key={v.id} className="voice">
          <p className="voice-body">{v.body}</p>
          <p className="voice-meta">
            {[v.nickname || t(lang, "voiceAnon"), v.age !== "none" ? t(lang, AGE_KEY[v.age]) : "", v.pref ? prefLabel(v.pref, lang) : ""].filter(Boolean).join("　")}
            <time dateTime={v.created_at}>{v.created_at.slice(0, 10).replace(/-/g, ".")}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}

