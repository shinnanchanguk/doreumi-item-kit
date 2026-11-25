// Generated from DoRms src/lib/linktree/outfit/draw.ts. Keep this contract identical.
/**
 * 상점 아이템 선 그림을 코드로 그릴 때 쓰는 도구(서버와 작업 도구만 씀, 화면 묶음에 들어가지 않는다).
 * 모든 도구는 절대 좌표 M · L · Q · C · Z 만 만든다(lineArt.ts 의 검사 · 옮기기 · 뒤집기 규칙과 같다).
 * 좌표 기준은 lineArt.ts 머리말 참고. 자주 쓰는 자리:
 *   얼굴판 가운데 (133.2, 136.2) · 머리 꼭대기 (143, 61) · 몸 가장자리 y140 에서 x 68~221 · 배 아래 y 262
 *   목(얼굴판 아래) y 172~190 · 배 소용돌이 가운데 (127, 207)
 *   화면 왼쪽 팔(도름이 오른팔, armR) 어깨 (68,143) → 손 (38,186) · 화면 오른쪽 팔(도름이 왼팔, armL) 어깨 (221,168) → 손 (240,230)
 *   화면 왼쪽 다리(legR) x 79~126 · y 241~298 · 화면 오른쪽 다리(legL) x 138~198 · y 254~315
 */
import { LINE_FACE } from "../scripts/lib/lineArt.js";
/** 얼굴판 · 도름이 틀 · 손 쥐는 점(그릴 때 기준으로 쓴다). */
export { LINE_FACE as FACE, LINE_FRAME as FRAME, LINE_GRIP as GRIP } from "../scripts/lib/lineArt.js";
const n = (v) => (Math.round(v * 100) / 100).toString();
const P = (p) => `${n(p[0])} ${n(p[1])}`;
/** 기울어진 타원(4개의 3차 곡선). dir -1 이면 반대로 감아 다른 모양 안에서 구멍이 된다(evenodd). */
export function ellipse(cx, cy, a, b, deg = 0, dir = 1) {
    const k = 0.5523, t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const R = (x, y) => `${n(cx + x * c - y * s)} ${n(cy + x * s + y * c)}`;
    const y = dir;
    return `M${R(a, 0)}C${R(a, k * b * y)} ${R(k * a, b * y)} ${R(0, b * y)}C${R(-k * a, b * y)} ${R(-a, k * b * y)} ${R(-a, 0)}C${R(-a, -k * b * y)} ${R(-k * a, -b * y)} ${R(0, -b * y)}C${R(k * a, -b * y)} ${R(a, -k * b * y)} ${R(a, 0)}Z`;
}
export const circle = (cx, cy, r, dir = 1) => ellipse(cx, cy, r, r, 0, dir);
/** 점들을 부드럽게 잇는다(캣멀-롬 → 3차 곡선). tension 이 작을수록 모서리가 살아난다. */
export function smooth(pts, closed = true, tension = 1) {
    const m = pts.length;
    const at = (i) => (closed ? pts[((i % m) + m) % m] : pts[Math.max(0, Math.min(m - 1, i))]);
    let d = `M${P(pts[0])}`;
    const last = closed ? m : m - 1;
    for (let i = 0; i < last; i++) {
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
        const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
        const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
        d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
    }
    return closed ? d + "Z" : d;
}
/** 꺾은선(닫으면 다각형). */
export const poly = (pts, closed = true) => `M${pts.map(P).join("L")}${closed ? "Z" : ""}`;
/** 선분 여러 개. */
export const segs = (...pairs) => pairs.map(([a, b]) => `M${P(a)}L${P(b)}`).join("");
/** 2차 곡선 한 줄. */
export const quad = (a, c, b) => `M${P(a)}Q${P(c)} ${P(b)}`;
/** 3차 곡선 한 줄. */
export const cubic = (a, c1, c2, b) => `M${P(a)}C${P(c1)} ${P(c2)} ${P(b)}`;
/** 모서리가 둥근 사각형(r = 모서리 반지름). */
export function rrect(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const k = r * 0.4477;
    return `M${n(x + r)} ${n(y)}L${n(x + w - r)} ${n(y)}C${n(x + w - k)} ${n(y)} ${n(x + w)} ${n(y + k)} ${n(x + w)} ${n(y + r)}`
        + `L${n(x + w)} ${n(y + h - r)}C${n(x + w)} ${n(y + h - k)} ${n(x + w - k)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}`
        + `L${n(x + r)} ${n(y + h)}C${n(x + k)} ${n(y + h)} ${n(x)} ${n(y + h - k)} ${n(x)} ${n(y + h - r)}`
        + `L${n(x)} ${n(y + r)}C${n(x)} ${n(y + k)} ${n(x + k)} ${n(y)} ${n(x + r)} ${n(y)}Z`;
}
/** 2차 곡선 위의 점(장식을 줄 위에 늘어놓을 때). */
export function onQuad(a, c, b, t) {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}
/** 두 점 사이. */
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** 경로의 모든 좌표 쌍을 바꾼다(옮기기 · 키우기 · 돌리기 · 뒤집기의 바탕). */
export const mapD = (d, fn) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => P(fn(+x, +y)));
export const move = (d, dx, dy) => mapD(d, (x, y) => [x + dx, y + dy]);
export const scaleAt = (d, ox, oy, kx, ky = kx) => mapD(d, (x, y) => [ox + (x - ox) * kx, oy + (y - oy) * ky]);
export function rotateAt(d, ox, oy, deg) {
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return mapD(d, (x, y) => [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]);
}
export const flipX = (d, ox) => mapD(d, (x, y) => [2 * ox - x, y]);
/** 얼굴판보다 grow 만큼 큰 구멍(반대로 감음). 두건 · 탈 옷 윤곽 뒤에 이어 붙이면 얼굴이 보인다. */
export const faceHole = (grow) => ellipse(LINE_FACE.cx, LINE_FACE.cy, LINE_FACE.a + grow, LINE_FACE.b + grow, LINE_FACE.deg, -1);
/** 얼굴판보다 grow 만큼 큰 둘레 선(구멍 가장자리를 한 번 더 그을 때). */
export const faceRing = (grow) => ellipse(LINE_FACE.cx, LINE_FACE.cy, LINE_FACE.a + grow, LINE_FACE.b + grow, LINE_FACE.deg);
/** 경로 하나 만들기. */
export const p = (k, d) => ({ k, d });
export const fl = (d) => p("fl", d);
export const f = (d) => p("f", d);
export const l = (d) => p("l", d);
export const s = (d) => p("s", d);
export const dk = (d) => p("d", d);
/** 선 그림 하나 만들기. */
export function art(layers, ant) {
    const clean = {};
    for (const [k, v] of Object.entries(layers))
        if (v?.length)
            clean[k] = v;
    return { v: 1, ...(ant ? { ant } : {}), layers: clean };
}
