// Item file rules. These mirror the DoRms server check (src/lib/doreumi/itemFile.ts and
// normalizeSlots in src/lib/doreumi/items.ts). Keep the two in step: if the server rule changes,
// change this file in the same way, otherwise `npm run check` would pass files the server rejects.

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

export { checkItemGlb, checkPreviewWebp } from "./itemFile.js";

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
  // 희망 판매 가격(도름). 적지 않아도 되고, 적으면 1~10,000 정수여야 한다. 최종 가격은 운영자가 상점에 올릴 때 정한다.
  let price = null;
  if (config.price !== undefined && config.price !== null) {
    if (!Number.isInteger(config.price) || config.price < 1 || config.price > 10000) problems.push("희망 판매 가격(price)은 1에서 10,000 사이의 정수(도름)로 적어 주세요.");
    else price = config.price;
  }
  const meta = { name, description: cleanText(rawDescription, 200), slots, rigged, bone, ...(price !== null ? { price } : {}) };
  return { problems, meta };
}
