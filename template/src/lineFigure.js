// Generated from DoRms src/lib/doreumi/lineFigureCore.ts. Keep this contract identical.
/**
 * 선 그림 도름이 한 장(움직이지 않는 그림)을 SVG 글로 만드는 바탕. 도름이 뼈대(rig)를 받아 그린다.
 * 사이트(lineFigure.ts: 링크트리 뼈대를 넣어 부름)와 만들기 도구(template/src/lineFigure.js, 이 파일에서 생성: 받은 line-rig.json 을 넣어 부름)가
 * 같은 순서(FIGURE_ORDER) · 같은 보기 상자 · 같은 색 규칙으로 그린다. 화면(React)의 LineFigure.tsx 도 같은 순서를 쓴다.
 * 경로 글은 숫자와 명령 글자만 남겨(따옴표 · 꺾쇠를 막아) 속성 밖으로 새지 않게 한다.
 */
import { FIGURE_ORDER } from "../scripts/lib/lineArt.js";
/** 링크트리와 같은 색(밝은 · 어두운 화면). */
export const FIGURE_THEMES = {
    light: { plate: "#f3f2ed", edge: "#4a4f57", mid: "#7a7f87", bg: "#f3f2ed" },
    dark: { plate: "#08090a", edge: "#9fa3ac", mid: "#74777f", bg: "#08090a" },
};
/** 기본 보기 상자(도름이 틀 + 여백). 옷이 틀 밖으로 나가면 figureViewBox 가 그만큼 넓힌다. */
export const FIGURE_VIEWBOX = { x: 15.5, y: 3, w: 252, h: 322.5 };
/** 도름이 키(그림 좌표). 화면에 도름이를 몇 px 로 보일지 정할 때 쓴다. */
export const DOREUMI_HEIGHT_UNITS = 302.5;
/** 도름이와 입은 것 전체가 들어가는 보기 상자(날개 · 동반자 · 큰 소품까지). 경로의 모든 좌표 쌍을 넣어 잰다. */
export function figureViewBox(outfit, pad = 10) {
    let x0 = FIGURE_VIEWBOX.x, y0 = FIGURE_VIEWBOX.y;
    let x1 = FIGURE_VIEWBOX.x + FIGURE_VIEWBOX.w, y1 = FIGURE_VIEWBOX.y + FIGURE_VIEWBOX.h;
    for (const list of Object.values(outfit?.layers ?? {}))
        for (const p of list ?? []) {
            const nums = p.d.match(/-?\d+(?:\.\d+)?/g) ?? [];
            for (let i = 0; i + 1 < nums.length; i += 2) {
                const x = Number(nums[i]), y = Number(nums[i + 1]);
                if (x - pad < x0)
                    x0 = x - pad;
                if (x + pad > x1)
                    x1 = x + pad;
                if (y - pad < y0)
                    y0 = y - pad;
                if (y + pad > y1)
                    y1 = y + pad;
            }
        }
    const fx = Math.floor(x0), fy = Math.floor(y0);
    return { x: fx, y: fy, w: Math.ceil(x1 - fx), h: Math.ceil(y1 - fy) };
}
const NS = ` vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"`;
const safeWear = (v) => v.replace(/[^MLQCZ0-9.\-\s]/g, "");
const safeRig = (v) => v.replace(/[^A-Za-z0-9.,\-\s]/g, "");
const safeColor = (v) => v.replace(/[^#a-zA-Z0-9.(),% -]/g, "");
function rigPath(q, t, sw, hollow) {
    const tr = q.rot !== undefined ? ` transform="rotate(${Number(q.rot)} ${Number(q.cx)} ${Number(q.cy)})"` : "";
    const style = q.k === "fill" ? `fill="${t.plate}" stroke="none"`
        : q.k === "line" ? `fill="none" stroke="${t.edge}" stroke-width="${sw}"${NS}`
            : q.k === "soft" ? `fill="none" stroke="${t.mid}" stroke-width="${sw}"${NS}`
                : q.k === "dot" ? `fill="${t.edge}" stroke="none"`
                    : hollow ? `fill="${t.plate}" stroke="${t.edge}" stroke-width="${sw}"${NS}` : `fill="${t.edge}" stroke="${t.edge}" stroke-width="${sw}"${NS}`;
    return `<path d="${safeRig(q.d)}" ${style}${tr}/>`;
}
export function wearPathStyle(k, t, sw) {
    const fr = ` fill-rule="evenodd"`;
    switch (k) {
        case "fl": return `fill="${t.plate}" stroke="${t.edge}" stroke-width="${sw}"${NS}${fr}`;
        case "f": return `fill="${t.plate}" stroke="none"${fr}`;
        case "l": return `fill="none" stroke="${t.edge}" stroke-width="${sw}"${NS}`;
        case "s": return `fill="none" stroke="${t.mid}" stroke-width="${sw}"${NS}`;
        case "d": return `fill="${t.edge}" stroke="none"${fr}`;
    }
}
const wear = (paths, t, sw) => (paths ?? []).map((p) => `<path d="${safeWear(p.d)}" ${wearPathStyle(p.k, t, sw)}/>`).join("");
function gridLines(vb) {
    const out = [];
    for (let x = Math.ceil(vb.x / 10) * 10; x <= vb.x + vb.w; x += 10)
        out.push(`<line x1="${x}" y1="${vb.y}" x2="${x}" y2="${vb.y + vb.h}" stroke="${x % 50 ? "#e3ded3" : "#d6b3a8"}" stroke-width="0.4"/>`);
    for (let y = Math.ceil(vb.y / 10) * 10; y <= vb.y + vb.h; y += 10)
        out.push(`<line x1="${vb.x}" y1="${y}" x2="${vb.x + vb.w}" y2="${y}" stroke="${y % 50 ? "#e3ded3" : "#d6b3a8"}" stroke-width="0.4"/>`);
    for (let x = Math.ceil(vb.x / 50) * 50; x <= vb.x + vb.w; x += 50)
        out.push(`<text x="${x + 1}" y="${vb.y + 8}" font-size="6" fill="#b06a58">${x}</text>`);
    for (let y = Math.ceil(vb.y / 50) * 50; y <= vb.y + vb.h; y += 50)
        out.push(`<text x="${vb.x + 1}" y="${y - 1}" font-size="6" fill="#b06a58">${y}</text>`);
    return out.join("");
}
/**
 * 도름이(rig) + 착장 한 장. doreumiPx 는 도름이 키를 몇 px 로 보일지(링크트리 컴퓨터 67 · 휴대폰 40),
 * 보기 상자는 입은 것까지 담도록 넓어지고 그림 크기도 그만큼 커진다. strokePx 는 선 굵기(px, 화면 기준). grid 는 좌표 격자(도구 미리보기).
 */
export function figureSvgWith(rig, outfit, opts) {
    const t0 = opts.theme ?? FIGURE_THEMES.light;
    const t = { plate: safeColor(t0.plate), edge: safeColor(t0.edge), mid: safeColor(t0.mid), bg: safeColor(t0.bg) };
    const sw = Number(opts.strokePx ?? 0.9);
    const vb = opts.viewBox ?? figureViewBox(outfit);
    const parts = new Map(rig.parts.map((p) => [p.id, p]));
    const ant = outfit?.ant ?? "show";
    const body = [];
    if (opts.grid)
        body.push(gridLines(vb));
    for (const step of FIGURE_ORDER) {
        if ("layer" in step) {
            body.push(wear(outfit?.layers[step.layer], t, sw));
            continue;
        }
        const part = parts.get(step.part);
        if (!part || (step.part === "ant" && ant === "hide"))
            continue;
        body.push(part.paths.map((q) => rigPath(q, t, sw, step.part === "ant" && ant === "hollow")).join(""));
        if (step.wear)
            body.push(wear(outfit?.layers[step.wear], t, sw));
    }
    const k = opts.doreumiPx / DOREUMI_HEIGHT_UNITS;
    const bg = opts.background ? `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${t.bg}"/>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${(vb.w * k).toFixed(1)}" height="${(vb.h * k).toFixed(1)}">${bg}${body.join("")}</svg>`;
}
