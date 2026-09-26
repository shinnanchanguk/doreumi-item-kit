// How the DoRms site puts an item file on Doreumi. This is a copy of wearDressItem in the site's
// src/lib/doreumi/motion-dress.ts. Do not change it here: the preview must show exactly what the site shows.
import * as THREE from "three";

/**
 * rigid item  -> the file's scene becomes a child of the named bone (anchor.add).
 * rigged item -> every SkinnedMesh is re-bound to Doreumi's skeleton by joint NAME, keeping its own
 *               inverse bind matrices, placed like the body mesh and bound with the body's bindMatrix.
 */
export async function wearDressItem(loader, model, item) {
  const gltf = await loader.parseAsync(item.bytes.buffer.slice(item.bytes.byteOffset, item.bytes.byteOffset + item.bytes.byteLength), "");
  const objects = [];
  if (item.rigged) {
    let body;
    model.traverse((object) => { if (!body && object instanceof THREE.SkinnedMesh && object.name === "Doreumi") body = object; });
    if (!body) model.traverse((object) => { if (!body && object instanceof THREE.SkinnedMesh) body = object; });
    if (!body) throw new Error("Doreumi body missing");
    const bones = new Map(body.skeleton.bones.map((bone) => [bone.name, bone]));
    const garments = [];
    gltf.scene.traverse((object) => { if (object instanceof THREE.SkinnedMesh) garments.push(object); });
    for (const garment of garments) {
      const joints = garment.skeleton.bones.map((bone) => bones.get(bone.name));
      if (joints.some((bone) => !bone)) throw new Error("Doreumi item joint mismatch");
      garment.removeFromParent();
      garment.position.copy(body.position); garment.quaternion.copy(body.quaternion); garment.scale.copy(body.scale);
      garment.bind(new THREE.Skeleton(joints, garment.skeleton.boneInverses), body.bindMatrix);
      garment.bindMode = body.bindMode; garment.frustumCulled = false; garment.name = `DoreumiItem_${item.id}`;
      body.parent?.add(garment); objects.push(garment);
    }
  } else {
    const anchor = item.bone ? model.getObjectByName(item.bone) : undefined;
    if (!anchor) throw new Error("Doreumi item anchor missing");
    const root = gltf.scene; root.name = `DoreumiItem_${item.id}`;
    root.traverse((object) => { if (object instanceof THREE.Mesh) object.frustumCulled = false; });
    anchor.add(root); objects.push(root);
  }
  return { id: item.id, objects };
}

export function takeOffDressItem(loaded) {
  for (const root of loaded.objects) {
    root.removeFromParent();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
  }
}
