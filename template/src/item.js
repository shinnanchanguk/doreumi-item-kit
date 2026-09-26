// The ONE file to edit. buildItem() returns a THREE.Object3D: the item Doreumi will wear.
// It runs with Doreumi standing in the rest pose. Read AGENTS.md before changing it.
//
// This example is a blue top hat on "headAccessory" (item.config.json: rigged false, bone "headAccessory").
// Rigid item recipe: build it in rest space where it should appear, then helpers.placeOnBone(item, bone).
export function buildItem({ THREE, helpers }) {
  const bone = "headAccessory";
  // Round top of the head. Doreumi has a navy curl standing up in the middle of the head
  // (landmarks().curlTop), about 0.4 higher, so the crown is tall and wide enough to cover it.
  const { headTop } = helpers.landmarks();

  const felt = new THREE.MeshStandardMaterial({ color: "#2f5d8a", roughness: 0.85 });
  const band = new THREE.MeshStandardMaterial({ color: "#f2c14e", roughness: 0.6 });

  const hat = new THREE.Group();
  hat.name = "top-hat";
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 0.48, 64), felt);
  crown.position.y = 0.24;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.03, 64), felt);
  brim.position.y = 0.015;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.308, 0.312, 0.07, 64, 1, true), band);
  ribbon.position.y = 0.07;
  hat.add(crown, brim, ribbon);

  // The brim sits a little below the very top so it rests on the round head instead of floating.
  hat.position.set(0, headTop.point.y - 0.04, 0);
  return helpers.placeOnBone(hat, bone);
}
