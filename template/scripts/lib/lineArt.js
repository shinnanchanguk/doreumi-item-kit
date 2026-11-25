// Generated from DoRms src/lib/doreumi/lineArt.ts. Keep this contract identical.
/**
 * 도름이 선 그림(링크트리 사물함 위 도름이가 입는 옷) 형식 · 검사 · 배치 · 합치기.
 * 2026-11-26 형 지시: 옷장 착장을 링크트리 도름이에 선 그림으로 입힌다. 상점 아이템은 사이트가 그림판을 갖고 있고,
 * 새 아이템은 제작자가 도구(doreumi-item-kit)에서 3D 아이템과 함께 이 형식의 line.json 을 만들어 보낸다.
 * 이 파일은 서버(검사 · 합치기)와 화면(그리기 순서)이 함께 쓴다. 도구 쪽 사본(template/scripts/lib/lineArt.js)과 맞춰 둔다.
 *
 * 좌표: 링크트리 도름이 그림의 원래 좌표(화면 방향, x 오른쪽 · y 아래). 도름이 전체 틀은 x 25.5~257.5 · y 13~315.5.
 * 왼쪽 · 오른쪽은 3D 와 같게 **도름이 자신** 기준이다. 도름이가 보는 사람을 보고 서 있으니 도름이의 왼팔(armL)은
 * 화면 오른쪽, 오른팔(armR)은 화면 왼쪽에 있다.
 *
 * 층(그리는 순서, 뒤 → 앞)
 *   behind  몸 뒤(날개 · 가방 · 망토 뒷자락). 몸과 함께 움직인다.
 *   legR · legL  그 다리와 함께(신발 · 바짓가랑이).
 *   body    몸 위(옷 · 목걸이). 얼굴판 · 눈 · 머리 소용돌이 · 팔보다 뒤.
 *   over    눈 · 머리 소용돌이보다 앞(모자 · 안경 · 가면). 팔보다 뒤.
 *   armR · armL  그 팔과 함께(소매 · 팔찌). 손 자리 아이템(장갑 등)은 팔 층이 아니라 hand 층에 그린다(고른 손을 따라가게).
 *   front   팔보다도 앞.
 *   ground  도름이 앞 바닥에 선 것(동반자). 들어 올려도 따라 움직이지 않는다.
 *   hand    손에 드는 물건. 쥐는 점이 (0,0), +x 가 몸 바깥쪽, +y 가 아래. 회원이 고른 손에 붙는다(다른 손이면 좌우를 뒤집는다).
 *   offHand 양손에 드는 아이템의 다른 손 몫(쌍권총 등). hand 와 같은 좌표.
 *   손 자리 아이템이 바닥에 놓이는 큰 물건이면(피아노 등) behind · ground 층에 오른손(화면 왼쪽) 기준으로 그린다.
 *   왼손을 고르면 두 손 사이 가운데를 축으로 좌우를 뒤집어 화면 오른쪽에 놓는다(3D 처럼 고른 손 쪽, 바닥 높이는 그대로).
 *
 * 선 종류 k: fl(판 색 면 + 선) · f(판 색 면만) · l(선만) · s(옅은 선) · d(선 색으로 칠한 면 · 점).
 * 경로 d 는 절대 좌표 명령 M · L · Q · C · Z 와 숫자만 쓴다(옮기기 · 뒤집기가 모든 숫자 쌍을 좌표로 다룬다).
 */
