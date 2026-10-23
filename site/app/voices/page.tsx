import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getLang, t, prefLabel } from "@/lib/i18n";
import { PREFS } from "@/lib/types";
import { getVoices, voicesReady } from "@/lib/voices";
import { VoiceList } from "@/components/VoiceList";
import { VoiceForm } from "@/components/VoiceForm";

export const metadata: Metadata = pageMeta({ title: "親御さんの声", description: "「こんなイベントがあったらいいな」——子育て中の方の声を集め、全国の博物館にお届けしています。", path: "/voices" });
export const revalidate = 600;

export default async function VoicesPage() {
  const lang = await getLang();
  const voices = await getVoices();
  return (
    <div className="voices-page">
      <h1>{t(lang, "voices")}</h1>
      <p className="lead">{t(lang, "voicesLead")}</p>
      <section className="sec" id="form">
        <div className="sec-row"><h2>{t(lang, "voiceForm")}</h2></div>
        {voicesReady() ? (
          <VoiceForm
            labels={{
              body: t(lang, "voiceBody"), hint: t(lang, "voiceBodyHint"), age: t(lang, "childAge"),
              ages: [["none", t(lang, "voiceAgeNone")], ["baby", t(lang, "ageBaby")], ["low", t(lang, "ageLow")], ["high", t(lang, "ageHigh")]],
              pref: t(lang, "voicePref"), prefs: [["", "—"], ...PREFS.map((p): [string, string] => [p, prefLabel(p, lang)])],
              nick: t(lang, "voiceNick"), note: t(lang, "voiceNote"), send: t(lang, "voiceSend"), thanks: t(lang, "voiceThanks"), error: t(lang, "voiceError"),
            }}
          />
        ) : (
          <p className="note">{t(lang, "voiceClosed")}</p>
        )}
      </section>
      <section className="sec">
        <div className="sec-row"><h2>{t(lang, "voices")}</h2></div>
        {voices.length ? <VoiceList voices={voices} lang={lang} /> : <p className="note">{t(lang, "voicesEmpty")}</p>}
      </section>
    </div>
  );
}
