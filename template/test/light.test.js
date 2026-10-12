import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createHelpers } from "../src/helpers.js";
import { exportItem } from "../src/exportItem.js";
import { wearDressItem } from "../src/dress.js";
import { createItemLightPreview, createPreviewEnvironment } from "../src/light.js";
import { checkItemGlb } from "../scripts/lib/rules.js";

// The actual Three exporter uses the browser FileReader API. No model, network, or
// WebGL is needed to exercise its binary export and the production wear path.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); });
  }
};

function skinGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0], 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Array(12).fill(0), 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.computeVertexNormals();
  return geometry;
}
function rig() {
  const scene = new THREE.Scene(), model = new THREE.Group(); model.name = "Model"; scene.add(model);
  const root = new THREE.Bone(); root.name = "root";
  const torso = new THREE.Bone(); torso.name = "torso"; torso.position.y = 1; root.add(torso);
  const head = new THREE.Bone(); head.name = "head"; head.position.y = 0.7; torso.add(head);
  const accessory = new THREE.Object3D(); accessory.name = "headAccessory"; accessory.position.y = 0.2; head.add(accessory);
  const body = new THREE.SkinnedMesh(skinGeometry(), new THREE.MeshStandardMaterial()); body.name = "Doreumi";
  model.add(root, body); model.updateMatrixWorld(true);
  body.bind(new THREE.Skeleton([root, torso, head]));
  const rest = new Map(); model.traverse((node) => { if (node.name) rest.set(node.name, node.matrixWorld.clone()); });
  const doreumi = { model, body, rest, loader: new GLTFLoader() };
  return { scene, model, root, torso, head, accessory, body, doreumi, helpers: createHelpers(doreumi) };
}
function lens() {
  return new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: "#dddddd" }));
}
function garment(body) {
  const mesh = new THREE.SkinnedMesh(skinGeometry(), new THREE.MeshStandardMaterial());
  mesh.bind(new THREE.Skeleton(body.skeleton.bones, body.skeleton.boneInverses.map((matrix) => matrix.clone())), body.bindMatrix.clone());
  mesh.name = "chest-lamp";
  return mesh;
}
const near = (actual, expected) => assert.ok(actual.distanceTo(expected) < 1e-6, `${actual.toArray()} != ${expected.toArray()}`);

test("addLight normalizes the marker and isolates only the lens material", () => {
  const { helpers } = rig(), mesh = lens(), shared = mesh.material;
  const other = new THREE.Mesh(mesh.geometry, shared);
  const result = helpers.addLight(mesh, { kind: "spot", color: "#FFE2A8", direction: [0, -0.2, 1] });
  assert.equal(result, mesh);
  assert.equal(mesh.userData.doreumiLight.color, "#ffe2a8");
  assert.equal(mesh.userData.doreumiLight.intensity, 18);
  assert.equal(mesh.userData.doreumiLight.distance, 8);
  assert.equal(mesh.userData.doreumiLight.angle, 30);
  near(new THREE.Vector3(...mesh.userData.doreumiLight.direction), new THREE.Vector3(0, -0.2, 1).normalize());
  assert.notEqual(mesh.material, shared);
  assert.equal(other.material.emissive.getHex(), 0);
  assert.equal(mesh.material.emissive.getHexString(), "ffe2a8");
  assert.equal(mesh.children.some((child) => child.isLight), false);
  const material = mesh.material;
  helpers.addLight(mesh, { kind: "point", color: "#ff0000" });
  assert.equal(mesh.material, material, "updating one lens does not allocate another material");
  for (const [given, expected] of [[100, 2.5], [-1, 0.7], [Infinity, 1], [NaN, 1]]) {
    mesh.material.emissiveIntensity = given;
    helpers.addLight(mesh, { kind: "point", color: "#ffffff" });
    assert.equal(mesh.material.emissiveIntensity, expected);
  }
});

test("addLight rejects incompatible meshes, invalid settings, and a second light", () => {
  const { helpers, body } = rig(), mesh = lens();
  assert.throws(() => helpers.addLight(new THREE.Group(), { kind: "point", color: "#ffffff" }), /재질 하나/);
  assert.throws(() => helpers.addLight(body, { kind: "point", color: "#ffffff", bone: "torso" }), /재질 하나/);
  const mixed = lens(); mixed.material = [mixed.material, mixed.material.clone()];
  assert.throws(() => helpers.addLight(mixed, { kind: "point", color: "#ffffff" }), /재질 하나/);
  for (const options of [{ intensity: 4.1 }, { distance: 4.6 }, { direction: [0, 0, 0] }, { bone: "head" }, { unknown: true }]) {
    assert.throws(() => helpers.addLight(mesh, { kind: "point", color: "#ffffff", ...options }), /불빛 설정/);
  }
  assert.throws(() => helpers.addLight(garment(body), { kind: "point", color: "#ffffff" }), /불빛 설정/);
  helpers.addLight(mesh, { kind: "point", color: "#ffffff" });
  assert.throws(() => helpers.addLight(lens(), { kind: "point", color: "#ffffff" }), /한 곳/);
});

test("export refuses hand-written invalid or duplicate light markers", async () => {
  const { doreumi } = rig(), group = new THREE.Group();
  group.userData.doreumiLight = { kind: "point", color: "#ffffff" };
  await assert.rejects(exportItem(group, { rigged: false, doreumi }), /불빛 설정/);
  delete group.userData.doreumiLight;
  for (let i = 0; i < 2; i++) {
    const mesh = lens(); mesh.userData.doreumiLight = { kind: "point", color: "#ffffff" }; group.add(mesh);
  }
  await assert.rejects(exportItem(group, { rigged: false, doreumi }), /한 곳/);
});

