// One still picture of the linktree line Doreumi wearing the item (SVG text). The preview page shows it
// big and at the real linktree size. Same drawing order as DoRms (FIGURE_ORDER in scripts/lib/lineArt.js).
import { FIGURE_ORDER } from "../scripts/lib/lineArt.js";

export const FIGURE_VIEWBOX = { x: -20, y: -30, w: 320, h: 360 };
export const THEMES = {
  light: { plate: "#f3f2ed", edge: "#4a4f57", mid: "#7a7f87", bg: "#f3f2ed" },
  dark: { plate: "#08090a", edge: "#9fa3ac", mid: "#74777f", bg: "#08090a" },
};
/** Height of the svg that shows Doreumi (302.5 tall in drawing units) at doreumiPx pixels. */
export const heightFor = (doreumiPx) => Math.round((doreumiPx * FIGURE_VIEWBOX.h) / 302.5);
const clean = (v) => String(v).replace(/[^MLQCZ0-9.\-\s]/g, "");
// The Doreumi skeleton paths come from DoRms and also use arcs (A) and other commands: keep letters and numbers,
// drop anything that could end the attribute (quotes, angle brackets).
const cleanRig = (v) => String(v).replace(/[^A-Za-z0-9.,\-\s]/g, "");
const NS = ` vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"`;

function rigPath(q, t, sw, hollow) {
  const tr = q.rot !== undefined ? ` transform="rotate(${Number(q.rot)} ${Number(q.cx)} ${Number(q.cy)})"` : "";
  const style = q.k === "fill" ? `fill="${t.plate}" stroke="none"`
    : q.k === "line" ? `fill="none" stroke="${t.edge}" stroke-width="${sw}"${NS}`
    : q.k === "soft" ? `fill="none" stroke="${t.mid}" stroke-width="${sw}"${NS}`
    : q.k === "dot" ? `fill="${t.edge}" stroke="none"`
    : hollow ? `fill="${t.plate}" stroke="${t.edge}" stroke-width="${sw}"${NS}` : `fill="${t.edge}" stroke="${t.edge}" stroke-width="${sw}"${NS}`;
  return `<path d="${cleanRig(q.d)}" ${style}${tr}/>`;
}
function wearStyle(k, t, sw) {
  const fr = ` fill-rule="evenodd"`;
  if (k === "fl") return `fill="${t.plate}" stroke="${t.edge}" stroke-width="${sw}"${NS}${fr}`;
  if (k === "f") return `fill="${t.plate}" stroke="none"${fr}`;
  if (k === "l") return `fill="none" stroke="${t.edge}" stroke-width="${sw}"${NS}`;
  if (k === "s") return `fill="none" stroke="${t.mid}" stroke-width="${sw}"${NS}`;
  return `fill="${t.edge}" stroke="none"${fr}`;
}
const wear = (paths, t, sw) => (paths ?? []).map((p) => `<path d="${clean(p.d)}" ${wearStyle(p.k, t, sw)}/>`).join("");

/** rig: the "rig" object from .doreumi/line-rig.json. outfit: composeOutfit(...) result or null. */
export function figureSvg(rig, outfit, { height, theme = THEMES.light, strokePx = 0.9, grid = false } = {}) {
  const vb = FIGURE_VIEWBOX;
  const parts = new Map(rig.parts.map((p) => [p.id, p]));
  const ant = outfit?.ant ?? "show";
  const out = [];
  if (grid) {
    for (let x = 0; x <= 280; x += 10) out.push(`<line x1="${x}" y1="${vb.y}" x2="${x}" y2="${vb.y + vb.h}" stroke="${x % 50 ? "#e3ded3" : "#d6b3a8"}" stroke-width="0.4"/>`);
    for (let y = -20; y <= 330; y += 10) out.push(`<line x1="${vb.x}" y1="${y}" x2="${vb.x + vb.w}" y2="${y}" stroke="${y % 50 ? "#e3ded3" : "#d6b3a8"}" stroke-width="0.4"/>`);
    for (let x = 0; x <= 250; x += 50) out.push(`<text x="${x + 1}" y="${vb.y + 8}" font-size="6" fill="#b06a58">${x}</text>`);
    for (let y = 0; y <= 300; y += 50) out.push(`<text x="${vb.x + 1}" y="${y - 1}" font-size="6" fill="#b06a58">${y}</text>`);
  }
  for (const step of FIGURE_ORDER) {
    if (step.layer) { out.push(wear(outfit?.layers[step.layer], theme, strokePx)); continue; }
    const part = parts.get(step.part);
    if (!part || (step.part === "ant" && ant === "hide")) continue;
    out.push(part.paths.map((q) => rigPath(q, theme, strokePx, step.part === "ant" && ant === "hollow")).join(""));
    if (step.wear) out.push(wear(outfit?.layers[step.wear], theme, strokePx));
  }
  const width = Math.round((height * vb.w) / vb.h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${width}" height="${height}" style="background:${theme.bg}">${out.join("")}</svg>`;
}
