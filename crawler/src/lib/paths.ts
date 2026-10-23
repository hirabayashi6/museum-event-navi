import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../../..");
export const DATA = path.join(ROOT, "data");
export const MASTER_CSV = path.join(DATA, "master", "museums_event_sources.csv");
export const SOURCE_CSV = path.resolve(ROOT, "../museum-hp-da-research/新規営業_HP改修DA.csv");
export const MIYAZAKI_CSV = path.join(ROOT, "phase1_miyazaki", "棚卸し_宮崎41館.csv");
