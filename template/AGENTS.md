# 도름이 아이템 만들기: AI 작업 안내

이 폴더에서 일하는 AI(Claude, Codex 등)를 위한 안내다. 선생님과 함께 도름스 마스코트 '도름이'에게 입힐 아이템을
만들고, 선생님이 좋다고 하면 도름스에 보낸다. 끝까지 읽고 그대로 따른다.

## 먼저 지킬 것

- **도름이 몸(모양, 색, 뼈, 표정)은 바꾸지 않는다.** 아이템만 만든다.
- 도름이 캐릭터, 모델, 표정, 동작 자산의 권리는 **아인T**에게 있다. `.doreumi/` 에 받은 모델은 도름스 아이템을
  만들고 미리 보는 데만 쓴다. 다시 배포하거나, 다른 곳에 올리거나, 상업적으로 쓰거나, 다른 캐릭터에 쓰지 않는다.
  `.doreumi/` 는 절대 커밋하지 않는다(.gitignore 에 들어 있다).
- 남의 캐릭터, 상표, 로고를 베낀 아이템은 만들지 않는다. 선생님이 그런 것을 원하면 이유를 말하고 다른 안을 낸다.
- `DORMS_ITEM_KEY` 는 비밀번호다. 화면에 출력하거나, 파일(코드, 커밋, README)에 적거나, 캡처에 담지 않는다.
  환경 변수나 `.env` 파일(깃에 안 올라감)로만 둔다.
- 보낸 아이템은 승인되면 만든 선생님 이름과 함께 도름스 상점에서 팔린다. 선생님께 한 번 알려 드린다.
- 고치는 파일은 **`src/item.js` 와 `item.config.json` 두 개뿐**이다. `src/dress.js` 는 도름스 사이트가 아이템을
  입히는 코드를 그대로 옮긴 것이라 바꾸면 미리보기와 사이트가 달라진다. 나머지 파일도 손대지 않는다.

## 작업 순서

1. **선생님께 먼저 묻는다.** 한 번에 하나씩, 쉬운 말로.
   - 어떤 아이템인지 (예: 선글라스, 목도리, 운동화, 반팔 티셔츠, 가방)
   - 어느 자리에 입힐지: 머리, 얼굴, 목, 상의, 하의, 한 벌 옷(상의+하의), 신발, 등, 손
   - 색과 분위기
   - 아이템 이름(30자 이내)과 한 줄 설명(200자 이내)