export const LINE_ART_VERSION = 1;
export const LINE_KINDS = ["fl", "f", "l", "s", "d"];
export const LINE_LAYERS = ["behind", "legR", "legL", "body", "over", "armR", "armL", "front", "ground", "hand", "offHand"];
/** 화면에 그리는 층(손 물건은 고른 손의 팔 층으로 들어간다). */
export const RENDER_LAYERS = ["behind", "legR", "legL", "body", "over", "armR", "armL", "front", "ground"];
export const LINE_ART_LIMITS = {
    /** line.json 파일 크기 */
    bytes: 64 * 1024,
    /** 한 층의 경로 수 · 전체 경로 수 */
    pathsPerLayer: 200,
    paths: 500,
    /** 경로 하나의 글자 수 */
    dChars: 12_000,
    /** 좌표 범위(도름이 틀 바깥으로 조금 나가는 날개 · 동반자까지) */
    min: -300,
    max: 600,
};
/** 도름이 전체 틀(그림 좌표). */
export const LINE_FRAME = { x: 25.5, y: 13, w: 232, h: 302.5 };
/** 손 물건을 쥐는 점. armR = 화면 왼쪽 손, armL = 화면 오른쪽 손. */
export const LINE_GRIP = { armR: [40, 188], armL: [241, 232] };
/** 얼굴판(조금 기운 타원). 두건 · 탈 옷은 이 둘레에 구멍을 낸다. */
export const LINE_FACE = { cx: 133.2, cy: 136.23, a: 46.88, b: 34.25, deg: 15.24 };
const NUM = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;
const ARITY = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
const round = (v) => (Math.round(v * 100) / 100).toString();
/** 경로를 명령 · 숫자로 읽는다. 허용하지 않는 글자 · 개수가 틀린 명령 · 범위를 벗어난 좌표면 null. */
function parsePath(d) {
    if (typeof d !== "string" || !d.length || d.length > LINE_ART_LIMITS.dChars)
        return null;
    if (!/^[MLQCZ0-9.,\-\s]+$/.test(d))
        return null;
    const tokens = d.match(/[MLQCZ]|-?(?:\d+(?:\.\d*)?|\.\d+)/g);
    if (!tokens || tokens.join("").length !== d.replace(/[\s,]/g, "").length)
        return null;
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        const cmd = tokens[i++];
        if (!(cmd in ARITY))
            return null;
        if (!out.length && cmd !== "M")
            return null;
        const nums = [];
        while (i < tokens.length && NUM.test(tokens[i]))
            nums.push(Number(tokens[i++]));
        const n = ARITY[cmd];
        if (n === 0 ? nums.length !== 0 : nums.length === 0 || nums.length % n !== 0)
            return null;
        if (nums.some((v) => !Number.isFinite(v) || v < LINE_ART_LIMITS.min || v > LINE_ART_LIMITS.max))
            return null;
        out.push({ cmd, nums });
    }
    return out.length ? out : null;
}
function writePath(parsed) {
    return parsed.map(({ cmd, nums }) => {
        if (!nums.length)
            return cmd;
        const pairs = [];
        for (let j = 0; j < nums.length; j += 2)
            pairs.push(`${round(nums[j])} ${round(nums[j + 1])}`);
        return cmd + pairs.join(" ");
    }).join("");
}
/** 모든 좌표 쌍에 fn 을 적용한 새 경로(검사를 통과한 경로에만 쓴다). */
export function mapPath(d, fn) {
    const parsed = parsePath(d);
    if (!parsed)
        return "";
    return writePath(parsed.map(({ cmd, nums }) => {
        const next = [];
        for (let j = 0; j < nums.length; j += 2) {
            const [x, y] = fn(nums[j], nums[j + 1]);
            next.push(x, y);
        }
        return { cmd, nums: next };
    }));
}
/**
 * 그림 층이 그 아이템의 자리와 맞나. 맞지 않으면 회원 화면에서 그림이 빠지거나(손 자리가 아닌데 hand 층),
 * 회원이 손을 바꿔도 늘 같은 팔에 그려진다(손 자리인데 팔 층). 맞으면 null, 아니면 고칠 말.
 */
