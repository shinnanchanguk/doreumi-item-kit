// Preview page: Doreumi wearing the item, put on exactly the way the DoRms site does it
// (build -> export .glb -> load that file -> wear it). "저장" writes dist/item.glb and dist/preview.webp.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import config from "../item.config.json";
import { buildItem } from "./item.js";
import { createHelpers } from "./helpers.js";
import { loadDoreumi } from "./doreumi.js";
import { exportItem } from "./exportItem.js";
import { wearDressItem } from "./dress.js";
import { createItemLightPreview, createPreviewEnvironment } from "./light.js";
import { buildLineArt } from "./lineArt.js";
import * as DRAW from "./lineDraw.js";
import { checkLineArt, composeOutfit } from "../scripts/lib/lineArt.js";
import { figureSvgWith, FIGURE_THEMES } from "./lineFigure.js";

const $ = (id) => document.getElementById(id);
const status = (text, kind = "") => { const el = $("status"); el.textContent = text; el.dataset.kind = kind; };

const CLIPS = [["Idle", "가만히"], ["Walk", "걷기"], ["Sit", "앉기"], ["Wave", "손 흔들기"]];
const VIEWS = [["front", "앞"], ["side", "옆"], ["back", "뒤"]];
const TIMES = [["day", "낮"], ["night", "밤"]];
const TARGET = new THREE.Vector3(0, 1, 0);
let DISTANCE = 6;
let night = false;
const NIGHT_VIEW_SCALE = 1.6;

function makeRenderer(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, ...options });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.03;
  renderer.setClearColor(0xf2ede4, 1);
  return renderer;
}
function viewPosition(view, distance = DISTANCE) {
  distance *= night ? NIGHT_VIEW_SCALE : 1;
  const angle = view === "side" ? Math.PI / 2 : view === "back" ? Math.PI : 0;
  return new THREE.Vector3(Math.sin(angle) * distance, TARGET.y + distance * 0.08, Math.cos(angle) * distance);
}
/** Frames the camera on Doreumi as it stands in the Idle clip (the clips lift the rig off the rest pose). */
function frameOn(model) {
  const box = new THREE.Box3();
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.computeBoundingBox?.();
    const local = object.isSkinnedMesh ? object.boundingBox : (object.geometry.computeBoundingBox(), object.geometry.boundingBox);
    if (local) box.union(local.clone().applyMatrix4(object.matrixWorld));
  });
  const size = box.getSize(new THREE.Vector3());
  box.getCenter(TARGET);
  DISTANCE = (Math.max(size.y, size.x) * 0.62) / Math.tan(THREE.MathUtils.degToRad(15));
  return box;
}

