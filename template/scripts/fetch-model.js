#!/usr/bin/env node
// Fetches the Doreumi model into .doreumi/ (never committed). Runs before `npm run preview`.
//   DOREUMI_MODEL_FILE=/path/doreumi-master.glb  -> use a local copy, no network (testing).
//   otherwise GET ${DORMS_ORIGIN}/api/doreumi/kit/model with the item key, then download the model.
//   --refresh downloads again even when a cached copy exists.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadDormsEnv, PROJECT_DIR } from "./lib/env.js";

const CACHE = resolve(PROJECT_DIR, ".doreumi");
const MODEL = resolve(CACHE, "doreumi-master.glb");
const INFO = resolve(CACHE, "kit.json");
const MAX_MODEL_BYTES = 40 * 1024 * 1024;
const MAX_TEXTURE_BYTES = 2 * 1024 * 1024;

export const RIGHTS = [
  "도름이 캐릭터·모델·표정·동작 자산의 권리는 아인T에게 있어요.",
  "받은 모델은 도름스 아이템을 만들고 미리 보는 데만 쓸 수 있어요.",
  "다시 배포하거나, 다른 곳에 올리거나, 상업적으로 쓰거나, 다른 캐릭터에 쓰면 안 돼요.",
];

/** Returns the rig signature stored in the model, or null when the file is not a Doreumi model. */
function modelSignature(bytes) {
  if (bytes.byteLength < 20) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) return null;
  const length = view.getUint32(12, true);
  if (20 + length > bytes.byteLength) return null;
  try {
    const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
    const hasBody = (gltf.nodes ?? []).some((node) => node.name === "Doreumi" && node.skin !== undefined);
    return hasBody ? String(gltf.scenes?.[gltf.scene ?? 0]?.extras?.doreumiRigSignature ?? "unknown") : null;
  } catch { return null; }
}

async function download(url, max, headers = {}) {
  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw Object.assign(new Error(`download ${response.status}`), { status: response.status });
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > max) throw new Error("too large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > max) throw new Error("too large");
  return bytes;
}

function writeAtomic(path, bytes) {
  const temp = `${path}.part`;
  writeFileSync(temp, bytes);
  renameSync(temp, path);
}

export async function fetchModel({ refresh = false } = {}) {
  mkdirSync(CACHE, { recursive: true });
  const localFile = process.env.DOREUMI_MODEL_FILE;
  if (localFile) {
    const bytes = new Uint8Array(readFileSync(localFile));
    const signature = modelSignature(bytes);
    if (!signature) throw new Error("DOREUMI_MODEL_FILE 이 도름이 모델(.glb)이 아니에요.");
    copyFileSync(localFile, MODEL);
    // The face textures sit next to the model on the site (face-skin.webp, expressions/neutral.webp).
    const dir = dirname(localFile);
    for (const [from, to] of [["face-skin.webp", "face-skin.webp"], ["expressions/neutral.webp", "face-neutral.webp"]]) {
      const source = resolve(dir, from);
      if (existsSync(source)) copyFileSync(source, resolve(CACHE, to));
    }
    writeFileSync(INFO, JSON.stringify({ source: "local", rigSignature: signature, rights: RIGHTS.join(" ") }, null, 2));
    return { cached: false, signature };
  }

  if (!refresh && existsSync(MODEL) && existsSync(INFO)) {
    const signature = modelSignature(new Uint8Array(readFileSync(MODEL)));
    const info = JSON.parse(readFileSync(INFO, "utf8"));
    if (signature && signature === info.rigSignature) return { cached: true, signature };
  }

  const { origin, key } = loadDormsEnv();
  let response;
  try {
    response = await fetch(`${origin}/api/doreumi/kit/model`, { headers: { Authorization: `Bearer ${key}` }, redirect: "error", signal: AbortSignal.timeout(30_000) });
  } catch { throw new Error("도름스에 연결하지 못했어요. 인터넷 연결과 DORMS_ORIGIN 을 확인해 주세요."); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = typeof body.error === "string" ? body.error.slice(0, 200) : "";
    throw new Error(`도름이 모델을 받지 못했어요(${response.status}). ${reason}`.trim());
  }
  // Only download from the same DoRms site, and never send the key along with the file request.
  const sameSite = (value) => { try { const url = new URL(value); return url.origin === origin ? url.href : null; } catch { return null; } };
  const modelUrl = sameSite(body.model);
  if (!modelUrl) throw new Error("도름스가 알려 준 모델 주소가 이상해요. 잠시 후 다시 해 주세요.");
  const bytes = await download(modelUrl, MAX_MODEL_BYTES);
  const signature = modelSignature(bytes);
  if (!signature) throw new Error("받은 파일이 도름이 모델이 아니에요.");
  if (typeof body.rigSignature === "string" && signature !== body.rigSignature) throw new Error("받은 모델의 뼈대 표식이 도름스와 달라요. 잠시 후 --refresh 로 다시 받아 주세요.");
  writeAtomic(MODEL, bytes);

  const faceSkin = sameSite(body.faceSkin);
  if (faceSkin) {
    for (const [url, name] of [[faceSkin, "face-skin.webp"], [new URL("expressions/neutral.webp", faceSkin).href, "face-neutral.webp"]]) {
      try { writeAtomic(resolve(CACHE, name), await download(url, MAX_TEXTURE_BYTES)); } catch { /* the preview works without the face */ }
    }
  }
  const rights = typeof body.rights === "string" ? body.rights.slice(0, 1000) : RIGHTS.join(" ");
  writeFileSync(INFO, JSON.stringify({ source: origin, rigSignature: signature, attachPoints: Array.isArray(body.attachPoints) ? body.attachPoints.slice(0, 64) : undefined, rights }, null, 2));
  return { cached: false, signature };
}

if (process.argv[1]?.endsWith("fetch-model.js")) {
  fetchModel({ refresh: process.argv.includes("--refresh") }).then(({ cached }) => {
    console.log(cached ? "도름이 모델: 받아 둔 것을 써요." : "도름이 모델을 받았어요(.doreumi 폴더, 깃에 올리지 않아요).");
    console.log("알림: " + RIGHTS.join(" "));
  }).catch((error) => {
    process.exitCode = 1;
    console.log(error instanceof Error ? error.message : "도름이 모델을 받지 못했어요.");
  });
}
