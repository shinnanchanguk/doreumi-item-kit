// Tools for building items around Doreumi. All positions here are in "rest space": the world
// coordinates of Doreumi standing in the rest pose at the origin (+Y up, +Z is the way Doreumi faces,
// +X is Doreumi's left), as drawn on screen. Soles y -1.14, round head top y 0.58, tip of the navy
// curl on the head y 0.99. landmarks() gives exact points.
//
// Two kinds of items:
//   rigid  (item.config.json rigged:false, bone:"headAccessory" ...): the file holds the object with its
//          position/rotation relative to that bone; the site does bone.add(item). Build it in rest space
//          and finish with placeOnBone(object, bone), which does that conversion.
//   rigged (rigged:true, bone:null): clothes that bend with the body. Make the shape in rest space and
//          pass it to makeGarment(), which copies skin weights from the nearest body points.
import * as THREE from "three";

/** Clothes should float this far outside the body surface (model units) so the body does not poke through. */
export const OFFSET = { min: 0.01, recommended: 0.015, max: 0.02 };

export function createHelpers(doreumi) {
  const { model, body, rest } = doreumi;
  // Per-bone skin matrix in the rest pose: what the GPU does to a body point bound 100% to that bone.
  // (Doreumi's inverse bind matrices are not the plain inverse of the rest pose: the rendered body is
  // about 7% larger than the raw mesh data, so we always work with the rendered, skinned rest surface.)
  const restSkin = body.skeleton.bones.map((bone, i) => (rest.get(bone.name) ?? new THREE.Matrix4()).clone().multiply(body.skeleton.boneInverses[i]).multiply(body.bindMatrix));

  // ---- rest-pose copy of the body surface as it is drawn (morph target on, skinned), in rest space ----
  let surface;
  function getSurface() {
    if (surface) return surface;
    const geometry = body.geometry;
    const position = geometry.attributes.position, count = position.count;
    const morph = geometry.morphAttributes.position?.[0];
    const influence = body.morphTargetInfluences?.[0] ?? 0;
    const si = geometry.attributes.skinIndex, sw = geometry.attributes.skinWeight;
    const SI = new Uint16Array(count * 4), SW = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) for (let k = 0; k < 4; k++) { SI[i * 4 + k] = si.getComponent(i, k); SW[i * 4 + k] = sw.getComponent(i, k); }
    const P = new Float32Array(count * 3), v = new THREE.Vector3(), d = new THREE.Vector3(), sum = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(position, i);
      if (morph && influence) {
        d.fromBufferAttribute(morph, i);
        if (geometry.morphTargetsRelative) v.addScaledVector(d, influence); else v.lerp(d, influence);
      }
      sum.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = SW[i * 4 + k]; if (!w) continue;
        sum.addScaledVector(d.copy(v).applyMatrix4(restSkin[SI[i * 4 + k]]), w);
      }
      P[i * 3] = sum.x; P[i * 3 + 1] = sum.y; P[i * 3 + 2] = sum.z;
    }
    const index = geometry.index ? geometry.index.array : Uint32Array.from({ length: count }, (_, i) => i);
    // Welded normals: vertices at the same place (texture seams) share one normal, so offsets do not crack.
    const weldKey = (i) => `${Math.round(P[i * 3] * 1e4)},${Math.round(P[i * 3 + 1] * 1e4)},${Math.round(P[i * 3 + 2] * 1e4)}`;
    const weld = new Int32Array(count), groups = new Map();
    for (let i = 0; i < count; i++) {
      const key = weldKey(i);
      let id = groups.get(key);
      if (id === undefined) { id = groups.size; groups.set(key, id); }
      weld[i] = id;
    }
    const acc = new Float32Array(groups.size * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let t = 0; t < index.length; t += 3) {
      const i0 = index[t], i1 = index[t + 1], i2 = index[t + 2];
      a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3);
      n.subVectors(c, b).cross(d.subVectors(a, b)); // area weighted
      for (const i of [i0, i1, i2]) { const w = weld[i] * 3; acc[w] += n.x; acc[w + 1] += n.y; acc[w + 2] += n.z; }
    }
    const N = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      n.fromArray(acc, weld[i] * 3).normalize();
      N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z;
    }
    // Uniform grid for nearest-point queries.
    const CELL = 0.04, grid = new Map();
    const cellOf = (x) => Math.floor(x / CELL);
    for (let i = 0; i < count; i++) {
      const key = `${cellOf(P[i * 3])},${cellOf(P[i * 3 + 1])},${cellOf(P[i * 3 + 2])}`;
      let list = grid.get(key); if (!list) grid.set(key, list = []); list.push(i);
    }
    // Bind-space (morphed, before skinning) copy, used to find the painted face features.
    const B = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(position, i);
      if (morph && influence) { d.fromBufferAttribute(morph, i); if (geometry.morphTargetsRelative) v.addScaledVector(d, influence); else v.lerp(d, influence); }
      B[i * 3] = v.x; B[i * 3 + 1] = v.y; B[i * 3 + 2] = v.z;
    }
    surface = { P, N, B, SI, SW, index, count, weld, weldCount: groups.size, grid, CELL, cellOf };
    return surface;
  }

  /** k nearest body vertices to (x,y,z): [{ i, d }] sorted by distance. */
  function nearest(x, y, z, k = 1) {
    const s = getSurface();
    const cx = s.cellOf(x), cy = s.cellOf(y), cz = s.cellOf(z);
    const best = [];
    for (let r = 0; r < 12; r++) {
      for (let ix = cx - r; ix <= cx + r; ix++) for (let iy = cy - r; iy <= cy + r; iy++) for (let iz = cz - r; iz <= cz + r; iz++) {
        if (Math.max(Math.abs(ix - cx), Math.abs(iy - cy), Math.abs(iz - cz)) !== r) continue;
        const list = s.grid.get(`${ix},${iy},${iz}`); if (!list) continue;
        for (const i of list) {
          const dx = s.P[i * 3] - x, dy = s.P[i * 3 + 1] - y, dz = s.P[i * 3 + 2] - z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (best.length < k || d < best[best.length - 1].d) {
            best.push({ i, d }); best.sort((p, q) => p.d - q.d); if (best.length > k) best.pop();
          }
        }
      }
      if (best.length >= k && best[best.length - 1].d <= r * s.CELL) break;
    }
    if (best.length < k) {
      // Far from the body (outside the grid search): check every point once.
      for (let i = 0; i < s.count; i++) {
        const dx = s.P[i * 3] - x, dy = s.P[i * 3 + 1] - y, dz = s.P[i * 3 + 2] - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (best.length < k || d < best[best.length - 1].d) { best.push({ i, d }); best.sort((p, q) => p.d - q.d); if (best.length > k) best.pop(); }
      }
    }
    return best;
  }

  /** Closest body point to a rest-space point: { point, normal, distance, gap } (gap < 0 means inside the body). */
  function nearestBodyPoint(point) {
    const s = getSurface();
    const [hit] = nearest(point.x, point.y, point.z, 1);
    const p = new THREE.Vector3().fromArray(s.P, hit.i * 3), normal = new THREE.Vector3().fromArray(s.N, hit.i * 3);
    return { point: p, normal, distance: hit.d, gap: new THREE.Vector3().subVectors(point, p).dot(normal) };
  }

  let rayMesh;
  /** First hit of a ray on the rest-pose body: { point, normal } or null. Handy to find the face front, the chest, etc. */
  function raycastBody(origin, direction) {
    const s = getSurface();
    if (!rayMesh) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(s.P, 3)); g.setIndex(new THREE.BufferAttribute(new Uint32Array(s.index), 1));
      rayMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    }
    const hits = new THREE.Raycaster(origin.clone(), direction.clone().normalize()).intersectObject(rayMesh);
    if (!hits.length) return null;
    const normal = hits[0].face.normal.clone();
    if (normal.dot(direction) > 0) normal.negate();
    return { point: hits[0].point.clone(), normal };
  }

  // Where the site paints the face (face texture position mapped onto the front of the head, bind space).
  const FACE_FEATURES = { eyeL: [0.142, 0.21], eyeR: [-0.136, 0.21], mouth: [0.004, 0.15], faceCenter: [0, 0.24] };
  let landmarkCache;
  /**
   * Rest-space points on the body surface: eyeL / eyeR (Doreumi's own left is +X), mouth, faceCenter,
   * headTop (round top of the head, beside the curl), curlTop (tip of the navy curl on the head),
   * chest, belly (centre of the belly swirl), back. Each is { point, normal }.
   */
  function landmarks() {
    if (landmarkCache) return landmarkCache;
    const s = getSurface(), out = {};
    for (const [name, [x, y]] of Object.entries(FACE_FEATURES)) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < s.count; i++) {
        if (s.B[i * 3 + 2] < 0.2) continue;
        const dd = Math.hypot(s.B[i * 3] - x, s.B[i * 3 + 1] - y);
        if (dd < bestD) { bestD = dd; best = i; }
      }
      out[name] = { point: new THREE.Vector3().fromArray(s.P, best * 3), normal: new THREE.Vector3().fromArray(s.N, best * 3) };
    }
    const down = new THREE.Vector3(0, -1, 0), back = new THREE.Vector3(0, 0, -1), front = new THREE.Vector3(0, 0, 1);
    const tops = [0.12, -0.12].map((z) => raycastBody(new THREE.Vector3(0, 5, z), down)).filter(Boolean);
    const headTop = tops.sort((a, b) => b.point.y - a.point.y)[0];
    out.headTop = { point: new THREE.Vector3(0, headTop.point.y, 0), normal: new THREE.Vector3(0, 1, 0) };
    out.curlTop = raycastBody(new THREE.Vector3(0, 5, 0), down);
    const bellyY = restPosition("body").y + 0.3;
    out.belly = raycastBody(new THREE.Vector3(0, bellyY, 5), back);
    out.chest = raycastBody(new THREE.Vector3(0, restPosition("torso").y + 0.2, 5), back);
    out.back = raycastBody(new THREE.Vector3(0, restPosition("torso").y + 0.2, -5), front);
    landmarkCache = out;
    return out;
  }

  /** Rest-space position of a bone or attach point. */
  function restPosition(name) {
    const matrix = rest.get(name); if (!matrix) throw new Error(`도름이 몸에 ${name} 이(가) 없어요.`);
    return new THREE.Vector3().setFromMatrixPosition(matrix);
  }
  /** Rest-space point -> coordinates relative to that bone (what a rigid item's position means). */
  function toBoneSpace(name, point) {
    const matrix = rest.get(name); if (!matrix) throw new Error(`도름이 몸에 ${name} 이(가) 없어요.`);
    return point.clone().applyMatrix4(matrix.clone().invert());
  }
  function fromBoneSpace(name, point) {
    const matrix = rest.get(name); if (!matrix) throw new Error(`도름이 몸에 ${name} 이(가) 없어요.`);
    return point.clone().applyMatrix4(matrix);
  }
  /** Rotation of a bone in the rest pose (rigid items inherit it). */
  function restQuaternion(name) {
    const matrix = rest.get(name); if (!matrix) throw new Error(`도름이 몸에 ${name} 이(가) 없어요.`);
    const q = new THREE.Quaternion(); matrix.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return q;
  }

  /**
   * For rigid items: build the object in rest space (right where it should appear on Doreumi), then call
   * placeOnBone(object, bone). It rewrites the object's transform to be relative to that bone, which is
   * what the file must hold. Returns the same object.
   */
  function placeOnBone(object, boneName) {
    const matrix = rest.get(boneName); if (!matrix) throw new Error(`도름이 몸에 ${boneName} 이(가) 없어요.`);
    object.updateMatrix();
    object.applyMatrix4(matrix.clone().invert());
    return object;
  }

  /** What the site does with a rigid item: the item becomes a child of that bone. The preview calls this for you. */
  function attachToBone(object, boneName) {
    const anchor = model.getObjectByName(boneName);
    if (!anchor) throw new Error(`붙일 자리 ${boneName} 이(가) 도름이 몸에 없어요.`);
    anchor.add(object);
    return object;
  }

  /**
   * A copy of part of the body surface, pushed outward by `offset`: the easiest way to make clothes
   * that fit. Picks body triangles whose points belong mostly to `bones` (sum of skin weights >= minWeight)
   * and pass `where(point, normal)` (rest space). The copy is smoothed (`smoothing` rounds, which also
   * irons out zigzag edges), reduced to `maxTriangles`, and pushed out to at
   * least `offset` from the body. Returns a BufferGeometry in rest space.
   */
  function bodyShell({ bones, minWeight = 0.5, offset = OFFSET.recommended, where = null, smoothing = 12, maxTriangles = 12000 }) {
    const s = getSurface();
    const skeletonBones = body.skeleton.bones.map((bone) => bone.name);
    const wanted = new Set(bones.map((name) => { const i = skeletonBones.indexOf(name); if (i < 0) throw new Error(`도름이 뼈에 ${name} 이(가) 없어요.`); return i; }));
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    const picked = new Uint8Array(s.count);
    for (let i = 0; i < s.count; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) if (wanted.has(s.SI[i * 4 + k])) sum += s.SW[i * 4 + k];
      if (sum < minWeight) continue;
      if (where) { p.fromArray(s.P, i * 3); n.fromArray(s.N, i * 3); if (!where(p, n)) continue; }
      picked[i] = 1;
    }
    const remap = new Map(), positions = [], indices = [];
    const vertexOf = (i) => {
      const w = s.weld[i];
      let id = remap.get(w);
      if (id === undefined) {
        id = remap.size; remap.set(w, id);
        positions.push(s.P[i * 3] + s.N[i * 3] * offset, s.P[i * 3 + 1] + s.N[i * 3 + 1] * offset, s.P[i * 3 + 2] + s.N[i * 3 + 2] * offset);
      }
      return id;
    };
    for (let t = 0; t < s.index.length; t += 3) {
      const i0 = s.index[t], i1 = s.index[t + 1], i2 = s.index[t + 2];
      if (!picked[i0] || !picked[i1] || !picked[i2]) continue;
      const a = vertexOf(i0), b = vertexOf(i1), c = vertexOf(i2);
      if (a !== b && b !== c && a !== c) indices.push(a, b, c);
    }
    if (!indices.length) throw new Error("고른 뼈와 조건에 맞는 몸 표면이 없어요.");
    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    // Smooth away the body's raised swirl and the zigzag cut edges, keep under the triangle limit,
    // then make sure every point is at least `offset` outside the body.
    if (maxTriangles) geometry = simplify(geometry, maxTriangles);
    // Smooth and push out in turns: soft edges, never inside the body. Raised body details (the belly
    // swirl) still show as a gentle bump under the cloth.
    for (let round = 0; round < 3; round++) {
      if (smoothing) smooth(geometry, smoothing);
      pushOutside(geometry, offset);
    }
    return geometry;
  }

  /** Neighbour lists and open-edge (boundary) flags of an indexed geometry. */
  function topology(geometry) {
    const count = geometry.attributes.position.count, index = geometry.index.array;
    const edges = new Map();
    for (let t = 0; t < index.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = index[t + k], b = index[t + ((k + 1) % 3)];
      const key = a < b ? a * count + b : b * count + a;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    const neighbors = Array.from({ length: count }, () => new Set()), boundary = Array.from({ length: count }, () => new Set());
    for (const [key, uses] of edges) {
      const a = Math.floor(key / count), b = key % count;
      neighbors[a].add(b); neighbors[b].add(a);
      if (uses === 1) { boundary[a].add(b); boundary[b].add(a); }
    }
    return { neighbors, boundary };
  }

  /**
   * Laplacian smoothing (indexed geometry). Open edges are smoothed only along the edge line, so a
   * jagged hem or sleeve end becomes a clean line while keeping its place.
   */
  function smooth(geometry, iterations = 10, factor = 0.5) {
    if (!geometry.index) throw new Error("smooth 는 index 가 있는 모양에만 쓸 수 있어요.");
    const position = geometry.attributes.position, count = position.count;
    const { neighbors, boundary } = topology(geometry);
    const next = new Float32Array(count * 3), cur = position.array;
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < count; i++) {
        const list = boundary[i].size ? boundary[i] : neighbors[i];
        if (!list.size) { next[i * 3] = cur[i * 3]; next[i * 3 + 1] = cur[i * 3 + 1]; next[i * 3 + 2] = cur[i * 3 + 2]; continue; }
        let x = 0, y = 0, z = 0;
        for (const j of list) { x += cur[j * 3]; y += cur[j * 3 + 1]; z += cur[j * 3 + 2]; }
        const m = list.size || 1;
        next[i * 3] = cur[i * 3] + (x / m - cur[i * 3]) * factor;
        next[i * 3 + 1] = cur[i * 3 + 1] + (y / m - cur[i * 3 + 1]) * factor;
        next[i * 3 + 2] = cur[i * 3 + 2] + (z / m - cur[i * 3 + 2]) * factor;
      }
      cur.set(next);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  /**
   * Fewer triangles by merging nearby points (vertex clustering). Picks the finest grid that stays
   * under maxTriangles. The server allows 40,000 triangles per item; 5,000 to 15,000 is plenty for clothes.
   */
  function simplify(geometry, maxTriangles = 12000) {
    if (!geometry.index) throw new Error("simplify 는 index 가 있는 모양에만 쓸 수 있어요.");
    if (geometry.index.count / 3 <= maxTriangles) return geometry;
    const src = geometry.attributes.position.array, index = geometry.index.array;
    const build = (cell) => {
      const ids = new Map(), sums = [], counts = [], map = new Int32Array(src.length / 3);
      for (let i = 0; i < map.length; i++) {
        const key = `${Math.floor(src[i * 3] / cell)},${Math.floor(src[i * 3 + 1] / cell)},${Math.floor(src[i * 3 + 2] / cell)}`;
        let id = ids.get(key);
        if (id === undefined) { id = ids.size; ids.set(key, id); sums.push(0, 0, 0); counts.push(0); }
        map[i] = id; sums[id * 3] += src[i * 3]; sums[id * 3 + 1] += src[i * 3 + 1]; sums[id * 3 + 2] += src[i * 3 + 2]; counts[id]++;
      }
      const tris = [], seen = new Set();
      for (let t = 0; t < index.length; t += 3) {
        const a = map[index[t]], b = map[index[t + 1]], c = map[index[t + 2]];
        if (a === b || b === c || a === c) continue;
        const key = [a, b, c].sort((x, y) => x - y).join(",");
        if (seen.has(key)) continue; seen.add(key); tris.push(a, b, c);
      }
      return { sums, counts, tris };
    };
    let lo = 0.002, hi = 0.2, best = null;
    for (let step = 0; step < 16; step++) {
      const mid = (lo + hi) / 2, result = build(mid);
      if (result.tris.length / 3 <= maxTriangles) { best = result; hi = mid; } else lo = mid;
    }
    best ??= build(hi);
    // Keep only the points some triangle still uses.
    const keep = new Map();
    for (const id of best.tris) if (!keep.has(id)) keep.set(id, keep.size);
    const positions = new Float32Array(keep.size * 3);
    for (const [id, to] of keep) for (let k = 0; k < 3; k++) positions[to * 3 + k] = best.sums[id * 3 + k] / best.counts[id];
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    out.setIndex(best.tris.map((id) => keep.get(id)));
    out.computeVertexNormals();
    return out;
  }

  /**
   * Checks a rest-space geometry against the body: how many points are inside the body (gap < 0) or
   * closer than OFFSET.min. A quick rest-pose test; always look at the moving preview too.
   */
  function measureGap(geometry) {
    const position = geometry.attributes.position, v = new THREE.Vector3();
    let inside = 0, tooClose = 0, minGap = Infinity;
    for (let i = 0; i < position.count; i++) {
      const { gap } = nearestBodyPoint(v.fromBufferAttribute(position, i));
      if (gap < 0) inside++; else if (gap < OFFSET.min) tooClose++;
      minGap = Math.min(minGap, gap);
    }
    return { vertices: position.count, inside, tooClose, minGap };
  }

  /** Moves points that are inside the body or too close out along the body normal to `minDistance`. Returns how many moved. */
  function pushOutside(geometry, minDistance = OFFSET.recommended) {
    const position = geometry.attributes.position, v = new THREE.Vector3();
    let moved = 0;
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      const { normal, gap } = nearestBodyPoint(v);
      if (gap >= minDistance) continue;
      v.addScaledVector(normal, minDistance - gap);
      position.setXYZ(i, v.x, v.y, v.z); moved++;
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return moved;
  }

  /**
   * Turns a rest-space geometry into clothes that move with Doreumi: skin weights are copied from the
   * `neighbors` nearest body points (bind pose), and the mesh is bound to Doreumi's own skeleton with
   * the body's bindMatrix and bindMode, placed like the body mesh. Export keeps Doreumi's joint names.
   */
  function makeGarment(geometry, material, { neighbors = 4, name = "garment" } = {}) {
    const s = getSurface();
    const g = geometry.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    const position = g.attributes.position, count = position.count, v = new THREE.Vector3();
    const skinIndex = new Uint16Array(count * 4), skinWeight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(position, i);
      const near = nearest(v.x, v.y, v.z, neighbors);
      const total = new Map();
      for (const { i: j, d } of near) {
        const w = 1 / (d + 1e-3);
        for (let k = 0; k < 4; k++) {
          const weight = s.SW[j * 4 + k]; if (!weight) continue;
          const bone = s.SI[j * 4 + k]; total.set(bone, (total.get(bone) ?? 0) + weight * w);
        }
      }
      const top = [...total.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = top.reduce((acc, [, w]) => acc + w, 0) || 1;
      top.forEach(([bone, w], k) => { skinIndex[i * 4 + k] = bone; skinWeight[i * 4 + k] = w / sum; });
    }
    // Rest space (what you see) -> the body's bind space: undo each point's own blended skin matrix,
    // so after skinning the garment lands exactly where it was drawn.
    const normal = g.attributes.normal, m = new THREE.Matrix4(), inv = new THREE.Matrix4(), nm = new THREE.Matrix3(), e = new Float32Array(16);
    for (let i = 0; i < count; i++) {
      e.fill(0);
      for (let k = 0; k < 4; k++) { const w = skinWeight[i * 4 + k]; if (!w) continue; const el = restSkin[skinIndex[i * 4 + k]].elements; for (let j = 0; j < 16; j++) e[j] += el[j] * w; }
      m.fromArray(e); inv.copy(m).invert();
      v.fromBufferAttribute(position, i).applyMatrix4(inv); position.setXYZ(i, v.x, v.y, v.z);
      if (normal) { nm.setFromMatrix4(inv); v.fromBufferAttribute(normal, i).applyMatrix3(nm).normalize(); normal.setXYZ(i, v.x, v.y, v.z); }
    }
    position.needsUpdate = true; if (normal) normal.needsUpdate = true;
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
    const mesh = new THREE.SkinnedMesh(g, material);
    mesh.name = name === "Doreumi" ? "garment" : name;
    mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); mesh.scale.copy(body.scale);
    mesh.bind(new THREE.Skeleton(body.skeleton.bones, body.skeleton.boneInverses.map((m) => m.clone())), body.bindMatrix.clone());
    mesh.bindMode = body.bindMode;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** A texture drawn with the 2D canvas API (saved inside the item file as PNG). Keep it 512x512 or smaller. */
  function canvasTexture(width, height, draw) {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext("2d"), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  return { OFFSET, landmarks, placeOnBone, attachToBone, smooth, simplify, restPosition, restQuaternion, toBoneSpace, fromBoneSpace, raycastBody, nearestBodyPoint, bodyShell, measureGap, pushOutside, makeGarment, canvasTexture };
}
