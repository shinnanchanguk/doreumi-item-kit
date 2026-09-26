#!/usr/bin/env node
// doreumi-item-kit init <폴더>: copies template/ into a new folder. Runs nothing else.
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEMPLATE = resolve(KIT, "template");

const RIGHTS = `[권리 알림]
- 도름이 캐릭터·모델·표정·동작 자산의 권리는 아인T에게 있어요. 이 도구의 코드만 MIT 라이선스예요.
- 도름이 모델은 도름스 아이템을 만들고 미리 보는 데만 쓸 수 있어요.
  다시 배포하기, 다른 곳에 올리기, 상업적으로 쓰기, 다른 캐릭터에 쓰기는 안 돼요.
- 받은 모델(.doreumi 폴더)은 깃에 올리지 않아요. .gitignore 에 이미 들어 있어요.
- 남의 캐릭터·상표·로고를 베낀 아이템은 만들지 마세요.
- 보낸 아이템이 승인되면 만든 사람 이름과 함께 도름스 상점에서 팔려요.`;

function usage() {
  console.log(`도름이 아이템 만들기 도구

쓰는 법:
  npx -y <도구 주소> init <폴더 이름>

폴더를 만든 뒤 그 안의 README.md 와 AGENTS.md 를 읽고 따라 주세요.

${RIGHTS}`);
}

function init(target) {
  if (!target) { console.log("만들 폴더 이름을 적어 주세요. 예: init my-hat"); process.exitCode = 1; return; }
  const dir = resolve(process.cwd(), target);
  if (existsSync(dir) && readdirSync(dir).length) {
    console.log(`${target} 폴더가 이미 있고 비어 있지 않아요. 다른 이름을 쓰거나 빈 폴더를 골라 주세요.`);
    process.exitCode = 1; return;
  }
  cpSync(TEMPLATE, dir, { recursive: true, errorOnExist: true, filter: (src) => !/[\\/](node_modules|dist|\.doreumi)([\\/]|$)/.test(src.slice(TEMPLATE.length)) });
  // npm drops dotfiles like .gitignore from packages, so they travel with a leading underscore.
  for (const [from, to] of [["_gitignore", ".gitignore"], ["_env.example", ".env.example"]]) {
    if (existsSync(resolve(dir, from))) renameSync(resolve(dir, from), resolve(dir, to));
  }
  const pkgPath = resolve(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const name = basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "my-doreumi-item";
  pkg.name = name.slice(0, 60);
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  const lockPath = resolve(dir, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.name = pkg.name; if (lock.packages?.[""]) lock.packages[""].name = pkg.name;
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  }

  console.log(`${target} 폴더를 만들었어요.

다음 순서:
  1. cd ${target}
  2. npm install
  3. README.md 와 AGENTS.md 를 끝까지 읽기
  4. npm run preview  (도름이 모델을 받고 브라우저 미리보기를 띄워요)
  5. src/item.js 를 고쳐 아이템 만들기, 미리보기에서 '저장'
  6. npm run check  → 선생님이 좋다고 하시면 npm run send

DORMS_ORIGIN 과 DORMS_ITEM_KEY 는 환경 변수나 .env 파일로 넣어 주세요(.env.example 참고).
열쇠는 비밀번호처럼 다뤄 주세요. 코드·깃허브·화면 캡처에 넣지 않아요.

${RIGHTS}`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === "init") init(rest[0]);
else { usage(); if (command && command !== "help" && command !== "--help") process.exitCode = 1; }
