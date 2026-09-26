// Item file rules. These mirror the DoRms server check (src/lib/doreumi/itemFile.ts and
// normalizeSlots in src/lib/doreumi/items.ts). Keep the two in step: if the server rule changes,
// change this file in the same way, otherwise `npm run check` would pass files the server rejects.
import { createHash } from "node:crypto";

export const ITEM_MAX_BYTES = 3 * 1024 * 1024;
export const PREVIEW_MAX_BYTES = 400 * 1024;
export const MAX_TRIANGLES = 40_000;
export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_NODES = 200;
export const ALLOWED_EXTENSIONS = new Set([
  "KHR_materials_emissive_strength",
  "KHR_texture_transform",
  "KHR_materials_unlit",
  "EXT_meshopt_compression",
  "KHR_mesh_quantization",
]);

/** Doreumi skin joints (rig-contract.json bones without the DoreumiRig holder). */
export const RIG_BONES = new Set([
  "root", "body", "torso", "head",
  "shoulderL", "armL", "elbowL", "wristL",
  "shoulderR", "armR", "elbowR", "wristR",
  "thighL", "kneeL", "shinL", "footL",
  "thighR", "kneeR", "shinR", "footR",
]);
/** Places a rigid item can hang from: every bone plus the model's extra points. */
export const ATTACH_POINTS = new Set([...RIG_BONES, "headAccessory", "palmL", "palmR", "lap"]);

export const SLOTS = [
  { id: "head", label: "머리" },
  { id: "face", label: "얼굴" },
  { id: "neck", label: "목" },
  { id: "top", label: "상의" },
  { id: "bottom", label: "하의" },
  { id: "shoes", label: "신발" },
  { id: "back", label: "등" },
  { id: "hand", label: "손" },
];
const SLOT_IDS = new Set(SLOTS.map((slot) => slot.id));

/** Same as normalizeSlots on the server: one slot, or ["top","bottom"] for a full outfit. */
export function normalizeSlots(value) {
  if (!Array.isArray(value)) return null;
  const slots = [...new Set(value)].filter((v) => typeof v === "string" && SLOT_IDS.has(v));
  if (slots.length !== value.length || slots.length < 1 || slots.length > 2) return null;
  if (slots.length === 2 && !(slots.includes("top") && slots.includes("bottom"))) return null;
  return slots;
}

const UNSAFE = /[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/g;
/** Same cleaning the server applies to name/description before storing them. */
export const cleanText = (value, max) =>
  typeof value === "string" ? Array.from(value.normalize("NFC").replace(UNSAFE, " ").trim()).slice(0, max).join("") : "";

/** Returns { ok: true, sha256, triangles, rigged } or { ok: false, reason }. Same order and wording as the server. */
export function checkItemGlb(bytes, meta) {
  if (bytes.byteLength < 20 || bytes.byteLength > ITEM_MAX_BYTES) return { ok: false, reason: "파일 크기는 3MB 이하여야 해요." };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) return { ok: false, reason: "glTF 2.0 바이너리(.glb) 파일이 아니에요." };
  if (view.getUint32(8, true) !== bytes.byteLength) return { ok: false, reason: "파일 길이가 머리글과 달라요." };
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength < 2 || 20 + jsonLength > bytes.byteLength) return { ok: false, reason: "파일 구조를 읽지 못했어요." };
  let gltf;
  try { gltf = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(20, 20 + jsonLength))); }
  catch { return { ok: false, reason: "파일 구조를 읽지 못했어요." }; }
  if (!gltf || typeof gltf !== "object" || gltf.asset?.version !== "2.0") return { ok: false, reason: "glTF 2.0 파일이 아니에요." };

  for (const name of [...(gltf.extensionsUsed ?? []), ...(gltf.extensionsRequired ?? [])]) {
    if (!ALLOWED_EXTENSIONS.has(name)) return { ok: false, reason: `쓸 수 없는 확장(${String(name).slice(0, 60)})이 들어 있어요.` };
  }
  if ((gltf.buffers ?? []).some((buffer) => buffer.uri !== undefined)) return { ok: false, reason: "바깥 파일을 부르는 부분이 있어요. 모두 한 파일에 담아 주세요." };
  const images = gltf.images ?? [];
  if (images.length > MAX_IMAGES) return { ok: false, reason: `그림은 ${MAX_IMAGES}장까지 넣을 수 있어요.` };
  for (const image of images) {
    if (image.uri !== undefined || typeof image.bufferView !== "number") return { ok: false, reason: "그림은 파일 안에 담아 주세요." };
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.mimeType ?? "")) return { ok: false, reason: "그림은 PNG·JPG·WebP 만 쓸 수 있어요." };
    if ((gltf.bufferViews?.[image.bufferView]?.byteLength ?? Infinity) > MAX_IMAGE_BYTES) return { ok: false, reason: "그림 한 장은 1MB 이하여야 해요." };
  }
  if ((gltf.nodes ?? []).length > MAX_NODES) return { ok: false, reason: "부품이 너무 많아요." };
  if ((gltf.animations ?? []).length) return { ok: false, reason: "아이템에는 동작을 넣지 않아요. 도름이 몸을 따라 움직여요." };

  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
    const mode = primitive.mode ?? 4;
    if (mode !== 4) return { ok: false, reason: "면(삼각형)으로 된 모양만 쓸 수 있어요." };
    const accessor = gltf.accessors?.[primitive.indices ?? primitive.attributes?.POSITION ?? -1];
    triangles += Math.floor((accessor?.count ?? 0) / 3);
  }
  if (!triangles) return { ok: false, reason: "모양이 비어 있어요." };
  if (triangles > MAX_TRIANGLES) return { ok: false, reason: `면이 너무 많아요(${triangles.toLocaleString("ko-KR")}개, ${MAX_TRIANGLES.toLocaleString("ko-KR")}개 이하).` };

  const skins = gltf.skins ?? [];
  if (meta.rigged) {
    if (!skins.length) return { ok: false, reason: "몸 따라 움직이는 옷인데 뼈대 연결이 없어요." };
    for (const skin of skins) for (const joint of skin.joints ?? []) {
      const name = gltf.nodes?.[joint]?.name ?? "";
      if (!RIG_BONES.has(name)) return { ok: false, reason: `도름이 뼈에 없는 관절(${name.slice(0, 40) || "이름 없음"})이 있어요.` };
    }
  } else {
    if (skins.length) return { ok: false, reason: "뼈대에 묶인 옷이면 '몸 따라 움직이는 옷'으로 보내 주세요." };
    if (!meta.bone || !ATTACH_POINTS.has(meta.bone)) return { ok: false, reason: "붙일 자리 이름이 도름이 몸에 없어요." };
  }
  if ((gltf.nodes ?? []).some((node) => node.name === "Doreumi")) return { ok: false, reason: "도름이 몸은 바꿀 수 없어요. 아이템만 담아 주세요." };

  return { ok: true, sha256: createHash("sha256").update(bytes).digest("hex"), triangles, rigged: meta.rigged };
}

