// Turns what buildItem() returned into the .glb file the site loads.
//   rigid  -> only the item object, with its position/rotation relative to the bone.
//   rigged -> the garment SkinnedMesh(es) plus a copy of Doreumi's skeleton in the rest pose, so the
//             file's joints carry Doreumi's joint names (the site re-binds them by name).
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

function skinnedMeshes(object) {
  const list = [];
  object.traverse((child) => { if (child.isSkinnedMesh) list.push(child); });
  return list;
}

function restRig(doreumi) {
  const rootBone = doreumi.body.skeleton.bones.find((bone) => !bone.parent?.isBone);
  const copy = rootBone.clone(true);
  // Only bones go into the file (no attach points), each at its rest-pose transform.
  const strip = (node) => { for (const child of [...node.children]) { if (!child.isBone) node.remove(child); else strip(child); } };
  strip(copy);
  const bones = new Map();
  copy.traverse((bone) => {
    bones.set(bone.name, bone);
    const parentRest = bone === copy ? (doreumi.rest.get(rootBone.parent?.name) ?? new THREE.Matrix4()) : doreumi.rest.get(bone.parent.name);
    const local = parentRest.clone().invert().multiply(doreumi.rest.get(bone.name));
    local.decompose(bone.position, bone.quaternion, bone.scale);
  });
  copy.updateMatrixWorld(true);
  return { copy, bones };
}

export async function exportItem(object, { rigged, doreumi }) {
  const skinned = skinnedMeshes(object);
  let input = object;
  if (rigged) {
    if (!skinned.length) throw new Error("몸 따라 움직이는 옷(rigged: true)인데 helpers.makeGarment 로 만든 옷이 없어요.");
    const { copy, bones } = restRig(doreumi);
    const group = new THREE.Group(); group.name = "DoreumiItem";
    group.add(copy);
    for (const garment of skinned) {
      const joints = garment.skeleton.bones.map((bone) => bones.get(bone.name));
      if (joints.some((bone) => !bone)) throw new Error("옷이 도름이 뼈가 아닌 관절에 묶여 있어요. helpers.makeGarment 로 만들어 주세요.");
      const mesh = new THREE.SkinnedMesh(garment.geometry, garment.material);
      mesh.name = garment.name && garment.name !== "Doreumi" ? garment.name : "garment";
      mesh.position.copy(garment.position); mesh.quaternion.copy(garment.quaternion); mesh.scale.copy(garment.scale);
      mesh.bind(new THREE.Skeleton(joints, garment.skeleton.boneInverses.map((m) => m.clone())), garment.bindMatrix.clone());
      mesh.bindMode = garment.bindMode;
      group.add(mesh);
    }
    input = group;
  } else if (skinned.length) {
    throw new Error("뼈대에 묶인 옷이 들어 있어요. item.config.json 에서 rigged 를 true, bone 을 null 로 바꿔 주세요.");
  }
  let named = false;
  input.traverse((node) => { if (node.name === "Doreumi") named = true; });
  if (named) throw new Error("아이템 부품 이름으로 'Doreumi' 는 쓸 수 없어요.");
  input.updateMatrixWorld(true);
  const result = await new GLTFExporter().parseAsync(input, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
  return new Uint8Array(result);
}