export function lineLayersFitSlots(art, slots) {
    const has = (layer) => (art.layers[layer]?.length ?? 0) > 0;
    if (slots.includes("hand")) {
        if (has("armR") || has("armL"))
            return "손 자리 아이템은 팔 층(armR · armL) 대신 hand 층에 그려 주세요. 그래야 선생님이 고른 손을 따라가요.";
    }
    else if (has("hand") || has("offHand")) {
        return "손 자리가 아닌 아이템은 hand · offHand 층이 그려지지 않아요. 그 부분을 몸 · 팔 같은 다른 층으로 옮겨 주세요.";
    }
    return null;
}
/**
 * 제작자가 보낸 선 그림(JSON)을 검사하고 깨끗한 형태로 돌려준다. 이유는 선생님께 그대로 보여 줄 한국어다.
 * 경로 글자 · 층 이름 · 선 종류를 정해진 것만 받아, 화면에 그릴 때 사용자 입력이 다른 모양으로 끼어들지 않게 한다.
 */
export function checkLineArt(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
        return { ok: false, reason: "선 그림은 JSON 객체여야 해요." };
    const raw = input;
    for (const key of Object.keys(raw))
        if (!["v", "ant", "layers"].includes(key))
            return { ok: false, reason: `선 그림에 모르는 칸(${key.slice(0, 20)})이 있어요. v · ant · layers 만 써 주세요.` };
    if (raw.v !== LINE_ART_VERSION)
        return { ok: false, reason: "선 그림의 v 는 1 이어야 해요." };
    if (raw.ant !== undefined && raw.ant !== "hide" && raw.ant !== "hollow")
        return { ok: false, reason: "ant 는 \"hide\"(머리 소용돌이 숨기기)나 \"hollow\"(속 빈 소용돌이)만 쓸 수 있어요." };
    const layersRaw = raw.layers;
    if (!layersRaw || typeof layersRaw !== "object" || Array.isArray(layersRaw))
        return { ok: false, reason: "layers 는 층 이름을 열쇠로 하는 객체여야 해요." };
    const layers = {};
    let total = 0;
    for (const [name, list] of Object.entries(layersRaw)) {
        if (!LINE_LAYERS.includes(name))
            return { ok: false, reason: `모르는 층(${name.slice(0, 20)})이에요. ${LINE_LAYERS.join(" · ")} 가운데에서 골라 주세요.` };
        if (!Array.isArray(list))
            return { ok: false, reason: `${name} 층은 경로 목록(배열)이어야 해요.` };
        if (list.length > LINE_ART_LIMITS.pathsPerLayer)
            return { ok: false, reason: `${name} 층의 경로가 너무 많아요(${LINE_ART_LIMITS.pathsPerLayer}개까지).` };
        const paths = [];
        for (const item of list) {
            if (!item || typeof item !== "object" || Array.isArray(item))
                return { ok: false, reason: `${name} 층에 경로가 아닌 값이 있어요.` };
            const { k, d, ...rest } = item;
            if (Object.keys(rest).length)
                return { ok: false, reason: "경로에는 k 와 d 만 써 주세요." };
            if (!LINE_KINDS.includes(k))
                return { ok: false, reason: `선 종류 k 는 ${LINE_KINDS.join(" · ")} 가운데 하나예요.` };
            const parsed = parsePath(d);
            if (!parsed)
                return { ok: false, reason: `${name} 층의 경로 d 를 읽지 못했어요. 절대 좌표 M · L · Q · C · Z 와 숫자만, 좌표는 ${LINE_ART_LIMITS.min}~${LINE_ART_LIMITS.max} 안에서 써 주세요.` };
            paths.push({ k: k, d: writePath(parsed) });
        }
        total += paths.length;
        if (paths.length)
            layers[name] = paths;
    }
    if (!total)
        return { ok: false, reason: "선 그림에 경로가 하나도 없어요." };
    if (total > LINE_ART_LIMITS.paths)
        return { ok: false, reason: `경로가 너무 많아요(전체 ${LINE_ART_LIMITS.paths}개까지).` };
    const art = { v: LINE_ART_VERSION, ...(raw.ant ? { ant: raw.ant } : {}), layers };
    if (new TextEncoder().encode(JSON.stringify(art)).byteLength > LINE_ART_LIMITS.bytes)
        return { ok: false, reason: "선 그림 파일은 64KB 이하여야 해요. 점을 줄여 주세요." };
    return { ok: true, art };
}
/** 손 물건(쥐는 점 기준, +x 바깥쪽)을 그 팔의 그림 좌표로. armR(화면 왼쪽)은 바깥쪽이 화면 왼쪽이라 좌우를 뒤집는다. */
export function placeInHand(paths, arm) {
    const [gx, gy] = LINE_GRIP[arm];
    const sx = arm === "armR" ? -1 : 1;
    return paths.map((p) => ({ k: p.k, d: mapPath(p.d, (x, y) => [gx + sx * x, gy + y]) })).filter((p) => p.d);
}
/** 겹칠 때 뒤에 그리는 순서(작을수록 먼저): 등 → 하의 → 상의 · 한 벌 → 신발 → 목 → 얼굴 → 머리 → 손. */
const SLOT_RANK = { back: 0, bottom: 1, top: 2, shoes: 3, neck: 4, face: 5, head: 6, hand: 7 };
const rankOf = (slots) => Math.min(...slots.map((s) => SLOT_RANK[s] ?? 5));
/** 손 자리 아이템의 바닥 층(behind · ground)을 왼손 쪽으로 옮길 때의 축: 두 손 쥐는 점 사이 가운데. */
const HAND_FLOOR_AXIS = (LINE_GRIP.armR[0] + LINE_GRIP.armL[0]) / 2;
const mirrorFloor = (paths) => paths.map((p) => ({ k: p.k, d: mapPath(p.d, (x, y) => [2 * HAND_FLOOR_AXIS - x, y]) })).filter((p) => p.d);
/** 회원이 입은 아이템들의 선 그림을 그리는 순서대로 합친다. */
export function composeOutfit(entries) {
    const layers = {};
    const push = (layer, paths) => {
        if (!paths?.length)
            return;
        (layers[layer] ??= []).push(...paths);
    };
    let ant = "show";
    const sorted = [...entries].sort((a, b) => rankOf(a.slots) - rankOf(b.slots));
    for (const { art, slots, hand } of sorted) {
        if (art.ant === "hide")
            ant = "hide";
        else if (art.ant === "hollow" && ant === "show")
            ant = "hollow";
        const leftFloor = slots.includes("hand") && hand === "leftHand";
        for (const layer of RENDER_LAYERS) {
            const list = art.layers[layer];
            push(layer, leftFloor && list && (layer === "behind" || layer === "ground") ? mirrorFloor(list) : list);
        }
        if (slots.includes("hand")) {
            const arm = hand === "leftHand" ? "armL" : "armR";
            const other = arm === "armL" ? "armR" : "armL";
            push(arm, art.layers.hand && placeInHand(art.layers.hand, arm));
            push(other, art.layers.offHand && placeInHand(art.layers.offHand, other));
        }
    }
    return { ant, layers };
}
/** 착장이 비었나(그릴 것이 없나). */
export const outfitIsEmpty = (o) => !o || (o.ant === "show" && RENDER_LAYERS.every((l) => !o.layers[l]?.length));
/**
 * 그림 틀 위의 부품(뼈대 층)과 옷 층을 그리는 순서. 정지 그림(승인 카드 · 도구 미리보기)과 링크트리가 같은 순서를 쓴다.
 * part 는 mascotRig 의 부품 id(화면 기준 이름), wear 는 그 부품 바로 뒤에 그리는 옷 층.
 * 링크트리 도름이 그림(mascotRig)의 부품 이름은 화면 기준이라(legL = 화면 왼쪽 다리 = 도름이 오른다리) 여기서 짝을 맞춘다.
 */
export const FIGURE_ORDER = [
    { layer: "behind" },
    { part: "legL", wear: "legR" },
    { part: "legR", wear: "legL" },
    { part: "armLb" },
    { part: "armRb" },
    { part: "body", wear: "body" },
    { part: "eyeL" },
    { part: "eyeR" },
    { part: "ant" },
    { layer: "over" },
    { part: "armL", wear: "armR" },
    { part: "armR", wear: "armL" },
    { layer: "front" },
    { layer: "ground" },
];
