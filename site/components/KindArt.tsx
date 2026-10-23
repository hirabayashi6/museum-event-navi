// 種類ごとの手描き風イラスト（館の写真は転載しないため、自前の絵で見た目をつくる）
import type { Kind } from "@/lib/types";

type Palette = { bg: string; ink: string; sub: string };

export const KIND_COLORS: Record<Kind | "その他", Palette> = {
  ワークショップ: { bg: "#ffe9a8", ink: "#2b2b2b", sub: "#e8743b" },
  "講座・公演・音楽イベント": { bg: "#d9ecff", ink: "#2b2b2b", sub: "#3d6fd6" },
  ギャラリートーク: { bg: "#ffe0e6", ink: "#2b2b2b", sub: "#d9536f" },
  "観察会・野外": { bg: "#dff3d8", ink: "#2b2b2b", sub: "#3c9a4e" },
  "特別展・企画展": { bg: "#efe6ff", ink: "#2b2b2b", sub: "#7a55c9" },
  常設展: { bg: "#ece8e1", ink: "#2b2b2b", sub: "#8a6f4d" },
  その他: { bg: "#eeeeee", ink: "#2b2b2b", sub: "#777777" },
};

const S = { fill: "none", strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Icon({ kind, ink, sub }: { kind: Kind | "その他"; ink: string; sub: string }) {
  switch (kind) {
    case "ワークショップ": // はさみと絵の具
      return (
        <g>
          <circle cx="58" cy="92" r="11" stroke={ink} {...S} />
          <circle cx="86" cy="96" r="11" stroke={ink} {...S} />
          <path d="M66 84 L112 40 M78 87 L118 52" stroke={ink} {...S} />
          <path d="M128 70 q14 -6 22 6 q6 12 -6 18 q-8 4 -6 12 q-14 -4 -16 -18 q-2 -12 6 -18z" fill={sub} opacity=".9" />
          <circle cx="140" cy="82" r="3.5" fill="#fff" />
          <path d="M40 120 q30 8 60 0 t60 2" stroke={sub} {...S} />
        </g>
      );
    case "講座・公演・音楽イベント": // ふきだしと音符
      return (
        <g>
          <path d="M44 46 h70 q10 0 10 10 v30 q0 10 -10 10 h-40 l-14 14 v-14 h-16 q-10 0 -10 -10 v-30 q0 -10 10 -10z" stroke={ink} {...S} />
          <path d="M62 66 h44 M62 78 h30" stroke={ink} {...S} />
          <path d="M140 48 v40 M140 48 l18 -6 v38" stroke={sub} {...S} />
          <ellipse cx="134" cy="90" rx="7" ry="5" fill={sub} />
          <ellipse cx="152" cy="82" rx="7" ry="5" fill={sub} />
        </g>
      );
    case "ギャラリートーク": // 額と人
      return (
        <g>
          <rect x="70" y="36" width="70" height="52" rx="2" stroke={ink} {...S} />
          <path d="M80 78 l16 -18 l12 12 l10 -8 l14 14" stroke={sub} {...S} />
          <circle cx="122" cy="52" r="5" fill={sub} />
          <circle cx="46" cy="72" r="9" stroke={ink} {...S} />
          <path d="M30 116 q0 -26 16 -26 q16 0 16 26" stroke={ink} {...S} />
          <path d="M58 84 l12 -8" stroke={ink} {...S} />
        </g>
      );
    case "観察会・野外": // 虫めがねと葉
      return (
        <g>
          <circle cx="76" cy="66" r="24" stroke={ink} {...S} />
          <path d="M94 84 l26 26" stroke={ink} strokeWidth={6} strokeLinecap="round" />
          <path d="M66 70 q10 -20 22 -12 q-6 14 -22 12z" fill={sub} />
          <path d="M66 70 l14 -9" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
          <path d="M132 46 q22 4 18 30 q-24 -2 -18 -30z" fill={sub} opacity=".85" />
          <path d="M134 50 q8 10 14 24" stroke="#fff" strokeWidth={1.8} fill="none" />
          <path d="M30 122 q20 -10 40 0 t40 0 t40 0" stroke={sub} {...S} />
        </g>
      );
    case "特別展・企画展": // 壺と台
      return (
        <g>
          <path d="M84 36 h28 M88 36 q-4 10 -12 18 q-14 16 -6 38 q6 14 28 14 q22 0 28 -14 q8 -22 -6 -38 q-8 -8 -12 -18" stroke={ink} {...S} />
          <path d="M80 70 q20 10 40 0" stroke={sub} {...S} />
          <path d="M60 114 h80 M70 106 h60" stroke={ink} {...S} />
          <path d="M40 40 l6 6 M46 40 l-6 6 M152 52 l6 6 M158 52 l-6 6" stroke={sub} {...S} />
        </g>
      );
    case "常設展": // 博物館の建物
      return (
        <g>
          <path d="M40 58 l60 -26 l60 26z" stroke={ink} {...S} />
          <path d="M52 64 v40 M76 64 v40 M100 64 v40 M124 64 v40 M148 64 v40" stroke={ink} {...S} />
          <path d="M40 112 h120" stroke={ink} {...S} />
          <circle cx="100" cy="47" r="4" fill={sub} />
        </g>
      );
    default:
      return (
        <g>
          <path d="M60 70 q40 -40 80 0 q-40 40 -80 0z" stroke={ink} {...S} />
          <circle cx="100" cy="70" r="8" fill={sub} />
        </g>
      );
  }
}

// 同じ種類でも単調にならないよう、催しごとに背景の色味・絵の向き・飾りを変える
const TINTS: Record<Kind | "その他", string[]> = {
  ワークショップ: ["#ffe9a8", "#ffd9b8", "#fff1c9"],
  "講座・公演・音楽イベント": ["#d9ecff", "#dfe3ff", "#d6f1f4"],
  ギャラリートーク: ["#ffe0e6", "#ffe6d8", "#f8e1f1"],
  "観察会・野外": ["#dff3d8", "#e9f2c6", "#d4efe3"],
  "特別展・企画展": ["#efe6ff", "#e6e9ff", "#f3e4f7"],
  常設展: ["#ece8e1", "#efe6d6", "#e5e8e3"],
  その他: ["#eeeeee", "#f2efe9", "#e9eef0"],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function KindArt({ kind, label, seed = "" }: { kind: Kind | null; label?: string; seed?: string }) {
  const k = kind ?? "その他";
  const c = KIND_COLORS[k];
  const h = hash(seed || k);
  const bg = TINTS[k][h % 3] ?? c.bg;
  const flip = (h >>> 2) % 2 === 1;
  const rot = ((h >>> 3) % 13) - 6;
  const scale = 0.88 + ((h >>> 5) % 5) * 0.04;
  const dots = [0, 1, 2, 3].map((i) => ({ x: 14 + ((h >>> (i * 4)) % 172), y: 12 + ((h >>> (i * 4 + 2)) % 116), r: 2 + ((h >>> (i + 7)) % 4) }));
  return (
    <svg viewBox="0 0 200 140" role="img" aria-label={label ?? k} className="art">
      <rect width="200" height="140" fill={bg} />
      {seed && dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={c.sub} opacity=".35" />)}
      <g transform={`translate(100 70) rotate(${seed ? rot : 0}) scale(${seed ? (flip ? -scale : scale) : 1} ${seed ? scale : 1}) translate(-100 -70)`}>
        <Icon kind={k} ink={c.ink} sub={c.sub} />
      </g>
    </svg>
  );
}