2. `item.config.json` 을 채운다(아래 '설정' 참고).
3. `src/item.js` 의 `buildItem` 을 고쳐 아이템을 만든다(아래 '만드는 법' 참고).
4. `npm run preview` 를 실행한다. 도름이 모델을 받고 브라우저 미리보기를 띄운다(주소는 터미널에 나온다,
   보통 http://127.0.0.1:5230). **선생님이 직접 보게 한다.** 앞, 옆, 뒤 단추와 가만히, 걷기, 앉기, 손 흔들기
   단추를 눌러 보며 몸을 뚫거나 공중에 떠 있지 않은지 함께 확인한다. 마우스로 끌면 돌려 볼 수 있다.
   `src/item.js` 를 저장하면 미리보기가 저절로 다시 그린다.
5. 이상한 곳이 있으면 고치고 다시 보여 드린다. 선생님이 **좋다고 말하기 전에는 보내지 않는다.**
6. 선생님이 좋다고 하면 미리보기의 **저장** 단추를 누른다. `dist/item.glb` 와 `dist/preview.webp` 가 생긴다.
7. `npm run check` 로 검사한다. 도름스 서버와 같은 규칙이다. 실패 줄이 있으면 고치고 4번부터 다시.
8. `npm run send` 로 보낸다. 나오는 **요청 id** 를 선생님께 알려 드린다. 결과는 도름스 쪽지로 온다.
9. `npm run status` 로 요청 상태와 운영자 메모를 볼 수 있다. 고쳐 달라는 답이 오면 메모대로 고치고,
   선생님이 다시 확인한 뒤 `npm run send -- --previous <요청 id>` 로 보낸다.

## 설정 (item.config.json)

```json
{ "name": "파란 실크 모자", "description": "노란 띠를 두른 높은 파란 모자예요.",
  "slots": ["head"], "rigged": false, "bone": "headAccessory" }
```

- `slots`: 한 자리만. 한 벌 옷만 `["top","bottom"]`.
  `head` 머리 · `face` 얼굴 · `neck` 목 · `top` 상의 · `bottom` 하의 · `shoes` 신발 · `back` 등 · `hand` 손
- `rigged`: 두 종류 중 하나다.
  - `false` **뼈에 붙이는 장신구**: 모자, 안경, 목걸이, 가방, 손에 든 물건처럼 모양이 휘지 않는 것.
    `bone` 에 붙일 자리 이름을 적는다. 사이트는 그 뼈의 자식으로 붙인다(`bone.add(item)`).
  - `true` **몸 따라 움직이는 옷**: 티셔츠, 바지, 치마, 목도리처럼 몸이 굽을 때 같이 굽어야 하는 것.
    `bone` 은 `null`. 사이트는 옷을 도름이 뼈대에 관절 이름으로 다시 묶는다.
- 붙일 자리(`bone`) 이름:
  - 부착점: `headAccessory`(정수리 위) · `palmL`, `palmR`(손바닥) · `lap`(앉았을 때 무릎 위)
  - 뼈: `root` `body`(엉덩이) `torso`(가슴) `head` · `shoulderL` `armL` `elbowL` `wristL` · `shoulderR` `armR` `elbowR` `wristR`
    · `thighL` `kneeL` `shinL` `footL` · `thighR` `kneeR` `shinR` `footR`
  - `L` 은 도름이 자신의 왼쪽(+X), `R` 은 오른쪽(-X).

## 도름이 몸 (좌표)

- `buildItem` 은 도름이가 **기준 자세**로 서 있을 때 실행된다. 이 자세의 좌표를 여기서는 '기준 공간'이라 부른다.
  +Y 가 위, +Z 가 도름이가 보는 쪽(앞), +X 가 도름이의 왼쪽. 키는 2.14.
- 대략의 높이(기준 공간): 발바닥 y -1.14 · 배 소용돌이 가운데 y -0.42 · 가슴 y -0.26 · 눈 y 0.15 ·
  둥근 정수리 y 0.58 · **머리 위에 남색 소용돌이 뿔이 서 있다**(y 0.99 까지, x -0.25~0.25, 앞뒤로는 몇 cm).
  모자나 머리띠는 이 뿔을 덮거나 피해야 한다.
- 얼굴은 머리 앞쪽(z 0.3 근처)에 그려져 있다. 얼굴을 가리는 아이템은 눈, 입이 보이게 할지 선생님께 묻는다.
- 정확한 자리는 짐작하지 말고 `helpers.landmarks()` 와 `helpers.raycastBody()` 로 잰다.
- 걷기, 앉기 같은 동작이 되면 도름이 전체가 위로 1.14 올라간다. 아이템은 뼈를 따라가므로 신경 쓰지 않아도 된다.

## 만드는 법

`buildItem({ THREE, doreumi, helpers, config })` 는 `THREE.Object3D` 하나를 돌려준다.
재질은 `MeshStandardMaterial` 을 쓴다(사이트 조명과 맞는다).

### 뼈에 붙이는 장신구 (rigged: false)

기준 공간에서 도름이 위 알맞은 자리에 만들고, 마지막에 `helpers.placeOnBone(물건, bone)` 으로 돌려준다.
이 함수가 좌표를 그 뼈 기준으로 바꿔 준다. `bone` 은 `item.config.json` 의 `bone` 과 같아야 한다.

```js
export function buildItem({ THREE, helpers }) {
  const { eyeL, eyeR } = helpers.landmarks();            // 기준 공간의 점과 표면 방향
  const glasses = new THREE.Group();
  // ... eyeL.point + eyeL.normal * 0.035 에 알을 놓는 식으로 만든다
  return helpers.placeOnBone(glasses, "head");
}
```

어느 뼈에 붙일지: 모자는 `headAccessory` 또는 `head`, 안경과 가면은 `head`, 목걸이와 가방끈은 `torso`,
손에 든 물건은 `palmL`/`palmR`, 신발은 `footL`/`footR`(신발 한 켤레처럼 양쪽이 필요하면 뼈에 붙이는 방식으로는
한쪽만 된다. 양발 신발은 '몸 따라 움직이는 옷'으로 만든다).

### 몸 따라 움직이는 옷 (rigged: true)

몸 표면을 본떠 1~2cm 밖으로 띄운 껍질을 만들고 `helpers.makeGarment` 로 옷으로 바꾼다.
`makeGarment` 는 가장 가까운 몸 점의 뼈 가중치를 옮겨 와 도름이 뼈대에 묶는다. 파일에는 도름이 관절 이름이 그대로 들어간다.

```js
export function buildItem({ THREE, helpers }) {
  const { chest } = helpers.landmarks();
  const shell = helpers.bodyShell({
    bones: ["torso", "body", "shoulderL", "shoulderR", "armL", "armR"], // 반팔: 팔꿈치 뼈는 빼기
    minWeight: 0.55,
    offset: helpers.OFFSET.recommended,                                   // 몸에서 0.015 띄우기
    where: (p) => p.y < chest.point.y + 0.24 && p.y > chest.point.y - 0.45, // 목선과 밑단
  });
  const cloth = new THREE.MeshStandardMaterial({ color: "#e0604f", roughness: 0.9, side: THREE.DoubleSide });
  return helpers.makeGarment(shell, cloth, { name: "short-sleeve-shirt" });
}
```

- 뼈 고르기: 긴팔은 `elbowL/R`, `wristL/R` 까지, 바지는 `body`, `thighL/R`, `kneeL/R`, `shinL/R`,
  신발은 `footL`, `footR`. `where` 로 높이나 앞뒤를 잘라 모양을 낸다.
- 직접 만든 모양(`THREE.BufferGeometry`)도 기준 공간 좌표면 `makeGarment` 에 넣을 수 있다. 먼저
  `helpers.pushOutside(모양)` 으로 몸 안에 들어간 점을 밖으로 밀어 낸다.
- 옷은 `side: THREE.DoubleSide` 로 두면 소매 안쪽이 비어 보이지 않는다.

### helpers 목록

| 이름 | 하는 일 |
|---|---|
| `OFFSET` | 몸에서 띄울 거리 `{ min: 0.01, recommended: 0.015, max: 0.02 }` |
| `landmarks()` | 기준 공간의 점 `{ point, normal }`: `eyeL` `eyeR` `mouth` `faceCenter` `headTop` `curlTop` `chest` `belly` `back` |
| `raycastBody(시작점, 방향)` | 기준 자세의 몸에 광선을 쏴 처음 닿는 `{ point, normal }` (없으면 null) |
| `nearestBodyPoint(점)` | 가장 가까운 몸 점 `{ point, normal, distance, gap }`, gap 이 음수면 몸 안 |
| `restPosition(이름)` · `restQuaternion(이름)` | 뼈나 부착점의 기준 공간 위치와 방향 |
| `toBoneSpace(이름, 점)` · `fromBoneSpace(이름, 점)` | 기준 공간과 뼈 기준 좌표 사이 바꾸기 |
| `placeOnBone(물건, 이름)` | 기준 공간에 만든 장신구를 그 뼈 기준으로 바꿔 돌려줌 |
| `bodyShell({ bones, minWeight, offset, where, smoothing, maxTriangles })` | 몸 표면을 본뜬 옷 껍질(부드럽게 다듬고 면 수를 줄이고 몸 밖으로 밀어 냄) |
| `makeGarment(모양, 재질, { name })` | 기준 공간 모양을 몸 따라 움직이는 옷으로 |
| `pushOutside(모양, 거리)` | 몸 안이나 너무 가까운 점을 몸 밖으로 |
| `measureGap(모양)` | `{ vertices, inside, tooClose, minGap }`: 기준 자세에서 몸을 뚫는 점 수 |
| `smooth(모양, 횟수)` · `simplify(모양, 최대면수)` | 매끄럽게 · 면 수 줄이기 |
| `canvasTexture(가로, 세로, 그리기함수)` | 2D 캔버스로 그린 무늬(파일 안에 PNG 로 들어감, 512 이하 권장) |

`window.__kit` 에 `THREE`, `doreumi`, `helpers` 가 있어 브라우저 콘솔에서 값을 재 볼 수 있다.

## 몸을 뚫지 않게

- 옷은 몸에서 0.01~0.02 띄운다. `measureGap` 의 `inside` 와 `tooClose` 가 0 이어야 한다.
- 그래도 동작 중에는 뚫릴 수 있다. 특히 **겨드랑이(손 흔들기), 엉덩이와 허벅지(앉기), 무릎(걷기)**을
  옆과 뒤에서 꼭 본다. 뚫리면 그 부분을 조금 더 띄우거나(`offset`), 그 자리를 옷에서 빼거나(`where`),
  뼈 가중치 경계에 걸친 부분을 줄인다(`minWeight` 를 올리기).
- 장신구는 몸에 살짝 닿거나 1cm 이내로 붙게 한다. 떠 보이면 `raycastBody` 로 표면을 다시 잰다.
- 배의 소용돌이는 튀어나온 모양이라 옷 위로 살짝 볼록하게 비친다. 선생님이 싫어하면 `offset` 을 조금 키운다.

## 한도 (npm run check 가 보는 것, 도름스 서버와 같음)

- 파일 3MB 이하, glTF 2.0 바이너리(.glb) 하나에 모두 담기(바깥 파일, 주소 없음)
- 면(삼각형) 40,000개 이하. 옷은 5,000~15,000개면 충분하다(`bodyShell` 은 12,000개로 맞춘다)
- 그림 4장 이하, 한 장 1MB 이하, PNG, JPG, WebP 만
- 동작(애니메이션) 넣지 않기. 도름이 몸을 따라 움직인다
- 부품 200개 이하. 부품 이름으로 `Doreumi` 쓰지 않기
- 쓸 수 있는 확장: KHR_materials_emissive_strength, KHR_texture_transform, KHR_materials_unlit,
  EXT_meshopt_compression, KHR_mesh_quantization
- 몸 따라 움직이는 옷은 뼈대 연결이 있어야 하고 관절 이름이 모두 도름이 뼈여야 한다
- 뼈에 붙이는 장신구는 뼈대 연결이 없어야 하고 `bone` 이 위 목록에 있어야 한다
- 미리보기 그림 WebP, 400KB 이하 · 이름 1~30자 · 설명 200자 이하

## 문제가 생기면

- 미리보기 아래에 빨간 글씨가 뜨면 그 내용을 고친다. 브라우저 콘솔도 본다.
- 모델을 못 받으면: `DORMS_ORIGIN`, `DORMS_ITEM_KEY` 를 확인한다. 교사 인증과 받은 도름 10도름 이상이 필요하다.
  모델을 새로 받으려면 `npm run model`.
- 브라우저가 저절로 안 열리면 터미널에 나온 주소를 선생님께 알려 드린다.
