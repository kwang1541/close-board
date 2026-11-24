// 검사표(tests/cases.md) 10줄을 화면과 같은 처리 코드(docs/app.js)로 돌린다.
// 하나라도 기대와 다르면 종료 코드 1 → Actions 에서 빨강, 배포 안 함.
// 사용: node tests/check.js [--json 결과파일]
const fs = require("fs");
const path = require("path");
const { process: run } = require("../docs/app.js");

const TODAY = "2026-11-10"; // cases.md 의 고정 기준일
const md = fs.readFileSync(path.join(__dirname, "cases.md"), "utf8");

const cases = md.split(/\r?\n/)
  .filter(l => /^\|\s*\d+\s*\|/.test(l))
  .map(l => {
    const [no, input, expect, why] = l.split("|").slice(1, 5).map(s => s.trim());
    return { no: +no, input, expect, why };
  });

function toRows(input) {
  let target = 0;
  const rows = input.split(" ; ").map((s, i) => {
    if (s.startsWith("★")) { target = i; s = s.slice(1); }
    const [항목명, 예정일, 결과물등록일, 마감월] = s.split(" · ")
      .map(v => v.trim() === "(빈칸)" ? "" : v.trim().replace(/␣/g, " "));
    return { 줄: i + 2, 항목명, 담당역할: "", 예정일, 결과물등록일, 마감월, 비고: "" };
  });
  return { rows, target: rows[target].줄 };
}

function actual(c) {
  const { rows, target } = toRows(c.input);
  const r = run(rows, TODAY);
  if (c.expect.startsWith("순서:")) return "순서: " + r.shown.map(x => x.항목명.trim()).join(" > ");
  if (r.excluded.some(x => x.줄 === target)) return "제외";
  if (r.dup.some(x => x.줄 === target)) return "중복";
  const s = r.shown.find(x => x.줄 === target);
  return s ? s.상태 : "(없음)";
}

const fails = [];
for (const c of cases) {
  const got = actual(c);
  if (got !== c.expect) fails.push({ ...c, got });
}
const pass = cases.length - fails.length;
console.log(`검사표 ${cases.length}줄 중 통과 ${pass}`);
for (const f of fails) console.log(`✗ ${f.no}번 줄 · 기대 ${f.expect} · 실제 ${f.got} — ${f.input}`);

const i = process.argv.indexOf("--json");
if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify({ 통과: pass, 전체: cases.length }));
if (cases.length !== 10) { console.log(`✗ 검사표는 10줄이어야 함 (지금 ${cases.length}줄)`); process.exit(1); }
process.exit(fails.length ? 1 : 0);
