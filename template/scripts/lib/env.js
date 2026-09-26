// Reads DORMS_ORIGIN / DORMS_ITEM_KEY from the environment, or from a local .env file.
// The key is a secret: this module never prints it and never writes it anywhere.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PROJECT_DIR = resolve(new URL("../..", import.meta.url).pathname);

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

/** Only https, or plain http on this computer (for local testing), may receive the key. */
export function parseOrigin(raw) {
  let url;
  try { url = new URL(String(raw ?? "").trim()); } catch { return null; }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  if (url.username || url.password) return null;
  return url.origin;
}

export function loadDormsEnv({ needKey = true } = {}) {
  const dot = readDotEnv();
  const originRaw = process.env.DORMS_ORIGIN ?? dot.DORMS_ORIGIN ?? "https://dorms.school";
  const key = (process.env.DORMS_ITEM_KEY ?? dot.DORMS_ITEM_KEY ?? "").trim();
  const origin = parseOrigin(originRaw);
  if (!origin) throw new Error("DORMS_ORIGIN 은 https:// 로 시작하는 도름스 주소여야 해요.");
  if (needKey && !key) throw new Error("DORMS_ITEM_KEY 가 없어요. 도름스에서 받은 프롬프트의 열쇠를 환경 변수(또는 .env 파일)로 넣어 주세요.");
  if (needKey && /\s/.test(key)) throw new Error("DORMS_ITEM_KEY 모양이 이상해요. 복사할 때 빈칸이 섞이지 않았는지 확인해 주세요.");
  return { origin, key };
}
