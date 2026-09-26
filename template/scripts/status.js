#!/usr/bin/env node
// npm run status: my item requests and what the operator said.
import { loadDormsEnv } from "./lib/env.js";
import { clean } from "./lib/clean.js";

const STATUS = { pending: "검토 중", changes_requested: "고쳐 달라는 요청", approved: "승인됨", rejected: "반려됨", withdrawn: "취소됨" };

async function main() {
  const { origin, key } = loadDormsEnv();
  let response;
  try {
    response = await fetch(`${origin}/api/doreumi/item-requests`, { headers: { Authorization: `Bearer ${key}` }, redirect: "error", signal: AbortSignal.timeout(30_000) });
  } catch {
    process.exitCode = 1; console.log("도름스에 연결하지 못했어요. 인터넷 연결을 확인해 주세요."); return;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { process.exitCode = 1; console.log(`불러오지 못했어요(${response.status}). ${clean(body.error, 200)}`); return; }
  const requests = Array.isArray(body.requests) ? body.requests : [];
  if (!requests.length) { console.log("아직 보낸 요청이 없어요."); return; }
  console.log(`내 요청 ${requests.length}개 (최근 순)`);
  for (const request of requests) {
    const status = STATUS[request.status] ?? clean(request.status, 30);
    const date = typeof request.createdAt === "string" ? request.createdAt.slice(0, 10) : "";
    console.log(`- ${clean(request.name, 30)} · ${status} · ${date}${request.revision > 1 ? ` · ${request.revision}번째 판` : ""}`);
    console.log(`  요청 id: ${clean(request.id, 40)}`);
    if (request.note) console.log(`  운영자 메모: ${clean(request.note, 500)}`);
  }
}

main().catch((error) => { process.exitCode = 1; console.log(error instanceof Error ? error.message : "알 수 없는 문제가 생겼어요."); });
