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

const $ = (id) => document.getElementById(id);
const status = (text, kind = "") => { const el = $("status"); el.textContent = text; el.dataset.kind = kind; };

const CLIPS = [["Idle", "가만히"], ["Walk", "걷기"], ["Sit", "앉기"], ["Wave", "손 흔들기"]];
const VIEWS = [["front", "앞"], ["side", "옆"], ["back", "뒤"]];
const TARGET = new THREE.Vector3(0, 1, 0);
let DISTANCE = 6;

function addLights(scene) {
  // Same lighting as the site's Doreumi renderer.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb4c3d7, 2.2));
  for (const [color, intensity, x, y, z] of [[0xfffbf5, 3.1, -3.2, 5.8, 4.6], [0xcfe2ff, 1.35, 4, 3, 1.5], [0x8faeff, 1.05, -3, 3.5, -4]]) {
    const light = new THREE.DirectionalLight(color, intensity); light.position.set(x, y, z); scene.add(light);
  }
}
function makeRenderer(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, ...options });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.03;
  renderer.setClearColor(0xf2ede4, 1);
  return renderer;
}
function viewPosition(view, distance = DISTANCE) {
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
}

async function main() {
  const canvas = $("stage");
  const renderer = makeRenderer(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  addLights(scene);
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
  window.__kit.glb = glb; window.__kit.worn = worn;

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
  toolbar.hidden = false;
  play("Idle");
  mixer.update(0.01); doreumi.model.updateMatrixWorld(true);
  frameOn(doreumi.model); controls.target.copy(TARGET); setView("front");

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize); resize();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => { mixer.update(Math.min(clock.getDelta(), 0.1)); controls.update(); renderer.render(scene, camera); });

  // Front image for the operator's review card: 512x512 WebP, Idle pose, <= 400KB.
  async function renderPreviewWebp() {
    const idle = doreumi.clips.find((c) => c.name === "Idle");
    const was = current;
    mixer.stopAllAction();
    if (idle) { const action = mixer.clipAction(idle); action.reset().play(); mixer.setTime(0.4); }
    doreumi.model.updateMatrixWorld(true);
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
  $("save").addEventListener("click", async () => {
    $("save").disabled = true;
    try {
      status("저장하는 중이에요.");
      const webp = await renderPreviewWebp();
      await save("item.glb", glb); await save("preview.webp", webp);
      status(`저장했어요: dist/item.glb (${Math.round(glb.byteLength / 1024)}KB), dist/preview.webp (${Math.round(webp.byteLength / 1024)}KB). 이제 터미널에서 npm run check 를 실행해 주세요.`, "ok");
      window.__kit.saved = { glb: glb.byteLength, webp: webp.byteLength };
    } catch (error) {
      status(error instanceof Error ? error.message : "저장하지 못했어요.", "error");
    } finally { $("save").disabled = false; }
  });

  const kind = config.rigged ? "몸 따라 움직이는 옷" : `뼈에 붙이는 장신구 (${config.bone})`;
  $("title").textContent = `${config.name || "이름 없는 아이템"} · ${kind}`;
  status("앞·옆·뒤와 걷기·앉기·손 흔들기로 돌려 보며 몸을 뚫거나 떠 있지 않은지 확인해 주세요. 마음에 들면 저장을 눌러 주세요.");
  window.__kit.ready = true;
}

main().catch((error) => {
  console.error(error);
  status(`문제가 생겼어요: ${error instanceof Error ? error.message : String(error)}`, "error");
  window.__kit = { ...(window.__kit ?? {}), error: String(error?.message ?? error) };
});
