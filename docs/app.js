// 월 결산 현황판 — 읽기 → 검사·정리 → 중복 제거 → 정렬 → 화면
// 규칙 원문: docs/data/RULES.md
(function (root) {
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const MONTH = /^\d{4}-\d{2}$/;
  const ORDER = { "지연": 0, "진행": 1, "완료": 2 };

  // 따옴표 안 쉼표까지 처리하는 작은 CSV 읽기
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    const head = rows.shift() || [];
    return rows
      .filter(r => r.some(v => v !== ""))
      .map((r, i) => {
        const o = { 줄: i + 2 };
        head.forEach((h, j) => { o[h] = r[j] === undefined ? "" : r[j]; });
        return o;
      });
  }

  const norm = s => s.trim().replace(/\s+/g, " ").toLowerCase();

  function why(r) {
    if (!r.항목명.trim() || !r.예정일 || !r.마감월) return "필수 칸 빈칸";
    if (!DATE.test(r.예정일) || (r.결과물등록일 && !DATE.test(r.결과물등록일)) || !MONTH.test(r.마감월))
      return "날짜 형식 틀림";
    if (r.예정일.slice(0, 7) !== r.마감월) return "범위 밖 (예정일이 마감월 밖)";
    return "";
  }

  function status(r, today) {
    if (r.결과물등록일) return "완료";
    return r.예정일 >= today ? "진행" : "지연";
  }

  // 남기는 쪽: ① 결과물등록일 있음 ② 예정일 늦음 ③ 파일에서 아래 줄
  const better = (a, b) => {
    if (!!a.결과물등록일 !== !!b.결과물등록일) return a.결과물등록일 ? a : b;
    if (a.예정일 !== b.예정일) return a.예정일 > b.예정일 ? a : b;
    return a.줄 > b.줄 ? a : b;
  };

  function process(raw, today) {
    const excluded = [], dup = [], keep = new Map();
    for (const r of raw) {
      const w = why(r);
      if (w) { excluded.push({ ...r, 이유: w }); continue; }
      const key = norm(r.항목명) + "|" + r.마감월;
      const prev = keep.get(key);
      if (!prev) { keep.set(key, r); continue; }
      const win = better(prev, r), lose = win === prev ? r : prev;
      keep.set(key, win);
      dup.push({ ...lose, 이유: `${win.줄}행을 남김` });
    }
    const shown = [...keep.values()]
      .map(r => ({ ...r, 상태: status(r, today) }))
      .sort((a, b) =>
        ORDER[a.상태] - ORDER[b.상태] ||
        a.예정일.localeCompare(b.예정일) ||
        a.항목명.trim().localeCompare(b.항목명.trim(), "ko"));
    return { raw: raw.length, excluded, dup, shown };
  }

  const COLS = ["상태", "항목명", "담당역할", "예정일", "결과물등록일", "마감월"];
  const esc = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const toCSV = rows => "﻿" + [COLS.join(","), ...rows.map(r => COLS.map(c => esc(String(r[c] ?? ""))).join(","))].join("\n") + "\n";

  const api = { parseCSV, process, toCSV, COLS };
  if (typeof module !== "undefined") module.exports = api;
  root.CloseBoard = api;
})(typeof window !== "undefined" ? window : globalThis);
