// Loads Doreumi the way the DoRms site does (meshopt model, morph target on, face painted on top).
// The model file comes from .doreumi/ (see scripts/fetch-model.js). Doreumi's body is never changed.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export const JOINT_NAMES = ["root", "body", "torso", "head", "shoulderL", "armL", "elbowL", "wristL", "shoulderR", "armR", "elbowR", "wristR", "thighL", "kneeL", "shinL", "footL", "thighR", "kneeR", "shinR", "footR"];
export const ATTACH_POINTS = [...JOINT_NAMES, "headAccessory", "palmL", "palmR", "lap"];
/** Doreumi's height in model units (rig-contract.json). */
export const DOREUMI_HEIGHT = 2.14;

export function createLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}

async function optionalTexture(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const texture = await new THREE.TextureLoader().loadAsync(URL.createObjectURL(blob));
    texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
    return texture;
  } catch { return null; }
}

/** Same face overlay the site paints (face-skin + neutral expression), when those files are available. */
function paintFace(material, skin, ink) {
  const uniforms = { faceSkin: { value: skin }, faceInk: { value: ink }, faceBounds: { value: new THREE.Vector4(-0.4, -0.12, 0.4, 0.64) } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = "varying vec3 vFacePosition;\nvarying vec3 vFaceRest;\n" + shader.vertexShader.replace("#include <morphtarget_vertex>", "#include <morphtarget_vertex>\nvFacePosition = transformed;\nvFaceRest = position;");
    shader.fragmentShader = "varying vec3 vFacePosition;\nvarying vec3 vFaceRest;\nuniform sampler2D faceSkin;\nuniform sampler2D faceInk;\nuniform vec4 faceBounds;\n" + shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      vec2 fp = vec2((vFacePosition.x-faceBounds.x)/(faceBounds.z-faceBounds.x), (faceBounds.w-vFacePosition.y)/(faceBounds.w-faceBounds.y));
      vec2 restFp = vec2((vFaceRest.x-faceBounds.x)/(faceBounds.z-faceBounds.x), (faceBounds.w-vFaceRest.y)/(faceBounds.w-faceBounds.y));
      float faceGate = step(.22,vFacePosition.z)*step(0.,fp.x)*step(fp.x,1.)*step(0.,fp.y)*step(fp.y,1.);
      vec4 cleanSkin = texture2D(faceSkin,restFp);
      vec4 ink = texture2D(faceInk,fp);
      diffuseColor.rgb = mix(diffuseColor.rgb,cleanSkin.rgb,cleanSkin.a*faceGate);
      diffuseColor.rgb = diffuseColor.rgb*(1.-ink.a*faceGate) + ink.rgb*ink.a*faceGate;
    `);
  };
  material.customProgramCacheKey = () => "doreumi-kit-face";
}

/**
 * Returns { model, body, bones, clips, loader, attachPoints, jointNames, height, rest } where `rest`
 * holds each node's world matrix in the rest pose (before any animation plays).
 */
export async function loadDoreumi() {
  const response = await fetch("/__doreumi/model.glb");
  if (!response.ok) throw new Error("도름이 모델이 없어요. 터미널에서 npm run preview 를 다시 실행해 주세요(모델을 먼저 받아요).");
  const loader = createLoader();
  const gltf = await loader.parseAsync(await response.arrayBuffer(), "/__doreumi/");
  const model = gltf.scene;
  let body;
  model.traverse((object) => { if (!body && object.isSkinnedMesh && object.name === "Doreumi") body = object; });
  if (!body) throw new Error("도름이 몸을 찾지 못했어요.");
  const [skin, ink] = await Promise.all([optionalTexture("/__doreumi/face-skin.webp"), optionalTexture("/__doreumi/face-neutral.webp")]);
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (object.morphTargetInfluences?.length) object.morphTargetInfluences[0] = 1;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material.isMeshStandardMaterial) continue;
      material.roughness = 0.9; material.metalness = 0;
      if (skin && ink) paintFace(material, skin, ink);
    }
  });
  model.updateMatrixWorld(true);
  const rest = new Map();
  model.traverse((object) => { if (object.name) rest.set(object.name, object.matrixWorld.clone()); });
  const bones = new Map(body.skeleton.bones.map((bone) => [bone.name, bone]));
  return { model, body, bones, clips: gltf.animations, loader, attachPoints: ATTACH_POINTS, jointNames: JOINT_NAMES, height: DOREUMI_HEIGHT, rest };
}
