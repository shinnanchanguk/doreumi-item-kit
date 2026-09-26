#!/usr/bin/env node
// npm run send [-- --previous <요청 id>]: check, then send the item to DoRms.
import { runCheck } from "./check.js";
import { loadDormsEnv } from "./lib/env.js";
import { clean } from "./lib/clean.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readPrevious(argv) {
  const index = argv.findIndex((arg) => arg === "--previous" || arg.startsWith("--previous="));
  if (index < 0) return null;
  const value = argv[index].includes("=") ? argv[index].split("=")[1] : argv[index + 1];
  if (!value || !UUID.test(value)) throw new Error("--previous 뒤에는 도름스가 알려 준 요청 id 를 그대로 적어 주세요.");
  return value;
}

async function main() {
  const previousId = readPrevious(process.argv.slice(2));
  const { origin, key } = loadDormsEnv();
  const { ok, meta, glb, webp } = runCheck();
  if (!ok) { process.exitCode = 1; console.log("검사를 통과하지 못해서 보내지 않았어요."); return; }

  const form = new FormData();
  form.append("file", new Blob([glb], { type: "model/gltf-binary" }), "item.glb");
  form.append("preview", new Blob([webp], { type: "image/webp" }), "preview.webp");
  form.append("meta", JSON.stringify({ ...meta, ...(previousId ? { previousId } : {}) }));

  console.log(previousId ? "고친 아이템을 도름스에 다시 보내는 중이에요." : "도름스에 아이템을 보내는 중이에요.");
  let response;
  try {
    response = await fetch(`${origin}/api/doreumi/item-requests`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, redirect: "error", signal: AbortSignal.timeout(60_000) });
  } catch {
    process.exitCode = 1; console.log("도름스에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 보내 주세요."); return;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    process.exitCode = 1;
    console.log(`보내지 못했어요(${response.status}). ${clean(body.error, 300) || "잠시 후 다시 해 주세요."}`);
    if (response.status === 401) console.log("열쇠가 맞지 않거나 만료됐을 수 있어요. 도름스에서 프롬프트를 다시 받아 주세요.");
    return;
  }
  console.log(clean(body.message, 300) || "요청을 보냈어요.");
  if (typeof body.id !== "string" || !UUID.test(body.id)) { console.log("요청은 보냈지만 요청 id 를 받지 못했어요. npm run status 로 확인해 주세요."); return; }
  const revision = Number.isInteger(body.revision) ? body.revision : 1;
  console.log(`요청 id: ${body.id}${revision > 1 ? ` (고친 판 ${revision})` : ""}`);
  console.log("고쳐 달라는 답이 오면 npm run send -- --previous " + body.id + " 로 다시 보내면 돼요.");
}

main().catch((error) => { process.exitCode = 1; console.log(error instanceof Error ? error.message : "알 수 없는 문제가 생겼어요."); });
