// Rule tests that run without the Doreumi model: tiny GLB files built in memory, one per rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkConfig, checkItemGlb, checkPreviewWebp, normalizeSlots } from "../template/scripts/lib/rules.js";

function glb(json, binLength = 36) {
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const bin = Buffer.alloc(binLength);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + 8 + bin.length, 8); header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  return new Uint8Array(Buffer.concat([header, text, binHeader, bin]));
}
const base = () => ({
  asset: { version: "2.0" },
  buffers: [{ byteLength: 36 }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  accessors: [{ bufferView: 0, count: 3, type: "VEC3", componentType: 5126 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  nodes: [{ name: "hat", mesh: 0 }],
});
const rigid = { rigged: false, bone: "headAccessory" };

test("a plain rigid item passes", () => {
  const result = checkItemGlb(glb(base()), rigid);
  assert.equal(result.ok, true); assert.equal(result.triangles, 1);
});
test("header and length are checked", () => {
  const bytes = glb(base()); bytes[0] = 0;
  assert.match(checkItemGlb(bytes, rigid).reason, /glTF 2.0 바이너리/);
  const cut = glb(base()).subarray(0, 60);
  assert.match(checkItemGlb(cut, rigid).reason, /파일 길이/);
});
test("size cap 3MB", () => {
  assert.match(checkItemGlb(new Uint8Array(3 * 1024 * 1024 + 1), rigid).reason, /3MB/);
});
test("external uri is refused", () => {
  const json = base(); json.buffers[0].uri = "x.bin";
  assert.match(checkItemGlb(glb(json), rigid).reason, /바깥 파일/);
});
test("only allowed extensions", () => {
  const json = base(); json.extensionsUsed = ["KHR_draco_mesh_compression"];
  assert.match(checkItemGlb(glb(json), rigid).reason, /쓸 수 없는 확장/);
  json.extensionsUsed = ["KHR_materials_unlit"];
  assert.equal(checkItemGlb(glb(json), rigid).ok, true);
});
test("images: count, embedded, type, size", () => {
  const json = base();
  json.images = Array.from({ length: 5 }, () => ({ bufferView: 0, mimeType: "image/png" }));
  assert.match(checkItemGlb(glb(json), rigid).reason, /4장/);
  json.images = [{ uri: "a.png" }];
  assert.match(checkItemGlb(glb(json), rigid).reason, /파일 안에/);
  json.images = [{ bufferView: 0, mimeType: "image/gif" }];
  assert.match(checkItemGlb(glb(json), rigid).reason, /PNG/);
  json.bufferViews.push({ buffer: 0, byteLength: 1024 * 1024 + 1 });
  json.images = [{ bufferView: 1, mimeType: "image/png" }];
  assert.match(checkItemGlb(glb(json), rigid).reason, /1MB/);
});
test("no animations, triangles only, not empty, triangle cap", () => {
  const json = base(); json.animations = [{}];
  assert.match(checkItemGlb(glb(json), rigid).reason, /동작/);
  const lines = base(); lines.meshes[0].primitives[0].mode = 1;
  assert.match(checkItemGlb(glb(lines), rigid).reason, /삼각형/);
  const empty = base(); empty.accessors[0].count = 0;
  assert.match(checkItemGlb(glb(empty), rigid).reason, /비어/);
  const many = base(); many.accessors[0].count = 40_001 * 3;
  assert.match(checkItemGlb(glb(many), rigid).reason, /면이 너무 많아요/);
});
test("rigged items need Doreumi joint names", () => {
  const json = base();
  json.nodes = [{ name: "torso" }, { name: "shirt", mesh: 0, skin: 0 }];
  json.skins = [{ joints: [0] }];
  assert.equal(checkItemGlb(glb(json), { rigged: true, bone: null }).ok, true);
  json.nodes[0].name = "tail";
  assert.match(checkItemGlb(glb(json), { rigged: true, bone: null }).reason, /관절\(tail\)/);
  delete json.skins;
  assert.match(checkItemGlb(glb(json), { rigged: true, bone: null }).reason, /뼈대 연결이 없어요/);
});
test("rigid items: no skins, bone must exist", () => {
  const json = base(); json.skins = [{ joints: [0] }];
  assert.match(checkItemGlb(glb(json), rigid).reason, /몸 따라 움직이는 옷/);
  assert.match(checkItemGlb(glb(base()), { rigged: false, bone: "tail" }).reason, /붙일 자리/);
});
test("a node named Doreumi is refused", () => {
  const json = base(); json.nodes[0].name = "Doreumi";
  assert.match(checkItemGlb(glb(json), rigid).reason, /도름이 몸은 바꿀 수 없어요/);
});
test("preview must be a small WebP", () => {
  const webp = new Uint8Array(32); webp.set(Buffer.from("RIFF"), 0); webp.set(Buffer.from("WEBP"), 8);
  assert.equal(checkPreviewWebp(webp), null);
  const png = new Uint8Array(32); png.set([0x89, 0x50, 0x4e, 0x47], 0);
  assert.match(checkPreviewWebp(png), /WebP/);
  assert.match(checkPreviewWebp(new Uint8Array(400 * 1024 + 1)), /400KB/);
});
test("slots follow the server", () => {
  assert.deepEqual(normalizeSlots(["head"]), ["head"]);
  assert.deepEqual(normalizeSlots(["top", "bottom"]), ["top", "bottom"]);
  assert.equal(normalizeSlots(["top", "head"]), null);
  assert.equal(normalizeSlots(["hat"]), null);
  assert.equal(normalizeSlots([]), null);
  assert.equal(normalizeSlots(["head", "head"]), null);
});
test("config: name, description, slots, rigged/bone", () => {
  const ok = checkConfig({ name: "모자", description: "", slots: ["head"], rigged: false, bone: "headAccessory" });
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.meta, { name: "모자", description: "", slots: ["head"], rigged: false, bone: "headAccessory" });
  assert.equal(checkConfig({ name: "가".repeat(31), slots: ["head"], rigged: false, bone: "head" }).problems.length, 1);
  assert.equal(checkConfig({ name: "옷", description: "a".repeat(201), slots: ["top"], rigged: true, bone: null }).problems.length, 1);
  assert.equal(checkConfig({ name: "옷", slots: ["top"], rigged: true, bone: "torso" }).problems.length, 1);
  assert.equal(checkConfig({ name: "옷", slots: ["top"], rigged: "yes", bone: "torso" }).problems.length, 1);
  assert.equal(checkConfig({ name: "", slots: ["x"], rigged: false, bone: "tail" }).problems.length, 3);
});
test("init copies the template, renames dotfiles and runs nothing else", () => {
  const dir = mkdtempSync(join(tmpdir(), "doreumi-kit-"));
  try {
    const cli = resolve(new URL("..", import.meta.url).pathname, "bin/cli.js");
    const out = execFileSync(process.execPath, [cli, "init", "My Item"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /아인T/);
    const project = join(dir, "My Item");
    for (const file of [".gitignore", ".env.example", "AGENTS.md", "README.md", "NOTICE", "LICENSE", "src/item.js", "item.config.json"]) assert.ok(existsSync(join(project, file)), file);
    assert.ok(!existsSync(join(project, "node_modules")));
    assert.match(readFileSync(join(project, ".gitignore"), "utf8"), /^\.doreumi\/$/m);
    assert.equal(JSON.parse(readFileSync(join(project, "package.json"), "utf8")).name, "my-item");
    assert.throws(() => execFileSync(process.execPath, [cli, "init", "My Item"], { cwd: dir, stdio: "pipe" }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