test("a rigid light survives actual GLB export/load/wear and follows nested mirrored transforms", async () => {
  const { scene, model, head, helpers, doreumi } = rig();
  const group = new THREE.Group(), mesh = lens(); mesh.name = "custom-lens-without-known-item-name";
  mesh.position.set(0.13, 1.85, 0.25); mesh.rotation.x = -0.1;
  group.add(mesh); group.rotation.y = 0.25; group.scale.set(-1.2, 0.8, 1.1);
  helpers.addLight(mesh, { kind: "spot", color: "#ffe2a8", position: [0.01, 0.02, 0.03], direction: [0.1, -0.3, 1] });
  helpers.placeOnBone(group, "headAccessory");
  const bytes = await exportItem(group, { rigged: false, doreumi });
  assert.equal(checkItemGlb(bytes, { rigged: false, bone: "headAccessory" }).ok, true);
  const worn = await wearDressItem(doreumi.loader, model, { id: "different-id", bytes, rigged: false, bone: "headAccessory" });
  let loaded; worn.objects[0].traverse((node) => { if (node.userData.doreumiLight) loaded = node; });
  assert.ok(loaded?.isMesh);
  assert.deepEqual(loaded.userData.doreumiLight, mesh.userData.doreumiLight);
  const preview = createItemLightPreview(scene, model, worn, false), light = preview.lights[0];
  assert.equal(light.visible, false);
  assert.equal(light.intensity, 0);
  preview.setNight(true);
  const expected = () => {
    loaded.updateWorldMatrix(true, false);
    const marker = loaded.userData.doreumiLight;
    near(light.position, new THREE.Vector3(...marker.position).applyMatrix4(loaded.matrixWorld));
    near(light.target.position.clone().sub(light.position), new THREE.Vector3(...marker.direction).transformDirection(loaded.matrixWorld));
  };
  expected();
  const previous = light.position.clone();
  head.rotation.set(0.2, -0.4, 0.1); model.position.set(2, 0, 1);
  preview.update(); expected();
  assert.ok(light.position.distanceTo(previous) > 1);
  loaded.visible = false; preview.update(); assert.equal(light.visible, false);
  loaded.visible = true; preview.update(); assert.equal(light.visible, true);
  preview.setNight(false); assert.equal(light.intensity, 0);
  preview.dispose(); assert.equal(light.parent, null); assert.equal(light.target.parent, null);
});

test("rigged export preserves extras and the light follows the real body bone, not an item namesake", async () => {
  const { scene, model, torso, body, helpers, doreumi } = rig(), mesh = garment(body);
  mesh.userData.creatorNote = "retained";
  helpers.addLight(mesh, { kind: "point", color: "#ffd58a", bone: "torso", position: [0.15, 0.2, 0.1] });
  const bytes = await exportItem(mesh, { rigged: true, doreumi });
  assert.equal(checkItemGlb(bytes, { rigged: true, bone: null }).ok, true);
  const worn = await wearDressItem(doreumi.loader, model, { id: "shirt-light", bytes, rigged: true, bone: null });
  const loaded = worn.objects[0];
  assert.equal(loaded.userData.creatorNote, "retained");
  assert.deepEqual(loaded.userData.doreumiLight, mesh.userData.doreumiLight);
  const fake = new THREE.Object3D(); fake.name = "torso"; fake.position.set(20, 20, 20); loaded.add(fake);
  model.children.splice(model.children.indexOf(loaded), 1); model.children.unshift(loaded);
  const preview = createItemLightPreview(scene, model, worn, true), light = preview.lights[0];
  preview.setNight(true);
  const position = mesh.userData.doreumiLight.position;
  near(light.position, new THREE.Vector3(...position).applyMatrix4(torso.matrixWorld));
  torso.rotation.z = 0.45; torso.position.x = 0.3; preview.update();
  near(light.position, new THREE.Vector3(...position).applyMatrix4(torso.matrixWorld));
  torso.visible = false; preview.update(); assert.equal(light.visible, false);
  torso.visible = true; preview.update(); assert.equal(light.visible, true);
  scene.visible = false; preview.update(); assert.equal(light.visible, false);
  scene.visible = true; preview.update(); assert.equal(light.visible, true);
  loaded.removeFromParent(); preview.update(); assert.equal(light.intensity, 0);
  preview.dispose();
});

test("night floor stays outside the model bounds and regular items allocate no item light", () => {
  const { scene, model } = rig();
  const bounds = new THREE.Box3().setFromObject(model), environment = createPreviewEnvironment(scene);
  const preview = createItemLightPreview(scene, model, { objects: [] }, false);
  assert.deepEqual(preview.lights, []);
  assert.equal(environment.floor.visible, false);
  environment.setNight(true); preview.setNight(true);
  assert.equal(environment.floor.visible, true);
  assert.equal(environment.floor.parent, scene);
  const after = new THREE.Box3().setFromObject(model);
  near(after.min, bounds.min); near(after.max, bounds.max);
  assert.equal(scene.background.getHexString(), "111827");
  environment.setNight(false);
  assert.equal(environment.floor.visible, false);
  assert.equal(scene.background.getHexString(), "f2ede4");
  environment.dispose(); preview.dispose();
  assert.equal(environment.floor.parent, null);
  assert.equal(scene.children.some((node) => node.isLight), false);
});