async function main() {
  const canvas = $("stage");
  const renderer = makeRenderer(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const environment = createPreviewEnvironment(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(TARGET); controls.enablePan = false; controls.minDistance = 2; controls.maxDistance = 10;
  const setView = (view) => { camera.position.copy(viewPosition(view)); camera.lookAt(TARGET); controls.update(); };
  setView("front");

  status("도름이를 불러오는 중이에요.");
  const doreumi = await loadDoreumi();
  scene.add(doreumi.model);
  const helpers = createHelpers(doreumi);
  window.__kit = { THREE, doreumi, helpers, config };

  // 1) build in the rest pose  2) export the file  3) wear that file the site's way.
  status("아이템을 만드는 중이에요.");
  const object = await buildItem({ THREE, doreumi, helpers, config });
  if (!object?.isObject3D) throw new Error("src/item.js 의 buildItem 이 THREE.Object3D 를 돌려주지 않았어요.");
  const glb = await exportItem(object, { rigged: config.rigged === true, doreumi });
  const worn = await wearDressItem(doreumi.loader, doreumi.model, { id: "preview", bytes: glb, rigged: config.rigged === true, bone: config.bone });
  const itemLight = createItemLightPreview(scene, doreumi.model, worn, config.rigged === true);
  window.__kit.glb = glb; window.__kit.worn = worn;
  window.__kit.itemLight = itemLight; window.__kit.environment = environment;

  const mixer = new THREE.AnimationMixer(doreumi.model);
  let current = null;
  const play = (name) => {
    const clip = doreumi.clips.find((c) => c.name === name);
    if (!clip) return;
    const action = mixer.clipAction(clip);
    if (current && current !== action) { current.fadeOut(0.2); action.reset().fadeIn(0.2).play(); }
    else action.reset().play();
    current = action;
    for (const button of document.querySelectorAll("[data-clip]")) button.setAttribute("aria-pressed", String(button.dataset.clip === name));
  };

  const toolbar = $("tools");
  for (const [view, label] of VIEWS) {
    const button = document.createElement("button"); button.textContent = label; button.dataset.view = view;
    button.addEventListener("click", () => setView(view)); $("views").append(button);
  }
  for (const [clip, label] of CLIPS) {
    const button = document.createElement("button"); button.textContent = label; button.dataset.clip = clip;
    button.addEventListener("click", () => play(clip)); $("clips").append(button);
  }
  const setTime = (time) => {
    const next = time === "night";
    if (next !== night) {
      camera.position.sub(controls.target).multiplyScalar(next ? NIGHT_VIEW_SCALE : 1 / NIGHT_VIEW_SCALE).add(controls.target);
      controls.minDistance = 2 * (next ? NIGHT_VIEW_SCALE : 1);
      controls.maxDistance = 10 * (next ? NIGHT_VIEW_SCALE : 1);
      night = next; controls.update();
    }
    environment.setNight(time === "night");
    itemLight.setNight(time === "night");
    for (const button of document.querySelectorAll("[data-time]")) button.setAttribute("aria-pressed", String(button.dataset.time === time));
  };
  for (const [time, label] of TIMES) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.dataset.time = time;
    button.addEventListener("click", () => setTime(time)); $("times").append(button);
  }
  setTime("day");
  toolbar.hidden = false;
  play("Idle");
  mixer.update(0.01); doreumi.model.updateMatrixWorld(true);
  const bounds = frameOn(doreumi.model);
  environment.floor.position.y = bounds.min.y - 0.02;
  controls.target.copy(TARGET); setView("front");

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize); resize();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    mixer.update(Math.min(clock.getDelta(), 0.1));
    itemLight.update(); controls.update(); renderer.render(scene, camera);
  });
  if (import.meta.hot) import.meta.hot.dispose(() => {
    renderer.setAnimationLoop(null); window.removeEventListener("resize", resize);
    itemLight.dispose(); environment.dispose(); controls.dispose(); renderer.dispose();
  });

  // Front image for the operator's review card: 512x512 WebP, Idle pose, <= 400KB.
  async function renderPreviewWebp() {
    const idle = doreumi.clips.find((c) => c.name === "Idle");
    const was = current;
    mixer.stopAllAction();
    if (idle) { const action = mixer.clipAction(idle); action.reset().play(); mixer.setTime(0.4); }
    doreumi.model.updateMatrixWorld(true);
    itemLight.update();
    const offscreen = document.createElement("canvas"); offscreen.width = 512; offscreen.height = 512;
    const shot = makeRenderer(offscreen, { preserveDrawingBuffer: true });
    shot.setPixelRatio(1); shot.setSize(512, 512, false);
    const shotCamera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    shotCamera.position.copy(viewPosition("front", DISTANCE * 1.02)); shotCamera.lookAt(TARGET);
    shot.render(scene, shotCamera);
    let blob = null;
    for (const quality of [0.92, 0.8, 0.65, 0.5, 0.35]) {
      blob = await new Promise((resolve) => offscreen.toBlob(resolve, "image/webp", quality));
      if (blob && blob.type === "image/webp" && blob.size <= 400 * 1024) break;
    }
    shot.forceContextLoss(); shot.dispose();
    if (blob && blob.size > 400 * 1024) { mixer.stopAllAction(); current = null; play(was?.getClip().name ?? "Idle"); throw new Error("미리보기 그림이 400KB 를 넘어요. 그림(무늬)을 줄여 주세요."); }
    mixer.stopAllAction(); current = null; play(was?.getClip().name ?? "Idle");
    if (!blob || blob.type !== "image/webp") throw new Error("이 브라우저는 WebP 저장을 못 해요. 크롬이나 엣지에서 열어 주세요.");
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function save(name, bytes) {
    const response = await fetch(`/__kit/save?file=${name}`, { method: "POST", body: bytes, headers: { "Content-Type": "application/octet-stream" } });
    if (!response.ok) throw new Error(`${name} 저장 실패(${response.status})`);
    return response.json();
  }
  // ── 링크트리 선 그림(src/lineArt.js) ──
  // 링크트리 사물함 위 선 그림 도름이가 이 아이템을 입은 모습. 3D 와 나란히 보며 다듬고, 저장하면 dist/line.json 이 된다.
  const line = await setUpLineArt(config);
  window.__kit.line = line;

  $("save").addEventListener("click", async () => {
    $("save").disabled = true;
    try {
      if (!line.ok) throw new Error(`선 그림을 먼저 고쳐 주세요: ${line.reason}`);
      status("저장하는 중이에요.");
      const webp = await renderPreviewWebp();
      const lineBytes = new TextEncoder().encode(JSON.stringify(line.art));
      await save("item.glb", glb); await save("preview.webp", webp); await save("line.json", lineBytes);
      status(`저장했어요: dist/item.glb (${Math.round(glb.byteLength / 1024)}KB), dist/preview.webp (${Math.round(webp.byteLength / 1024)}KB), dist/line.json (${Math.max(1, Math.round(lineBytes.byteLength / 1024))}KB). 이제 터미널에서 npm run check 를 실행해 주세요.`, "ok");
      window.__kit.saved = { glb: glb.byteLength, webp: webp.byteLength, line: lineBytes.byteLength };
    } catch (error) {
      status(error instanceof Error ? error.message : "저장하지 못했어요.", "error");
    } finally { $("save").disabled = false; }
  });

  const kind = config.rigged ? "몸 따라 움직이는 옷" : `뼈에 붙이는 장신구 (${config.bone})`;
  $("title").textContent = `${config.name || "이름 없는 아이템"} · ${kind}`;
  status(itemLight.lights.length
    ? "앞·옆·뒤와 동작을 확인하고, 밤을 눌러 빛이 비추는 자리도 봐 주세요. 저장하면 지금 고른 낮·밤 모습이 미리보기 그림에 담겨요."
    : "앞·옆·뒤와 걷기·앉기·손 흔들기로 돌려 보며 몸을 뚫거나 떠 있지 않은지 확인해 주세요. 마음에 들면 저장을 눌러 주세요.");
  if (!line.ok) status(`선 그림 문제: ${line.reason} (src/lineArt.js 를 고치면 다시 그려요)`, "error");
  window.__kit.ready = true;
}

