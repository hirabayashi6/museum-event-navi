// 現在地（緯度・経度）から都道府県を決める。国土地理院の逆ジオコーダ（無料・登録不要）を使い、
// つながらないときは県庁の位置からいちばん近い県を選ぶ。位置はその場で使うだけで保存しない
import { PREFS } from "./types";

// 県庁のおおよその位置（PREFS と同じ順）
const CAPITALS: [number, number][] = [
  [43.064, 141.347], [40.824, 140.740], [39.704, 141.153], [38.269, 140.872], [39.719, 140.102], [38.240, 140.364], [37.750, 140.468],
  [36.342, 140.447], [36.566, 139.884], [36.391, 139.061], [35.857, 139.649], [35.605, 140.123], [35.690, 139.692], [35.448, 139.643],
  [37.902, 139.023], [36.695, 137.211], [36.595, 136.626], [36.065, 136.222], [35.664, 138.568], [36.651, 138.181], [35.391, 136.722],
  [34.977, 138.383], [35.180, 136.907], [34.730, 136.509], [35.004, 135.869], [35.021, 135.756], [34.686, 135.520], [34.691, 135.183],
  [34.685, 135.833], [34.226, 135.168], [35.504, 134.238], [35.472, 133.051], [34.662, 133.935], [34.397, 132.460], [34.186, 131.471],
  [34.066, 134.559], [34.340, 134.043], [33.842, 132.766], [33.560, 133.531], [33.607, 130.418], [33.249, 130.299], [32.745, 129.874],
  [32.790, 130.742], [33.238, 131.613], [31.911, 131.424], [31.560, 130.558], [26.212, 127.681],
];

const inJapan = (lat: number, lon: number) => lat > 20 && lat < 46 && lon > 122 && lon < 154;

function nearest(lat: number, lon: number): string {
  let best = 0, bestD = Infinity;
  CAPITALS.forEach(([a, b], i) => {
    const d = (a - lat) ** 2 + ((b - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return PREFS[best] ?? "";
}

export async function prefFromPosition(lat: number, lon: number): Promise<string | null> {
  if (!inJapan(lat, lon)) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = (await res.json()) as { results?: { muniCd?: string } };
    // 市区町村コードの上2桁が都道府県の番号（01 北海道〜47 沖縄県）
    const code = Number((data.results?.muniCd ?? "").slice(0, 2));
    // 答えが返ってきて市区町村が無いのは、日本の外（または海の上）
    return code >= 1 && code <= 47 ? (PREFS[code - 1] ?? null) : null;
  } catch {
    /* つながらないときは県庁の位置で決める */
  }
  return nearest(lat, lon);
}

// ブラウザの位置情報を1回だけ取る（精度は低めでよい）
export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject(new Error("unsupported")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 3_600_000 });
  });
}
