#!/usr/bin/env node
// npm run check: the same checks the DoRms server runs, on dist/item.glb, dist/preview.webp, dist/line.json and item.config.json.
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_DIR } from "./lib/env.js";
import { checkConfig, checkItemGlb, checkPreviewWebp, ITEM_MAX_BYTES, PREVIEW_MAX_BYTES } from "./lib/rules.js";
import { checkLineArt, LINE_ART_LIMITS } from "./lib/lineArt.js";

/** Runs every check and prints Korean pass/fail lines. Returns { ok, meta, glb, webp, line }. */
export function runCheck({ dir = PROJECT_DIR, quiet = false } = {}) {
  const say = (line) => { if (!quiet) console.log(line); };
  const pass = (text) => say(`  통과  ${text}`);
  const fail = (text) => say(`  실패  ${text}`);
  let ok = true;
  say("도름이 아이템 검사");

  let config = null;
  const configPath = resolve(dir, "item.config.json");
  try { config = JSON.parse(readFileSync(configPath, "utf8")); }
  catch { fail("item.config.json 을 읽지 못했어요. JSON 모양을 확인해 주세요."); ok = false; }
  let meta = null;
  if (config) {
    const result = checkConfig(config);
    meta = result.meta;
    if (result.problems.length) { ok = false; for (const problem of result.problems) fail(problem); }
    else pass(`설정: 이름 "${meta.name}", 자리 ${meta.slots.join("+")}, ${meta.rigged ? "몸 따라 움직이는 옷" : `뼈에 붙이는 장신구(${meta.bone})`}${meta.price ? `, 희망 가격 ${meta.price}도름` : ""}`);
  }

  let glb = null;
  const glbPath = resolve(dir, "dist/item.glb");
  if (!existsSync(glbPath)) { fail("dist/item.glb 가 없어요. npm run preview 에서 '저장'을 눌러 만들어 주세요."); ok = false; }
  else if (statSync(glbPath).size > ITEM_MAX_BYTES) { fail("파일 크기는 3MB 이하여야 해요."); ok = false; }
  else {
    glb = new Uint8Array(readFileSync(glbPath));
    if (meta) {
      const checked = checkItemGlb(glb, { rigged: meta.rigged, bone: meta.bone });
      if (checked.ok) pass(`아이템 파일: ${(glb.byteLength / 1024).toFixed(0)}KB, 면 ${checked.triangles.toLocaleString("ko-KR")}개`);
      else { fail(`아이템 파일: ${checked.reason}`); ok = false; }
    } else { fail("설정을 먼저 고쳐야 아이템 파일을 검사할 수 있어요."); ok = false; }
  }

  let webp = null;
  const webpPath = resolve(dir, "dist/preview.webp");
  if (!existsSync(webpPath)) { fail("dist/preview.webp 가 없어요. npm run preview 에서 '저장'을 눌러 만들어 주세요."); ok = false; }
  else if (statSync(webpPath).size > PREVIEW_MAX_BYTES) { fail("미리보기 그림은 400KB 이하여야 해요."); ok = false; }
  else {
    webp = new Uint8Array(readFileSync(webpPath));
    const problem = checkPreviewWebp(webp);
    if (problem) { fail(`미리보기 그림: ${problem}`); ok = false; }
    else pass(`미리보기 그림: ${(webp.byteLength / 1024).toFixed(0)}KB WebP`);
  }

  // Linktree line art (src/lineArt.js → dist/line.json). DoRms shows it on every linktree where a teacher wears the item.
  let line = null;
  const linePath = resolve(dir, "dist/line.json");
  if (!existsSync(linePath)) { fail("dist/line.json(링크트리 선 그림)이 없어요. npm run preview 의 '선 그림'에서 확인하고 '저장'을 눌러 주세요."); ok = false; }
  else if (statSync(linePath).size > LINE_ART_LIMITS.bytes) { fail("선 그림 파일은 64KB 이하여야 해요."); ok = false; }
  else {
    let parsed = null;
    try { parsed = JSON.parse(readFileSync(linePath, "utf8")); } catch { /* below */ }
    const checked = parsed ? checkLineArt(parsed) : { ok: false, reason: "JSON 모양이 아니에요." };
    if (!checked.ok) { fail(`선 그림: ${checked.reason}`); ok = false; }
    else {
      line = new TextEncoder().encode(JSON.stringify(checked.art));
      const count = Object.values(checked.art.layers).reduce((total, list) => total + list.length, 0);
      pass(`선 그림: 경로 ${count}개 · ${Object.keys(checked.art.layers).join(", ")} 층`);
    }
  }

  say(ok ? "모두 통과했어요. 선생님이 좋다고 하셨으면 npm run send 로 보낼 수 있어요." : "고칠 곳이 있어요. 위의 실패 줄을 고친 뒤 다시 검사해 주세요.");
  return { ok, meta, glb, webp, line };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check.js")) {
  const { ok } = runCheck();
  process.exitCode = ok ? 0 : 1;
}
