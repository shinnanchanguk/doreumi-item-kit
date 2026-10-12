// Preview the same bounded marker the school reads, only after export -> load -> wear.
// Lights and the night floor belong to the preview scene, never to the exported item/model.
import * as THREE from "three";
import { ITEM_LIGHT_MAX_PER_ITEM, parseItemLight } from "./itemLight.js";

export function createItemLightPreview(scene, model, worn, rigged) {
  const roots = new Set(worn.objects);
  const anchors = new Map();
  const collectAnchors = (node) => {
    if (roots.has(node)) return;
    if (node.name && !anchors.has(node.name)) anchors.set(node.name, node);
    for (const child of node.children) collectAnchors(child);
  };
  collectAnchors(model);
  const sources = [];
  for (const root of roots) root.traverse((mesh) => {
    if (!Object.hasOwn(mesh.userData, "doreumiLight")) return;
    const marker = mesh.isMesh && parseItemLight(mesh.userData.doreumiLight, rigged);
    if (!marker || (rigged && !mesh.isSkinnedMesh)) throw new Error("내보낸 아이템의 불빛 설정을 읽지 못했어요.");
    const anchor = marker.bone ? anchors.get(marker.bone) : mesh;
    if (!anchor) throw new Error(`불빛을 붙일 뼈 ${marker.bone}을 찾지 못했어요.`);
    sources.push({ mesh, anchor, marker });
  });
  if (sources.length > ITEM_LIGHT_MAX_PER_ITEM) throw new Error("아이템 하나에는 불빛을 한 곳만 넣을 수 있어요.");

  const entries = sources.map((source) => {
    const { marker } = source;
    const light = marker.kind === "spot"
      ? new THREE.SpotLight(marker.color, 0, marker.distance, THREE.MathUtils.degToRad(marker.angle), 0.65, 2)
      : new THREE.PointLight(marker.color, 0, marker.distance, 2);
    light.name = "ItemPreviewLight";
    light.castShadow = false;
    light.visible = false;
    scene.add(light);
    if (light.isSpotLight) scene.add(light.target);
    return { ...source, light };
  });
  let night = false;
  const direction = new THREE.Vector3();
  function visibleOnModel(object) {
    let attached = false, inScene = false;
    for (let node = object; node; node = node.parent) {
      if (!node.visible) return false;
      if (node === model) attached = true;
      if (node === scene) inScene = true;
    }
    return attached && inScene;
  }
  function update() {
    for (const { mesh, anchor, marker, light } of entries) {
      light.visible = night && visibleOnModel(mesh) && visibleOnModel(anchor);
      light.intensity = light.visible ? marker.intensity : 0;
      if (!light.visible) continue;
      anchor.updateWorldMatrix(true, false);
      light.position.fromArray(marker.position).applyMatrix4(anchor.matrixWorld);
      if (light.isSpotLight) {
        direction.fromArray(marker.direction).transformDirection(anchor.matrixWorld);
        light.target.position.copy(light.position).add(direction);
        light.target.updateMatrixWorld(true);
      }
    }
  }
  return {
    lights: entries.map(({ light }) => light),
    setNight(value) { night = value === true; update(); },
    update,
    dispose() {
      for (const { light } of entries) {
        light.removeFromParent();
        if (light.isSpotLight) light.target.removeFromParent();
        light.dispose();
      }
    },
  };
}

export function createPreviewEnvironment(scene) {
  const lights = [new THREE.HemisphereLight(0xffffff, 0xb4c3d7, 2.2)];
  for (const [color, intensity, x, y, z] of [[0xfffbf5, 3.1, -3.2, 5.8, 4.6], [0xcfe2ff, 1.35, 4, 3, 1.5], [0x8faeff, 1.05, -3, 3.5, -4]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    lights.push(light);
  }
  const dayIntensities = lights.map((light) => light.intensity);
  scene.add(...lights);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ color: 0x67717e, roughness: 1 }));
  floor.name = "ItemPreviewFloor";
  floor.rotation.x = -Math.PI / 2;
  floor.visible = false;
  scene.add(floor);
  const background = new THREE.Color();
  function setNight(night) {
    lights.forEach((light, index) => { light.intensity = dayIntensities[index] * (night ? 0.06 : 1); });
    floor.visible = night;
    scene.background = background.set(night ? 0x111827 : 0xf2ede4);
  }
  setNight(false);
  return {
    floor, setNight,
    dispose() {
      for (const light of lights) { light.removeFromParent(); light.dispose(); }
      floor.removeFromParent(); floor.geometry.dispose(); floor.material.dispose();
    },
  };
}
