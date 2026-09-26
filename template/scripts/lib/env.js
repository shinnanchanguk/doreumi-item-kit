// Reads DORMS_ORIGIN / DORMS_ITEM_KEY from the environment, or from a local .env file.
// The key is a secret: this module never prints it and never writes it anywhere.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_DIR = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function readDotEnv() {
  const file = resolve(PROJECT_DIR, ".env");
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

/**
 * Who may receive the key: https://dorms.school (and its sub-sites), or this computer for local testing.
 * Any other https address needs DORMS_ALLOW_CUSTOM_ORIGIN=1, so a changed setting cannot quietly send the key away.
 */
export function parseOrigin(raw, { allowCustom = false } = {}) {
  let url;
  try { url = new URL(String(raw ?? "").trim()); } catch { return null; }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password) return null;
  const official = url.protocol === "https:" && (url.hostname === "dorms.school" || url.hostname.endsWith(".dorms.school"));
  if (!official && !local && !allowCustom) return null;
  return url.origin;
}

export function loadDormsEnv({ needKey = true } = {}) {
  const dot = readDotEnv();
  const originRaw = process.env.DORMS_ORIGIN ?? dot.DORMS_ORIGIN ?? "https://dorms.school";
  const key = (process.env.DORMS_ITEM_KEY ?? dot.DORMS_ITEM_KEY ?? "").trim();
  const allowCustom = (process.env.DORMS_ALLOW_CUSTOM_ORIGIN ?? dot.DORMS_ALLOW_CUSTOM_ORIGIN) === "1";
  const origin = parseOrigin(originRaw, { allowCustom });
  if (!origin) throw new Error("DORMS_ORIGIN 은 도름스 주소(https://dorms.school)여야 해요.");
  if (allowCustom && !/^https:\/\/([a-z0-9-]+\.)*dorms\.school$/.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
    console.log(`알림: 도름스가 아닌 주소(${origin})로 열쇠를 보내요. 직접 정한 주소가 맞는지 확인해 주세요.`);
  }
  if (needKey && !key) throw new Error("DORMS_ITEM_KEY 가 없어요. 도름스에서 받은 프롬프트의 열쇠를 환경 변수(또는 .env 파일)로 넣어 주세요.");
  if (needKey && /\s/.test(key)) throw new Error("DORMS_ITEM_KEY 모양이 이상해요. 복사할 때 빈칸이 섞이지 않았는지 확인해 주세요.");
  return { origin, key };
}
