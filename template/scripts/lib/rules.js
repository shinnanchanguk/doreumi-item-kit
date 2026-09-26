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
export const MAX_IMAGE_SIDE = 2048;
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

/** Returns { ok: true, sha256, triangles, rigged } or { ok: false, reason }. Generated from the site (src/lib/doreumi/itemFile.ts): same order and wording. */
export function checkItemGlb(bytes, meta) {
  if (bytes.byteLength < 20 || bytes.byteLength > ITEM_MAX_BYTES) return { ok: false, reason: "\uD30C\uC77C \uD06C\uAE30\uB294 3MB \uC774\uD558\uC5EC\uC57C \uD574\uC694." };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 1179937895 || view.getUint32(4, true) !== 2) return { ok: false, reason: "glTF 2.0 \uBC14\uC774\uB108\uB9AC(.glb) \uD30C\uC77C\uC774 \uC544\uB2C8\uC5D0\uC694." };
  if (view.getUint32(8, true) !== bytes.byteLength) return { ok: false, reason: "\uD30C\uC77C \uAE38\uC774\uAC00 \uBA38\uB9AC\uAE00\uACFC \uB2EC\uB77C\uC694." };
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 1313821514 || jsonLength < 2 || 20 + jsonLength > bytes.byteLength) return { ok: false, reason: "\uD30C\uC77C \uAD6C\uC870\uB97C \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694." };
  let gltf;
  try {
    gltf = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(20, 20 + jsonLength)));
  } catch {
    return { ok: false, reason: "\uD30C\uC77C \uAD6C\uC870\uB97C \uC77D\uC9C0 \uBABB\uD588\uC5B4\uC694." };
  }
  if (!gltf || typeof gltf !== "object" || gltf.asset?.version !== "2.0") return { ok: false, reason: "glTF 2.0 \uD30C\uC77C\uC774 \uC544\uB2C8\uC5D0\uC694." };
  const declared = new Set(gltf.extensionsUsed ?? []);
  for (const name of [...declared, ...gltf.extensionsRequired ?? []]) {
    if (!ALLOWED_EXTENSIONS.has(name)) return { ok: false, reason: `\uC4F8 \uC218 \uC5C6\uB294 \uD655\uC7A5(${String(name).slice(0, 60)})\uC774 \uB4E4\uC5B4 \uC788\uC5B4\uC694.` };
  }
  const hidden = findExtensionKeys(gltf).find((name) => !ALLOWED_EXTENSIONS.has(name) || !declared.has(name));
  if (hidden) return { ok: false, reason: `\uC4F8 \uC218 \uC5C6\uB294 \uD655\uC7A5(${hidden.slice(0, 60)})\uC774 \uB4E4\uC5B4 \uC788\uC5B4\uC694.` };
  if ((gltf.buffers ?? []).some((buffer) => buffer.uri !== void 0)) return { ok: false, reason: "\uBC14\uAE65 \uD30C\uC77C\uC744 \uBD80\uB974\uB294 \uBD80\uBD84\uC774 \uC788\uC5B4\uC694. \uBAA8\uB450 \uD55C \uD30C\uC77C\uC5D0 \uB2F4\uC544 \uC8FC\uC138\uC694." };
  const images = gltf.images ?? [];
  if (images.length > MAX_IMAGES) return { ok: false, reason: `\uADF8\uB9BC\uC740 ${MAX_IMAGES}\uC7A5\uAE4C\uC9C0 \uB123\uC744 \uC218 \uC788\uC5B4\uC694.` };
  for (const image of images) {
    if (image.uri !== void 0 || typeof image.bufferView !== "number") return { ok: false, reason: "\uADF8\uB9BC\uC740 \uD30C\uC77C \uC548\uC5D0 \uB2F4\uC544 \uC8FC\uC138\uC694." };
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.mimeType ?? "")) return { ok: false, reason: "\uADF8\uB9BC\uC740 PNG\xB7JPG\xB7WebP \uB9CC \uC4F8 \uC218 \uC788\uC5B4\uC694." };
    const view2 = gltf.bufferViews?.[image.bufferView];
    if ((view2?.byteLength ?? Infinity) > MAX_IMAGE_BYTES) return { ok: false, reason: "\uADF8\uB9BC \uD55C \uC7A5\uC740 1MB \uC774\uD558\uC5EC\uC57C \uD574\uC694." };
    const size = imageSize(binChunk(bytes, jsonLength)?.subarray(view2?.byteOffset ?? 0, (view2?.byteOffset ?? 0) + (view2?.byteLength ?? 0)));
    if (!size || size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) return { ok: false, reason: `\uADF8\uB9BC \uD06C\uAE30\uB294 \uAC00\uB85C\uC138\uB85C ${MAX_IMAGE_SIDE}\uD53D\uC140 \uC774\uD558\uC5EC\uC57C \uD574\uC694.` };
  }
  if ((gltf.nodes ?? []).length > MAX_NODES) return { ok: false, reason: "\uBD80\uD488\uC774 \uB108\uBB34 \uB9CE\uC544\uC694." };
  if ((gltf.animations ?? []).length) return { ok: false, reason: "\uC544\uC774\uD15C\uC5D0\uB294 \uB3D9\uC791\uC744 \uB123\uC9C0 \uC54A\uC544\uC694. \uB3C4\uB984\uC774 \uBAB8\uC744 \uB530\uB77C \uC6C0\uC9C1\uC5EC\uC694." };
  const meshTriangles = [];
  for (const mesh of gltf.meshes ?? []) {
    let count = 0;
    for (const primitive of mesh.primitives ?? []) {
      if ((primitive.mode ?? 4) !== 4) return { ok: false, reason: "\uBA74(\uC0BC\uAC01\uD615)\uC73C\uB85C \uB41C \uBAA8\uC591\uB9CC \uC4F8 \uC218 \uC788\uC5B4\uC694." };
      if (primitive.targets?.length) return { ok: false, reason: "\uBAA8\uC591\uC774 \uBC14\uB00C\uB294 \uBD80\uD488(morph)\uC740 \uC4F8 \uC218 \uC5C6\uC5B4\uC694." };
      const accessor = gltf.accessors?.[primitive.indices ?? primitive.attributes?.POSITION ?? -1];
      count += Math.floor((accessor?.count ?? 0) / 3);
    }
    meshTriangles.push(count);
  }
  let triangles = 0;
  for (const node of gltf.nodes ?? []) if (typeof node.mesh === "number") triangles += meshTriangles[node.mesh] ?? 0;
  if (!triangles) return { ok: false, reason: "\uBAA8\uC591\uC774 \uBE44\uC5B4 \uC788\uC5B4\uC694." };
  if (triangles > MAX_TRIANGLES) return { ok: false, reason: `\uBA74\uC774 \uB108\uBB34 \uB9CE\uC544\uC694(${triangles.toLocaleString("ko-KR")}\uAC1C, ${MAX_TRIANGLES.toLocaleString("ko-KR")}\uAC1C \uC774\uD558).` };
  const skins = gltf.skins ?? [];
  if (meta.rigged) {
    if (!skins.length) return { ok: false, reason: "\uBAB8 \uB530\uB77C \uC6C0\uC9C1\uC774\uB294 \uC637\uC778\uB370 \uBF08\uB300 \uC5F0\uACB0\uC774 \uC5C6\uC5B4\uC694." };
    for (const skin of skins) for (const joint of skin.joints ?? []) {
      const name = gltf.nodes?.[joint]?.name ?? "";
      if (!RIG_BONES.has(name)) return { ok: false, reason: `\uB3C4\uB984\uC774 \uBF08\uC5D0 \uC5C6\uB294 \uAD00\uC808(${name.slice(0, 40) || "\uC774\uB984 \uC5C6\uC74C"})\uC774 \uC788\uC5B4\uC694.` };
    }
  } else {
    if (skins.length) return { ok: false, reason: "\uBF08\uB300\uC5D0 \uBB36\uC778 \uC637\uC774\uBA74 '\uBAB8 \uB530\uB77C \uC6C0\uC9C1\uC774\uB294 \uC637'\uC73C\uB85C \uBCF4\uB0B4 \uC8FC\uC138\uC694." };
    if (!meta.bone || !ATTACH_POINTS.has(meta.bone)) return { ok: false, reason: "\uBD99\uC77C \uC790\uB9AC \uC774\uB984\uC774 \uB3C4\uB984\uC774 \uBAB8\uC5D0 \uC5C6\uC5B4\uC694." };
    const reserved = (gltf.nodes ?? []).find((node) => node.name && (ATTACH_POINTS.has(node.name) || node.name === "DoreumiRig" || node.name.startsWith("Doreumi")));
    if (reserved) return { ok: false, reason: `\uBD80\uD488 \uC774\uB984(${String(reserved.name).slice(0, 40)})\uC740 \uB3C4\uB984\uC774 \uBAB8\uC5D0\uC11C \uC4F0\uB294 \uC774\uB984\uC774\uB77C \uBC14\uAFD4 \uC8FC\uC138\uC694.` };
  }
  if ((gltf.nodes ?? []).some((node) => node.name === "Doreumi")) return { ok: false, reason: "\uB3C4\uB984\uC774 \uBAB8\uC740 \uBC14\uAFC0 \uC218 \uC5C6\uC5B4\uC694. \uC544\uC774\uD15C\uB9CC \uB2F4\uC544 \uC8FC\uC138\uC694." };
  return { ok: true, sha256: createHash("sha256").update(bytes).digest("hex"), triangles, rigged: meta.rigged };
}
function findExtensionKeys(value, depth = 0, out = []) {
  if (depth > 12 || !value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) findExtensionKeys(item, depth + 1, out);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "extensions" && child && typeof child === "object") out.push(...Object.keys(child));
    findExtensionKeys(child, depth + 1, out);
  }
  return out;
}
function binChunk(bytes, jsonLength) {
  const start = 20 + jsonLength;
  if (start + 8 > bytes.byteLength) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(start, true);
  if (view.getUint32(start + 4, true) !== 5130562 || start + 8 + length > bytes.byteLength) return null;
  return bytes.subarray(start + 8, start + 8 + length);
}
export function imageSize(data) {
  if (!data || data.byteLength < 30) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0) === 2303741511) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (data[0] === 255 && data[1] === 216) {
    let offset = 2;
    while (offset + 9 < data.byteLength) {
      if (data[offset] !== 255) return null;
      const marker = data[offset + 1], length = view.getUint16(offset + 2);
      if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      offset += 2 + length;
    }
    return null;
  }
  const tag = (at) => String.fromCharCode(...data.subarray(at, at + 4));
  if (tag(0) === "RIFF" && tag(8) === "WEBP") {
    const kind = tag(12);
    if (kind === "VP8X") return { width: 1 + (data[24] | data[25] << 8 | data[26] << 16), height: 1 + (data[27] | data[28] << 8 | data[29] << 16) };
    if (kind === "VP8L") {
      const b = view.getUint32(21, true);
      return { width: 1 + (b & 16383), height: 1 + (b >> 14 & 16383) };
    }
    if (kind === "VP8 ") return { width: view.getUint16(26, true) & 16383, height: view.getUint16(28, true) & 16383 };
  }
  return null;
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