/**
 * '3D | 선 그림' 보기 전환과 선 그림 화면. 큰 그림(좌표 격자)과 링크트리에 실제로 보이는 크기(컴퓨터 67px · 휴대폰 40px,
 * 밝은 · 어두운 화면)를 함께 보여 준다. 손 아이템은 오른손 · 왼손 두 모습. 고른 보기는 저장해 다시 그려도 그대로.
 */
async function setUpLineArt(config) {
  let rig = null;
  try { const response = await fetch("/__doreumi/line-rig.json"); if (response.ok) rig = (await response.json()).rig ?? null; } catch { /* below */ }
  let result;
  try { result = checkLineArt(await buildLineArt(DRAW)); }
  catch (error) { result = { ok: false, reason: `src/lineArt.js 를 실행하지 못했어요: ${error instanceof Error ? error.message : String(error)}` }; }
  const slots = Array.isArray(config.slots) ? config.slots : [];
  const isHand = slots.includes("hand");
  const outfitFor = (hand) => result.ok ? composeOutfit([{ art: result.art, slots, ...(isHand ? { hand } : {}) }]) : null;
  const section = $("line");
  const figure = (svg, caption) => `<figure>${svg}<figcaption>${caption}</figcaption></figure>`;
  if (!rig) {
    section.innerHTML = `<p class="hint">선 그림 도름이 뼈대(.doreumi/line-rig.json)가 없어요. 터미널에서 npm run model 로 다시 받아 주세요.</p>`;
  } else {
    const right = outfitFor("rightHand"), left = isHand ? outfitFor("leftHand") : null;
    const big = (o) => figureSvgWith(rig, o, { doreumiPx: 400, strokePx: 1.3, background: true, grid: true });
    const real = (o, px, theme) => figureSvgWith(rig, o, { doreumiPx: px, theme: FIGURE_THEMES[theme], strokePx: 0.9, background: true });
    section.innerHTML = [
      result.ok ? "" : `<p class="hint" role="alert"><strong>선 그림 문제:</strong> ${String(result.reason).replace(/</g, "")}</p>`,
      `<div class="figs">${figure(big(right), isHand ? "오른손에 들었을 때(화면 왼쪽)" : "링크트리 선 그림 · 격자 숫자는 src/lineArt.js 의 좌표")}${left ? figure(big(left), "왼손에 들었을 때(화면 오른쪽)") : ""}</div>`,
      `<div class="real">${figure(real(right, 67, "light"), "컴퓨터 크기")}${figure(real(right, 67, "dark"), "어두운 화면")}${figure(real(right, 40, "light"), "휴대폰 크기")}${figure(real(right, 40, "dark"), "어두운 화면")}</div>`,
      `<p class="hint">링크트리에서 실제로 보이는 크기예요. 이 크기에서도 무엇인지 알아볼 수 있어야 해요. src/lineArt.js 를 저장하면 다시 그려요.</p>`,
    ].join("");
  }
  const modes = [["3d", "3D"], ["line", "선 그림"]];
  const KEY = "doreumi-kit-view";
  const setMode = (mode) => {
    $("stage").hidden = mode === "line";
    section.hidden = mode !== "line";
    for (const id of ["views", "clips", "times"]) $(id).hidden = mode === "line";
    for (const button of document.querySelectorAll("[data-mode]")) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    try { sessionStorage.setItem(KEY, mode); } catch { /* private window */ }
    if (mode === "3d") window.dispatchEvent(new Event("resize"));
  };
  for (const [mode, label] of modes) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.dataset.mode = mode;
    button.addEventListener("click", () => setMode(mode)); $("modes").append(button);
  }
  let saved = "3d";
  try { saved = sessionStorage.getItem(KEY) === "line" ? "line" : "3d"; } catch { /* private window */ }
  setMode(saved);
  if (!result.ok) status(`선 그림 문제: ${result.reason}`, "error");
  return result;
}

main().catch((error) => {
  console.error(error);
  status(`문제가 생겼어요: ${error instanceof Error ? error.message : String(error)}`, "error");
  window.__kit = { ...(window.__kit ?? {}), error: String(error?.message ?? error) };
});
