import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLineArt, composeOutfit, placeInHand, LINE_GRIP } from "../scripts/lib/lineArt.js";
import { buildLineArt } from "../src/lineArt.js";
import * as DRAW from "../src/lineDraw.js";
import { figureSvgWith } from "../src/lineFigure.js";

test("the example line art passes the DoRms check", () => {
  const checked = checkLineArt(buildLineArt(DRAW));
  assert.equal(checked.ok, true, checked.reason);
  assert.equal(checked.art.ant, "hide");
  assert.ok(checked.art.layers.over.length >= 3);
});

test("only known layers, kinds and absolute M L Q C Z paths are accepted", () => {
  const ok = (layers, extra = {}) => checkLineArt({ v: 1, layers, ...extra });
  assert.equal(ok({ body: [{ k: "fl", d: "M0 0L10 0L10 10Z" }] }).ok, true);
  assert.equal(ok({ body: [{ k: "fl", d: "M0 0 A5 5 0 1 0 10 0" }] }).ok, false, "arcs are not allowed");
  assert.equal(ok({ body: [{ k: "fl", d: "m0 0l10 0" }] }).ok, false, "relative commands are not allowed");
  assert.equal(ok({ body: [{ k: "fl", d: "L0 0" }] }).ok, false, "must start with M");
  assert.equal(ok({ body: [{ k: "fl", d: "M0 0L10" }] }).ok, false, "odd number count");
  assert.equal(ok({ body: [{ k: "fl", d: "M0 0L900 0" }] }).ok, false, "out of range");
  assert.equal(ok({ body: [{ k: "red", d: "M0 0L1 1" }] }).ok, false, "unknown kind");
  assert.equal(ok({ wings: [{ k: "l", d: "M0 0L1 1" }] }).ok, false, "unknown layer");
  assert.equal(ok({ body: [{ k: "l", d: "M0 0L1 1", fill: "red" }] }).ok, false, "extra keys");
  assert.equal(ok({ body: [{ k: "l", d: "M0 0L1 1\"/><script>" }] }).ok, false, "markup in a path");
  assert.equal(ok({}).ok, false, "empty");
  assert.equal(ok({ body: [{ k: "l", d: "M0 0L1 1" }] }, { ant: "show" }).ok, false, "ant is hide or hollow");
  assert.equal(checkLineArt({ v: 2, layers: { body: [{ k: "l", d: "M0 0L1 1" }] } }).ok, false, "version");
});

test("a held item goes to the chosen hand and mirrors for the right hand (screen left)", () => {
  const paths = [{ k: "l", d: "M0 0L10 5" }];
  const [gx, gy] = LINE_GRIP.armL;
  assert.equal(placeInHand(paths, "armL")[0].d, `M${gx} ${gy}L${gx + 10} ${gy + 5}`);
  const [rx, ry] = LINE_GRIP.armR;
  assert.equal(placeInHand(paths, "armR")[0].d, `M${rx} ${ry}L${rx - 10} ${ry + 5}`);
  const art = { v: 1, layers: { hand: paths, offHand: paths } };
  const right = composeOutfit([{ art, slots: ["hand"], hand: "rightHand" }]);
  assert.ok(right.layers.armR?.length && right.layers.armL?.length, "both hands for a two-handed item");
});

test("worn items are merged in drawing order (back, bottom, top, shoes, neck, face, head, hand)", () => {
  const mk = (tag) => ({ v: 1, layers: { body: [{ k: "l", d: `M${tag} 0L1 1` }] } });
  const merged = composeOutfit([
    { art: mk(6), slots: ["head"] }, { art: mk(2), slots: ["top", "bottom"] }, { art: mk(0), slots: ["back"] }, { art: mk(4), slots: ["neck"] },
  ]);
  assert.deepEqual(merged.layers.body.map((p) => p.d.split(" ")[0]), ["M0", "M2", "M4", "M6"]);
  assert.equal(composeOutfit([{ art: { ...mk(1), ant: "hollow" }, slots: ["top"] }, { art: { ...mk(2), ant: "hide" }, slots: ["head"] }]).ant, "hide");
});

test("the figure picture strips anything but path characters", () => {
  // The Doreumi skeleton itself uses arcs (face plate): those must survive, only quotes and brackets go.
  const rig = { parts: [{ id: "body", paths: [{ k: "soft", d: "M98.9 136.2A34.2 46.9 0 1 0 167.4 136.2Z" }, { k: "line", d: "M0 0L1 1\"/><script>" }] }] };
  const svg = figureSvgWith(rig, { ant: "show", layers: { body: [{ k: "l", d: "M0 0L1 1\"onload=\"x" }] } }, { doreumiPx: 100 });
  assert.ok(!svg.includes("onload"), svg);
  assert.ok(svg.includes("A34.2 46.9 0 1 0 167.4 136.2Z"), "arc kept");
  assert.ok(!svg.includes("<script"), svg);
});