export function checkPreviewWebp(bytes) {
  if (bytes.byteLength < 16 || bytes.byteLength > PREVIEW_MAX_BYTES) return "미리보기 그림은 400KB 이하여야 해요.";
  const tag = (offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP") return "미리보기 그림은 WebP 여야 해요.";
  return null;
}

/**
 * item.config.json check. Builds exactly the meta object `send` posts, using the server's own
 * cleaning, and lists every problem (not only the first) so the AI can fix them in one go.
 */
export function checkConfig(config) {
  const problems = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) return { problems: ["item.config.json 이 올바른 JSON 객체가 아니에요."], meta: null };
  const rawName = typeof config.name === "string" ? config.name : "";
  const name = cleanText(rawName, 30);
  if (!name) problems.push("이름(name)을 적어 주세요.");
  else if (Array.from(rawName.normalize("NFC").trim()).length > 30) problems.push("이름(name)은 30자 이하여야 해요.");
  if (config.description !== undefined && typeof config.description !== "string") problems.push("설명(description)은 글자로 적어 주세요.");
  const rawDescription = typeof config.description === "string" ? config.description : "";
  if (Array.from(rawDescription.normalize("NFC").trim()).length > 200) problems.push("설명(description)은 200자 이하여야 해요.");
  const slots = normalizeSlots(config.slots);
  if (!slots) problems.push('입는 자리(slots)는 ["head"] 처럼 한 자리, 한 벌 옷이면 ["top","bottom"] 이어야 해요. 쓸 수 있는 자리: ' + SLOTS.map((s) => `${s.id}(${s.label})`).join(", "));
  if (typeof config.rigged !== "boolean") problems.push("rigged 는 true(몸 따라 움직이는 옷) 또는 false(뼈에 붙이는 장신구)여야 해요.");
  const rigged = config.rigged === true;
  let bone = null;
  if (rigged) {
    if (config.bone !== null && config.bone !== undefined) problems.push("몸 따라 움직이는 옷(rigged: true)은 bone 을 null 로 두세요.");
  } else {
    bone = cleanText(config.bone, 64) || null;
    if (!bone || !ATTACH_POINTS.has(bone)) problems.push(`붙일 자리(bone)가 도름이 몸에 없어요. 쓸 수 있는 자리: ${[...ATTACH_POINTS].join(", ")}`);
  }
  const meta = { name, description: cleanText(rawDescription, 200), slots, rigged, bone };
  return { problems, meta };
}
