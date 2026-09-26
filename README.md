# 도름이 아이템 만들기 도구

도름스 회원 선생님이 자기 AI(Claude, Codex 등)와 함께 도름스 마스코트 '도름이'에게 입힐 아이템을 만들고
도름스에 보내는 도구예요. 도름스의 '아이템 직접 만들기'에서 복사한 프롬프트가 이 도구를 실행해요.

## 권리 알림 (꼭 읽어 주세요)

- **도름이 캐릭터·모델·표정·동작 자산의 권리는 아인T에게 있어요. 이 도구의 코드만 MIT 라이선스예요.**
- 이 저장소에는 도름이 모델이 들어 있지 않아요. 도구가 실행될 때 도름스에서 개인 열쇠로 받아
  작업 폴더의 `.doreumi` 에만 두고, 깃에 올리지 않아요.
- 받은 모델은 도름스 아이템을 만들고 미리 보는 데만 쓸 수 있어요.
  다시 배포하기, 다른 곳에 올리기, 상업적으로 쓰기, 다른 캐릭터에 쓰기는 안 돼요.
- 남의 캐릭터·상표·로고를 베낀 아이템은 만들 수 없어요.
- 보낸 아이템이 승인되면 만든 선생님 이름과 함께 도름스 상점에서 팔려요.

자세한 내용은 `NOTICE` 에 있어요.

## 쓰는 법

```bash
npx -y <이 도구의 주소> init my-item
cd my-item && npm install
# .env.example 을 .env 로 복사하고 DORMS_ITEM_KEY 에 도름스에서 받은 열쇠를 넣어요.
# 명령줄에 열쇠를 직접 쓰면 터미널 기록에 남으니 .env 를 권해요.
npm run preview   # 모델을 받고 브라우저 미리보기
npm run check     # 도름스와 같은 규칙으로 검사
npm run send      # 도름스에 보내기
```

만들어진 폴더의 `README.md` 와 `AGENTS.md` 에 나머지 순서가 있어요.

## 무엇이 들어 있나

| 경로 | 내용 |
|---|---|
| `bin/cli.js` | `init <폴더>`: `template/` 을 새 폴더로 복사하고 다음 순서와 권리 알림을 보여 줘요. 다른 일은 하지 않아요. |
| `template/src/item.js` | AI가 고치는 단 하나의 파일(예시: 파란 실크 모자) |
| `template/src/helpers.js` | 뼈에 붙이기, 몸 표면 재기, 몸 따라 움직이는 옷 만들기 도구 |
| `template/src/dress.js` | 도름스 사이트가 아이템을 입히는 코드와 같은 코드 |
| `template/scripts/lib/rules.js` | 도름스 서버의 아이템 검사와 같은 규칙 |
| `template/scripts/*.js` | 모델 받기, 검사, 보내기, 상태 보기 |

## 개발

- `npm test`: 검사 규칙 시험(도름이 모델 없이 돌아가요)
- 도름스 서버의 검사(`src/lib/doreumi/itemFile.ts`)나 입히는 코드(`motion-dress.ts`)가 바뀌면
  `template/scripts/lib/rules.js`, `template/src/dress.js` 를 같이 바꿔요.
- 모델 없이 시험할 때는 `DOREUMI_MODEL_FILE=/경로/doreumi-master.glb` 로 로컬 파일을 쓸 수 있어요.
  이 파일도 권리 알림이 그대로 적용돼요.

## 라이선스

코드: MIT (`LICENSE`). 도름이 캐릭터 자산은 포함되지 않아요(`NOTICE`).
