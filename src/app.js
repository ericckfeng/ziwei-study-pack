/* 紫微研習包介面：看盤、寫筆記、進度、練習、備份。資料與範本來自 core.js（window.ZW）。 */
"use strict";
const Z = window.ZW;
const { BR, PAL, CELL, CELLS, PK, PATS, PARTNER, QUIET, DIV, TABLES, STARS, SIHUA, ORDER, BRIDGES, HUA, STEMS, HUA_LIST, HUA_TXT, HUA_BOOK, AUX, BOOK, CASES } = Z;
const CFG = Object.assign({
  notesDir: "筆記",
  chartTool: "萬用命盤產生器.html",
  chartToolOnline: "https://ericckfeng.github.io/ziwei-astrology-tool/",
}, window.ZIWEI_CONFIG || {});

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ymd = d => `${d.getFullYear()}-${Z.pad(d.getMonth() + 1)}-${Z.pad(d.getDate())}`;
const hm = d => `${Z.pad(d.getHours())}:${Z.pad(d.getMinutes())}`;
const id2 = Z.cellId, label = Z.label, short = Z.shortName;
const starsTxt = a => a.join("・");
const cellNo = c => (c.t - 1) * 12 + c.m + 1;
const isA = k => PK[k].cls === "A" && !QUIET.has(k);
const isB = k => PK[k].cls === "B" && PK[k].occ.length <= 4;   // 只標地支有限的 B 類
const rand = a => a[Math.floor(Math.random() * a.length)];
/* 慧心齋主兩書重點（book.js）：命例、潛能 */
const POT_STARS = Object.keys(BOOK.POT);
const caseChips = c => c.cells.map(id => `<button class="chip" data-go="${id}">${label(CELL[id])}</button>`).join("");
const CASE_FLAG = { birth: "已依生辰排盤更正：", star: "表號已依主星更正：", none: "⚠ " };
const caseFlag = c => c.ok && !(c.bc && !c.bFit) && !c.shenBad ? "" : `<div class="cflag">${c.ok ? "⚠ " : CASE_FLAG[c.v]}${esc(Z.caseWhere(c))}</div>`;
const caseBirth = c => (c.note ? `<div class="note-src">校勘${c.verified ? `（已對照原書 ${c.verified}）` : ""}：${esc(c.note)}</div>` : "") + (c.bc ? `<div class="note-src">生辰 ${Z.birthTxt(c)}・${Z.JU_NAME[c.bc.ju]}${c.auxCheck.length ? `　輔煞核對 ${c.auxCheck.map(a => a.s + (a.ok ? "✓" : "✗")).join(" ")}` : ""}</div>` : "");
function caseHTML(c, { links = true } = {}) {
  const head = c.src === "hua" ? `<b>${c.g}年・${c.who}</b>` : `<b>${c.who}</b><span class="kd">${c.kind}</span>`;
  const body = c.src === "hua" ? `<p>${c.txt}</p>` : `<p><span class="kd">${c.other}</span><br>${c.story}</p><p><b class="fix">解方</b>${c.fix}</p>`;
  const br = c.cells.length === 1 ? BR[+c.cells[0].slice(2)] : c.br;
  return `<div class="case">${head}　<span class="cfg">命${br}：${c.cfg}</span>${body}${caseBirth(c)}${caseFlag(c)}${links && (c.cells.length || c.bc) ? `<div class="links">${caseChips(c)}${c.bc ? `<button class="chip" data-bload="${c.who}">排盤</button>` : ""}</div>` : ""}</div>`;
}
const POT_KV = [["精神潛能", "mind"], ["物質潛能", "body"], ["幸運顏色", "lucky"], ["矯正顏色", "fix"], ["精神剋星", "kMind"], ["物質剋星", "kBody"]];
const potAlt = (s, f) => { const A = BOOK.POT_ALT[s]; return A && A[f] && A[f] !== BOOK.POT[s][f] ? `<span class="alt" title="${esc(A.src)}">另一份筆記：${A[f]}</span>` : ""; };
const potKV = s => `<dl class="kv pk">${POT_KV.map(([k, f]) => `<dt>${k}</dt><dd>${BOOK.POT[s][f]}${potAlt(s, f)}</dd>`).join("")}</dl>`;
const potMore = s => { const P = BOOK.POT[s]; return `<details class="pmore"><summary>心法與適合行業</summary><p>${P.core}</p><p><b>精神轉化</b>　${P.tMind}</p><p><b>物質轉化</b>　${P.tBody}</p><p><b>最適環境</b>　${P.jobs}</p></details>`; };
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);
const ONLINE = location.protocol !== "file:";   // 從網站開啟（GitHub Pages），而不是研習包裡的檔案
const PATH_ORDER = [1, 7, 2, 8, 3, 9, 4, 10, 5, 11, 6, 12].flatMap(t => Array.from({ length: 12 }, (_, m) => CELL[id2(t, m)]));

/* ───────── 瀏覽器儲存（IndexedDB，失敗時退回記憶體） ───────── */
const DB = (() => {
  let db = null; const mem = { kv: new Map(), notes: new Map(), mirror: new Map() };
  const open = () => new Promise(res => {
    try {
      const r = indexedDB.open("ziwei-study-pack", 1);
      r.onupgradeneeded = () => ["kv", "notes", "mirror"].forEach(n => r.result.createObjectStore(n));
      r.onsuccess = () => { db = r.result; res(true); };
      r.onerror = () => res(false);
    } catch { res(false); }
  });
  const run = (st, mode, fn) => new Promise((res, rej) => {
    const t = db.transaction(st, mode), r = fn(t.objectStore(st));
    t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
  });
  return {
    open,
    get: (st, k) => db ? run(st, "readonly", s => s.get(k)) : Promise.resolve(mem[st].get(k)),
    set: (st, k, v) => db ? run(st, "readwrite", s => s.put(v, k)) : (mem[st].set(k, v), Promise.resolve()),
    del: (st, k) => db ? run(st, "readwrite", s => s.delete(k)) : (mem[st].delete(k), Promise.resolve()),
    replaceAll: (st, entries) => db ? run(st, "readwrite", s => { s.clear(); for (const [k, v] of entries) s.put(v, k); }) : (mem[st] = new Map(entries), Promise.resolve()),
    entries: st => db ? new Promise((res, rej) => {
      const out = [], r = db.transaction(st).objectStore(st).openCursor();
      r.onsuccess = () => { const c = r.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
      r.onerror = () => rej(r.error);
    }) : Promise.resolve([...mem[st]]),
  };
})();

/* ───────── 筆記存取：資料夾模式（Chrome／Edge）或瀏覽器模式 ───────── */
const S = { mode: "browser", dir: null, perm: false, lost: false, notes: new Map(), tpl: null, storageOK: true,
  canFolder: "showDirectoryPicker" in window, lastBackup: 0, lastSave: null, saveErr: "" };
const tpl = () => S.tpl || (S.tpl = new Map(Z.allNotes(ymd(new Date())).map(f => [f.path, f.text])));
const noteText = p => S.notes.get(p) ?? tpl().get(p) ?? "";
const statusOf = c => Z.getFront(S.notes.get(Z.PATH.cell(c)) || "", "狀態") || "未讀";
const editable = () => S.mode === "browser" || S.perm;

async function walk(dir, prefix = "", out = new Map()) {
  for await (const [name, h] of dir.entries()) {
    if (name.startsWith(".")) continue;
    if (h.kind === "directory") await walk(h, prefix + name + "/", out);
    else if (name.endsWith(".md")) out.set(prefix + name, await (await h.getFile()).text());
  }
  return out;
}
async function fileHandle(path, create) {
  const parts = path.split("/"); let d = S.dir;
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create });
  return d.getFileHandle(parts[parts.length - 1], { create });
}
async function readFile(path) { try { return await (await (await fileHandle(path, false)).getFile()).text(); } catch { return null; } }
async function writeFile(path, text) { const w = await (await fileHandle(path, true)).createWritable(); await w.write(text); await w.close(); }
async function hasEntry(dir, name) { try { await dir.getDirectoryHandle(name); return true; } catch { return false; } }

async function loadFolder() {
  S.notes = await walk(S.dir);
  S.lost = false;
  await DB.replaceAll("mirror", [...S.notes]).catch(() => {});
}
async function persist(path, text) {
  if (S.mode === "folder") {
    if (!S.perm) throw new Error("資料夾未連接");
    await writeFile(path, text);
    DB.set("mirror", path, text).catch(() => {});
  } else await DB.set("notes", path, text);
  S.notes.set(path, text);
}
let chain = Promise.resolve();
const queue = fn => (chain = chain.then(fn, fn));
function saveNote(path, { sections = {}, status, fn } = {}) {
  return queue(async () => {
    let base = S.mode === "folder" ? await readFile(path) : S.notes.get(path);   // 先讀最新檔案，保留 Obsidian 那邊的修改
    if (base == null) base = S.notes.get(path) ?? tpl().get(path);
    if (base == null) return;
    let t = fn ? fn(base) : base;
    for (const [n, v] of Object.entries(sections)) t = Z.setSection(t, n, v);
    if (status) t = Z.setFront(t, "狀態", status);
    try { await persist(path, t); S.lastSave = new Date(); S.saveErr = ""; }
    catch (e) { S.saveErr = "沒有存到：" + (e.message || e); if (S.mode === "folder") { S.perm = false; S.lost = true; renderBanner(); } }
    updateSaved();
  });
}
async function fillMissing(paths) {
  for (const p of paths) await persist(p, tpl().get(p));
  return paths.length;
}
async function importNotes(list, tag) {
  let added = 0, merged = 0;
  for (const { path, text } of list) {
    const p = Z.normalizeImportPath(path);
    if (!p.endsWith(".md") || !text) continue;
    const cur = S.mode === "folder" ? await readFile(p) : S.notes.get(p);
    if (cur == null) { await persist(p, text); added++; continue; }
    const r = Z.mergeNote(cur, text, tag);
    if (r.changed) { await persist(p, r.text); merged++; }
  }
  return { added, merged };
}

async function boot() {
  S.storageOK = await DB.open();
  S.lastBackup = (await DB.get("kv", "lastBackup").catch(() => 0)) || 0;
  const dir = S.canFolder ? await DB.get("kv", "dir").catch(() => null) : null;
  if (dir) {
    S.mode = "folder"; S.dir = dir;
    let p = "prompt"; try { p = await dir.queryPermission({ mode: "readwrite" }); } catch {}
    if (p === "granted") { try { await loadFolder(); S.perm = true; } catch { S.lost = true; } }
    if (!S.perm) S.notes = new Map(await DB.entries("mirror").catch(() => []));
  } else S.notes = new Map(await DB.entries("notes").catch(() => []));
  const last = await DB.get("kv", "cur").catch(() => null);
  if (last && CELL[last]) cur = { t: CELL[last].t, m: CELL[last].m };
}
async function reconnect() {
  try {
    if ((await S.dir.requestPermission({ mode: "readwrite" })) !== "granted") return;
    await loadFolder(); S.perm = true; refresh(); toast(`已連接「${S.dir.name}」`);
  } catch { S.lost = true; renderBanner(); toast("找不到這個資料夾，可能已經搬走，請重新選擇"); }
}
async function chooseFolder() {
  if (!S.canFolder) {
    await ask("這個瀏覽器不能直接存到資料夾", "請改用 Chrome 或 Edge 打開研習頁。用 Safari、Firefox 也可以讀寫，筆記會存在瀏覽器裡，記得常按「匯出備份」。", [["知道了", 1]]);
    return;
  }
  let h; try { h = await window.showDirectoryPicker({ id: "ziwei-notes", mode: "readwrite" }); } catch { return; }
  if (!(await hasEntry(h, "144格")) && await hasEntry(h, CFG.notesDir)) h = await h.getDirectoryHandle(CFG.notesDir);   // 選到研習包上層時，自動進入「筆記」
  const fromBrowser = S.mode === "browser" ? [...S.notes] : [];
  S.dir = h; S.mode = "folder"; S.perm = true;
  await DB.set("kv", "dir", h).catch(() => {});
  await loadFolder();
  const missing = [...tpl().keys()].filter(p => !S.notes.has(p));
  if (missing.length === tpl().size) {
    const ok = await ask("這個資料夾裡還沒有筆記", `要在「${esc(h.name)}」裡建立全部 ${missing.length} 則筆記嗎？<br>如果選錯資料夾，按「先不要」再重新選。`, [["建立筆記", 1], ["先不要", 0]]);
    if (ok === 0) await fillMissing(missing);
  } else if (missing.length) await fillMissing(missing);   // 只補缺少的檔案，不覆蓋
  if (fromBrowser.length) {
    const ok = await ask("要把瀏覽器裡的筆記搬進資料夾嗎？", `這個瀏覽器裡已經有 ${fromBrowser.length} 則筆記。合併時，空白的段落會補上；兩邊都寫了的段落會接在後面，不會蓋掉任何文字。`, [["合併進資料夾", 1], ["不要", 0]]);
    if (ok === 0) { const r = await importNotes(fromBrowser.map(([path, text]) => ({ path, text })), "瀏覽器裡的版本"); toast(`已合併 ${r.merged + r.added} 則`); }
  }
  refresh(); toast(`已連接筆記資料夾「${h.name}」`);
}
async function useBrowser() {
  const ok = await ask("改回存在瀏覽器？", "研習頁會停止寫入資料夾，資料夾裡的檔案不會被刪除。之後寫的筆記會存在這個瀏覽器裡。", [["改回瀏覽器", 1], ["取消", 0]]);
  if (ok !== 0) return;
  await DB.del("kv", "dir").catch(() => {});
  S.mode = "browser"; S.dir = null; S.perm = false; S.lost = false;
  S.notes = new Map(await DB.entries("notes").catch(() => []));
  refresh();
}
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function exportZip() {
  const files = [], seen = new Set();
  for (const [p, t] of tpl()) { files.push({ path: CFG.notesDir + "/" + p, data: S.notes.get(p) ?? t }); seen.add(p); }
  for (const [p, t] of S.notes) if (!seen.has(p)) files.push({ path: CFG.notesDir + "/" + p, data: t });
  download(new Blob([Z.makeZip(files)], { type: "application/zip" }), `紫微筆記備份-${ymd(new Date())}.zip`);
  S.lastBackup = Date.now(); await DB.set("kv", "lastBackup", S.lastBackup).catch(() => {});
  renderBanner(); if (view() === "backup") renderBackup();
  toast("已下載備份檔，請放在安全的地方");
}
async function runImport(list, tag) {
  if (!editable()) { toast("請先重新連接筆記資料夾"); return; }
  if (!list.length) { toast("沒有找到 .md 筆記檔"); return; }
  const r = await importNotes(list, tag);
  refresh();
  await ask("匯入完成", `新增 ${r.added} 則、合併 ${r.merged} 則筆記。兩邊都寫過的段落，匯入的文字接在原文後面，用「（${esc(tag)}）」標示。`, [["好", 1]]);
}

/* ───────── 小工具：提示與對話框 ───────── */
let tt; function toast(s) { const t = $("#toast"); t.textContent = s; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2600); }
function ask(title, html, buttons) {   // buttons: [[文字, 0=主要/1=次要]]，回傳按下的索引，Esc 為 -1
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "modal"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
    d.innerHTML = `<div><h3>${esc(title)}</h3><p>${html}</p><div class="row">${buttons.map(([t, k], i) => `<button class="btn ${k ? "ghost" : ""}" data-i="${i}">${esc(t)}</button>`).join("")}</div></div>`;
    const done = i => { d.remove(); document.removeEventListener("keydown", key); res(i); };
    const key = e => { if (e.key === "Escape") done(-1); };
    d.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) done(+b.dataset.i); else if (e.target === d) done(-1); });
    document.addEventListener("keydown", key);
    document.body.append(d); d.querySelector(".btn").focus();
  });
}

/* ───────── 筆記編輯器 ───────── */
let edSeq = 0;
function editorHTML(path, title, only) {   // only：只顯示這些段落
  const md = noteText(path), secs = Z.sectionsOf(md).filter(([n]) => !only || only.includes(n)), isCell = Z.getFront(md, "類型") === "格";
  const st = Z.getFront(md, "狀態") || "未讀", ro = !editable(), n = ++edSeq;
  return `<section class="notes" data-path="${esc(path)}">
    <div class="notes-head"><h2>${esc(title)}</h2>
      ${isCell ? `<div class="status-pick" role="group" aria-label="研讀狀態">${Z.STATUS.map(s => `<button data-s="${s}" aria-pressed="${s === st}">${s}</button>`).join("")}</div>` : ""}</div>
    <div class="saved" aria-live="polite">${savedMsg()}</div>
    ${secs.map(([name, hint], i) => `<div class="field"><label for="ed${n}-${i}">${esc(name)}</label><span class="hint">${esc(hint)}</span><textarea id="ed${n}-${i}" data-sec="${esc(name)}" ${ro ? "readonly" : ""}>${esc(Z.getSection(md, name))}</textarea></div>`).join("")}
    ${obsLink(path)}
  </section>`;
}
function savedMsg() {
  if (!editable()) return "筆記資料夾還沒重新連接，暫時不能編輯。請按上方的「繼續」。";
  if (S.saveErr) return S.saveErr;
  const where = S.mode === "folder" ? `存到資料夾「${esc(S.dir.name)}」` : "存在這個瀏覽器";
  return S.lastSave ? `已儲存 ${hm(S.lastSave)}・${where}` : `打字會自動儲存・${where}`;
}
function updateSaved() { document.querySelectorAll(".notes .saved").forEach(el => { el.innerHTML = savedMsg(); el.classList.toggle("err", !!S.saveErr || !editable()); }); }
function obsLink(path) {
  if (location.protocol !== "file:" || S.mode !== "folder" || !S.dir || S.dir.name !== CFG.notesDir) return "";
  let base = decodeURIComponent(location.pathname).replace(/\/[^/]*$/, "");
  if (/^\/[A-Za-z]:/.test(base)) base = base.slice(1);
  const abs = `${base}/${CFG.notesDir}/${path}`;
  return `<div class="adv">進階：<a href="obsidian://open?path=${encodeURIComponent(abs)}">在 Obsidian 開啟這則筆記</a>（需先用 Obsidian 開啟「${esc(CFG.notesDir)}」資料夾）</div>`;
}
const timers = new Map();
function flush() { for (const [k, { fn }] of timers) { clearTimeout(timers.get(k).t); fn(); } timers.clear(); }
document.addEventListener("input", e => {
  const ta = e.target.closest(".notes textarea[data-sec]"); if (!ta) return;
  const path = ta.closest(".notes").dataset.path, sec = ta.dataset.sec, k = path + "|" + sec;
  if (timers.has(k)) clearTimeout(timers.get(k).t);
  const fn = () => { timers.delete(k); saveNote(path, { sections: { [sec]: ta.value } }); };
  timers.set(k, { t: setTimeout(fn, 700), fn });
  document.querySelectorAll(".notes .saved").forEach(el => el.textContent = "輸入中…");
});
document.addEventListener("click", async e => {
  const b = e.target.closest(".status-pick button"); if (!b) return;
  if (!editable()) { toast("請先重新連接筆記資料夾"); return; }
  const box = b.closest(".notes");
  box.querySelectorAll(".status-pick button").forEach(x => x.setAttribute("aria-pressed", x === b));
  await saveNote(box.dataset.path, { status: b.dataset.s });
  toast(b.dataset.s === "已完成" ? "這一格完成了！" : `狀態：${b.dataset.s}`);
  renderPickers(); renderOverview();
});
document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
window.addEventListener("beforeunload", e => { if (timers.size) { flush(); e.preventDefault(); e.returnValue = ""; } });
let lastFocus = 0;
window.addEventListener("focus", async () => {   // 從 Obsidian 改完回來時，重新讀檔
  if (S.mode !== "folder" || !S.perm || timers.size || Date.now() - lastFocus < 3000) return;
  lastFocus = Date.now();
  try { await loadFolder(); } catch { return; }
  document.querySelectorAll(".notes[data-path]").forEach(box => {
    const md = noteText(box.dataset.path);
    box.querySelectorAll("textarea[data-sec]").forEach(ta => { const v = Z.getSection(md, ta.dataset.sec); if (ta !== document.activeElement && ta.value !== v) ta.value = v; });
    const st = Z.getFront(md, "狀態") || "未讀";
    box.querySelectorAll(".status-pick button").forEach(x => x.setAttribute("aria-pressed", x.dataset.s === st));
  });
  if (view() !== "study") rerender();
});
function openDrawer(path, title) {
  flush();
  const d = document.createElement("div"); d.className = "drawer";
  d.innerHTML = `<div role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn ghost" data-close>關閉</button></div>${editorHTML(path, title)}</div>`;
  const close = () => { flush(); d.remove(); document.removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", key);
  document.body.append(d); d.querySelector("textarea")?.focus();
}

/* ───────── 路由 ───────── */
const VIEWS = ["home", "study", "overview", "patterns", "stars", "potential", "sihua", "birth", "diary", "quiz", "books", "backup", "help"];
let cur = { t: 1, m: 0 }, fCls = "all", fKind = "all";
function view() { const h = location.hash.slice(1); if (/^g\d{4}$/.test(h)) return "study"; return VIEWS.includes(h) ? h : "home"; }
function route() {
  flush();
  const m = /^g(\d{2})(\d{2})$/.exec(location.hash.slice(1));
  if (m && CELL[m[1] + m[2]]) { cur = { t: +m[1], m: +m[2] }; DB.set("kv", "cur", m[1] + m[2]).catch(() => {}); }
  const v = view();
  for (const k of VIEWS) document.getElementById("v-" + k).hidden = k !== v;
  document.querySelectorAll("nav.tabs a").forEach(a => a.setAttribute("aria-current", a.dataset.tab === v ? "page" : "false"));
  rerender();
}
function rerender() {
  const v = view();
  if (v === "home") renderHome();
  if (v === "study") renderStudy();
  if (v === "overview") renderOverview();
  if (v === "patterns") renderPatterns();
  if (v === "stars") renderStars();
  if (v === "potential") renderPotential();
  if (v === "sihua") renderSihua();
  if (v === "birth") renderBirth();
  if (v === "diary") renderDiary();
  if (v === "quiz") renderQuiz();
  if (v === "backup") renderBackup();
}
function refresh() { renderBanner(); rerender(); }
const go = (t, m) => { location.hash = "g" + id2(t, m); };
const goId = id => go(CELL[id].t, CELL[id].m);
window.addEventListener("hashchange", route);
document.addEventListener("click", e => {
  const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); goId(g.dataset.go); }
  const n = e.target.closest("[data-note]"); if (n) openDrawer(n.dataset.note, n.dataset.title);
  const a = e.target.closest("[data-act]"); if (a) ACT[a.dataset.act]?.();
  const bl = e.target.closest("[data-bload]"); if (bl) loadBirth(bl.dataset.bload);
  const h = e.target.closest("[data-hgo]"); if (h) { huaSel = h.dataset.hgo; huaMode = "nature"; if (view() === "sihua") renderSihua(); else location.hash = "sihua"; }
});
const ACT = { chooseFolder, reconnect, useBrowser, exportZip, importZip: () => $("#inZip").click(), importDir: () => $("#inDir").click(),
  fill: async () => { const miss = [...tpl().keys()].filter(p => !S.notes.has(p)); const n = await fillMissing(miss); toast(n ? `補上 ${n} 則筆記` : "筆記都在，不用補"); refresh(); } };

/* ───────── 頂部提示列 ───────── */
function renderBanner() {
  const el = $("#banner"); let h = "", cls = "banner";
  if (S.mode === "folder" && !S.perm) {
    cls += " warn";
    h = S.lost
      ? `<span>找不到筆記資料夾「${esc(S.dir.name)}」，可能已經搬走或改名。</span><span class="row"><button class="btn" data-act="chooseFolder">重新選擇資料夾</button></span>`
      : `<span>按「繼續」，研習頁才能讀寫筆記資料夾「${esc(S.dir.name)}」。瀏覽器每次重新打開都會問一次。</span><span class="row"><button class="btn" data-act="reconnect">繼續</button></span>`;
  } else if (!S.storageOK && S.mode === "browser") {
    cls += " warn"; h = `<span>這個瀏覽器不允許儲存（可能是無痕視窗），關掉後筆記就會消失。請改用一般視窗，或隨時「匯出備份」。</span><span class="row"><button class="btn" data-act="exportZip">匯出備份</button></span>`;
  } else if (S.mode === "browser") {
    const n = [...S.notes.keys()].length, days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 864e5) : null;
    if (n && (days === null || days >= 7)) h = `<span>筆記存在這個瀏覽器裡，${days === null ? "還沒有備份過" : `已經 ${days} 天沒備份`}。清除瀏覽資料或換電腦時，筆記會不見。</span><span class="row"><button class="btn" data-act="exportZip">匯出備份</button>${S.canFolder ? `<button class="btn ghost" data-act="chooseFolder">改存到資料夾</button>` : ""}</span>`;
    else if (!n && S.canFolder) h = ONLINE
      ? `<span>第一次使用？建議先在電腦上建立一個空資料夾（例如「紫微筆記」），再按「選擇筆記資料夾」選它，研習頁會在裡面建好全部筆記。</span>`
      : `<span>第一次使用？建議先選擇「筆記」資料夾，筆記就會直接存成檔案，整包搬走也不會遺失。</span>`;
    if (!n && S.canFolder) h += `<span class="row"><button class="btn" data-act="chooseFolder">選擇筆記資料夾</button></span>`;
  }
  el.className = cls; el.innerHTML = h; el.hidden = !h;
}

/* ───────── 開始 ───────── */
function progress() {
  let done = 0, doing = 0;
  for (const c of CELLS) { const s = statusOf(c); if (s === "已完成") done++; else if (s === "研讀中") doing++; }
  return { done, doing };
}
function nextCell() { return PATH_ORDER.find(c => statusOf(c) === "研讀中") || PATH_ORDER.find(c => statusOf(c) === "未讀"); }
function renderHome() {
  const { done, doing } = progress(), nx = nextCell();
  const mini = Array.from({ length: 12 }, (_, i) => `<span>表${i + 1}</span>` + Array.from({ length: 12 }, (_, m) => {
    const c = CELL[id2(i + 1, m)], s = statusOf(c);
    return `<button data-go="${c.id}" class="${s === "研讀中" ? "s1" : s === "已完成" ? "s2" : ""}" title="${label(c)} ${c.combo}・${s}" aria-label="${label(c)} ${s}"></button>`;
  }).join("")).join("");
  $("#v-home").innerHTML = `<div class="home">
    <div class="hero">
      ${nx ? `<div class="eyebrow">${statusOf(nx) === "研讀中" ? "接著讀" : "今日一格"}</div>
      <div class="next">${label(nx)}　${nx.stars.length ? starsTxt(nx.stars) : "命無正曜"}</div>
      <p>照學習路徑排序：表一逐格讀完，接著讀鏡像的表七，再讀表二、表八……共六對。</p>
      <button class="btn big" data-go="${nx.id}">開始讀這一格</button>`
      : `<div class="next">144 格全部完成</div><p>可以到「練習」複習，或回頭補強心得。</p><a class="btn big" href="#quiz">去練習</a>`}
      <h3 style="font-size:12px;letter-spacing:.14em;color:var(--ink-2);font-weight:500;margin:24px 0 6px">怎麼開始</h3>
      <ol class="steps">
        <li>先到「十四主星」認識每顆星的性情，再到「開發潛能」看它的精神與物質潛能。</li>
        <li>在「逐格研讀」看盤面、格局、鏡像格，下面直接寫筆記，會自動存檔。</li>
        <li>讀完把狀態改成「已完成」，這裡會自動帶到下一格。</li>
        <li>每讀完一張表，到「練習」做幾題，答錯的題目之後會再出現。</li>
        <li>到「四化學習」熟記十干四化，每天到「四化日記」記下當天的事。</li>
        <li>常到「筆記與備份」看筆記存在哪裡，記得備份。</li>
      </ol>
      <p class="note-src" style="margin-top:14px">第一次用？先看<a href="#help">使用說明</a>。喜歡手寫？<a href="紫微144格練習簿.pdf" download>下載 PDF 練習簿</a>（A4，每格一頁，附自我測驗），印出來搭配實體書讀。</p>
    </div>
    <div class="card">
      <h2>研讀進度</h2>
      <div class="prog" role="img" aria-label="已完成 ${done} 格，研讀中 ${doing} 格，共 144 格"><i class="done" style="width:${done / 1.44}%"></i><i class="doing" style="width:${doing / 1.44}%"></i></div>
      <div class="stat"><span><b>${done}</b>已完成</span><span><b>${doing}</b>研讀中</span><span><b>${144 - done - doing}</b>未讀</span></div>
      <div class="minigrid">${mini}</div>
      <p class="note-src">每列一張表、每欄一個命宮（子到亥）。黃色是研讀中，綠色是已完成，點一下就能跳到那一格。</p>
    </div>
  </div>`;
}

/* ───────── 逐格研讀 ───────── */
function renderPickers() {
  if (view() !== "study") return;
  $("#tPick").innerHTML = TABLES.map((_, i) => `<button class="chip" data-t="${i + 1}" aria-pressed="${cur.t === i + 1}">表${i + 1}<span class="s">紫${BR[i]}</span></button>`).join("");
  $("#mPick").innerHTML = [...BR].map((b, i) => { const c = CELL[id2(cur.t, i)], s = statusOf(c); return `<button class="chip" data-m="${i}" aria-pressed="${cur.m === i}">${b}<span class="s">${c.combo}${s === "已完成" ? " ✓" : s === "研讀中" ? " …" : ""}</span></button>`; }).join("");
  const rows = [];
  for (let m = 0; m < 12; m++) {
    const c = CELL[id2(cur.t, m)];
    c.pats.filter(isA).forEach(k => rows.push(`<button class="chip pa ${m === cur.m ? "on" : ""}" data-go="${c.id}">${short(PK[k].name)}・命${BR[m]}</button>`));
    c.pats.filter(isB).forEach(k => rows.push(`<button class="chip pb ${m === cur.m ? "on" : ""}" data-go="${c.id}">${short(PK[k].name)}・命${BR[m]}</button>`));
  }
  $("#tbPats").innerHTML = `<span>表${cur.t}格局</span><div class="chips">${rows.join("") || '<span class="empty">本表以主星判定的古籍格局不多，看研讀卡的待成格條件。</span>'}</div>`;
}
$("#tPick").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (b) go(+b.dataset.t, cur.m); });
$("#mPick").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) go(cur.t, +b.dataset.m); });

function renderChart() {
  const P = TABLES[cur.t - 1], m = cur.m, c = CELL[id2(cur.t, m)];
  const tri = new Set([(m + 4) % 12, (m + 8) % 12, (m + 6) % 12]), jia = new Set([(m + 1) % 12, (m + 11) % 12]);
  let h = "";
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const b = DIV[r][k];
    if (b === null) {
      if (r === 1 && k === 1) h += `<div class="center">
        <div class="no">第 ${cellNo(c)} 格 ／ 144</div>
        <div class="big">${label(c)}</div>
        <div class="sub">紫微在${BR[cur.t - 1]}　命宮：${c.stars.length ? starsTxt(c.stars) : "無正曜，借遷移 " + starsTxt(c.borrow)}</div>
        <div class="sub">生成碼 <span class="code" id="gcode">${c.code}</span> <button class="mini" data-copy="gcode">複製</button></div>
        <div class="sub">貼到<a href="${esc(CFG.chartTool)}" target="_blank" rel="noopener">萬用命盤產生器</a>（<a href="${esc(CFG.chartToolOnline)}" target="_blank" rel="noopener">線上版</a>），可疊加四化與吉煞</div>
      </div>`;
      continue;
    }
    const pi = ((m - b) % 12 + 12) % 12, cls = b === m ? "ming" : tri.has(b) ? "tri" : "";
    const st = P[b].length ? P[b].map(s => `<span>${s}</span>`).join("") : `<span class="borrow">（${starsTxt(P[(b + 6) % 12])}）</span>`;
    const bc = CELL[id2(cur.t, b)];
    const gj = bc.pats.filter(isA).map(k => `<i>${short(PK[k].name)}</i>`).concat(bc.pats.filter(isB).map(k => `<i class="b">${short(PK[k].name)}</i>`)).join("");
    h += `<div class="pal ${cls} ${jia.has(b) ? "jia" : ""}" data-b="${b}" role="button" tabindex="0" aria-label="${BR[b]}宮 ${PAL[pi]} ${P[b].join(" ") || "空宮"}"><div class="stars">${st}</div>${gj ? `<div class="gj">${gj}</div>` : ""}<span class="pn">${PAL[pi]}</span><span class="br">${BR[b]}</span></div>`;
  }
  $("#chart").innerHTML = h;
}
$("#chart").addEventListener("click", e => { const p = e.target.closest(".pal"); if (p) go(cur.t, +p.dataset.b); });
$("#chart").addEventListener("keydown", e => { const p = e.target.closest(".pal"); if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); go(cur.t, +p.dataset.b); } });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  const el = document.getElementById(b.dataset.copy), t = el.textContent;
  navigator.clipboard.writeText(t).then(() => toast("已複製")).catch(() => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("已選取，請按 Ctrl+C（Mac 按 ⌘C）複製"); });
});

function tagHtml(k) {
  const p = PK[k], cls = p.cls === "B" ? "b" : (p.kind === "結構" ? "s" : "");
  return `<div class="tag ${cls}"><b>${p.name}</b>${p.cls === "B" ? `<small>還需：${p.need}</small>` : ""}<span class="cond">${p.cond}</span>${p.quote ? `<q>${p.quote}</q>` : ""}${p.note ? `<small>${p.note}</small>` : ""}</div>`;
}
function renderDetail() {
  const c = CELL[id2(cur.t, cur.m)], twin = Z.twinOf(c);
  const A = c.pats.filter(k => PK[k].cls === "A"), B = c.pats.filter(k => PK[k].cls === "B");
  const sib = CELLS.filter(x => x.id !== c.id && x.id !== twin.id && (c.stars.length ? x.combo === c.combo : (!x.stars.length && starsTxt(x.borrow) === starsTxt(c.borrow))));
  const T = c.tri, br = c.stars.filter(x => PARTNER[x]).map(x => x + "—" + PARTNER[x]);
  $("#detail").innerHTML = `
    <h2>${label(c)}　${c.stars.length ? starsTxt(c.stars) : "命無正曜"}</h2>
    <div class="note-src">第 ${cellNo(c)} 格</div>
    <h3>三方四正</h3>
    <dl class="kv">
      <dt>命宮 ${BR[c.m]}</dt><dd>${starsTxt(T["命"]) || "（空，借 " + starsTxt(c.borrow) + "）"}</dd>
      <dt>財帛 ${BR[(c.m + 8) % 12]}</dt><dd>${starsTxt(T["財"]) || "（空宮）"}</dd>
      <dt>事業 ${BR[(c.m + 4) % 12]}</dt><dd>${starsTxt(T["官"]) || "（空宮）"}</dd>
      <dt>遷移 ${BR[(c.m + 6) % 12]}</dt><dd>${starsTxt(T["遷"]) || "（空宮）"}</dd>
    </dl>
    <h3>命宮暗合宮</h3>
    <p style="margin:0;font-size:14px"><b style="font-family:var(--f-display)">${BR[c.anhe]}宮（${PAL[((c.m - c.anhe) % 12 + 12) % 12]}）</b>　${starsTxt(c.anheStars) || "空宮"}${br.length ? `<br><span class="note-src">永久暗合橋：${br.join("、")}，十二表中恆在暗合宮</span>` : ""}</p>
    <p class="note-src">暗合即地支六合（子丑、寅亥、卯戌、辰酉、巳申、午未），看暗中的牽動與助力。</p>
    <h3>已成格（主星即可判定）</h3>
    <div class="tags">${A.map(tagHtml).join("") || `<span class="empty">無</span>`}</div>
    <h3>待成格（主星條件已具）</h3>
    <div class="tags">${B.map(tagHtml).join("") || `<span class="empty">無</span>`}</div>
    <h3>對照研讀</h3>
    <div class="links"><button class="chip" data-go="${twin.id}">鏡像格 ${label(twin)}</button>${sib.map(x => `<button class="chip" data-go="${x.id}">${label(x)}</button>`).join("")}</div>
    <p class="note-src">鏡像格：表號+6、命宮+6，主星佈局完全相同，只差地支。日月廟陷、子午卯酉等地支型格局會在鏡像格消失或改變，這正是比較重點。</p>
    <h3>開發潛能（${c.stars.length ? "命宮主星" : "借遷移主星"}）</h3>
    ${(c.stars.length ? c.stars : c.borrow).map(s => `<div class="pot"><b>${s}</b>　精神：${BOOK.POT[s].mind}｜物質：${BOOK.POT[s].body}<small>精神剋星：${BOOK.POT[s].kMind}；物質剋星：${BOOK.POT[s].kBody}</small></div>`).join("")}
    <p class="note-src">${c.stars.length === 2 ? "雙星坐命：比較兩星的精神潛能、物質潛能是相近還是相反；有衝突時分流到本職與業餘。" : "精神潛能是因、物質潛能是果；生活中有沒有讓它疏通的管道？"}詳見「<a href="#potential">開發潛能</a>」。</p>
    ${palaceShowHTML(c)}
    ${Z.casesOf(c.id).length ? `<h3>書中命例</h3>${Z.casesOf(c.id).map(x => caseHTML(x, { links: false })).join("")}` : ""}`;
}
/** 命宮主星的四化在這一支的「十二宮顯像」（《紫微斗數與四化星》） */
function palaceShowHTML(c) {
  const rows = c.stars.flatMap(s => HUA_LIST.filter(h => h.star === s && h.g === STEMS.find(g => SIHUA[g][h.i] === s))
    .map(h => [h, Z.huaPalaceAt(h.name, c.m)]).filter(([, t]) => t.length)).sort((x, y) => x[0].i - y[0].i);
  if (!rows.length) return "";
  return `<h3>命宮主星化祿權科忌時（十二宮顯像）</h3>${rows.map(([h, t]) => `<div class="pot"><button class="mini" data-hgo="${h.g}${h.i}">${badge(h.i)} ${h.name}</button>　${t.map(esc).join("；")}</div>`).join("")}
    <p class="note-src">摘自《紫微斗數與四化星》各星「十二宮顯像」，只列提到${BR[c.m]}宮的段落。實際有沒有化，要看生年或行運天干。</p>`;
}
function renderStudy() {
  renderPickers(); renderChart(); renderDetail();
  const c = CELL[id2(cur.t, cur.m)];
  $("#studyNotes").innerHTML = editorHTML(Z.PATH.cell(c), `我的筆記：${label(c)}`);
}

/* ───────── 144 格總覽 ───────── */
function renderOverview() {
  if (view() !== "overview") return;
  let h = `<thead><tr><th scope="col">表 ＼ 命</th>${[...BR].map(b => `<th scope="col">${b}</th>`).join("")}</tr></thead><tbody>`;
  for (let t = 1; t <= 12; t++) {
    h += `<tr><th scope="row">表${t}　紫${BR[t - 1]}</th>`;
    for (let m = 0; m < 12; m++) {
      const c = CELL[id2(t, m)], a = c.pats.filter(isA).map(k => short(PK[k].name)), s = statusOf(c);
      const sc = s === "研讀中" ? "s1" : s === "已完成" ? "s2" : "";
      h += `<td><button data-go="${c.id}" class="${c.stars.length ? "" : "void"} ${sc}" title="${label(c)} ${c.stars.join("") || "空宮"}${a.length ? "：" + a.join("、") : ""}・${s}">${sc ? `<span class="st">${s === "已完成" ? "✓" : "…"}</span>` : ""}${c.combo}<span class="k">${a.slice(0, 2).join("・")}${a.length > 2 ? "…" : ""}</span></button></td>`;
    }
    h += "</tr>";
  }
  $("#ovTable").innerHTML = h + "</tbody>";
}

/* ───────── 格局總表 ───────── */
function renderPatterns() {
  const cl = [["all", "全部"], ["A", "A 主星即判"], ["B", "B 待輔星"], ["C", "C 純輔煞"]], kd = [["all", "全部類別"], ["富貴", "富貴"], ["雜", "雜格"], ["凶", "凶格（古稱）"], ["結構", "結構"]];
  $("#fCls").innerHTML = cl.map(([v, t]) => `<button class="chip" data-fc="${v}" aria-pressed="${fCls === v}">${t}</button>`).join("");
  $("#fKind").innerHTML = kd.map(([v, t]) => `<button class="chip" data-fk="${v}" aria-pressed="${fKind === v}">${t}</button>`).join("");
  const rows = PATS.filter(p => (fCls === "all" || p.cls === fCls) && (fKind === "all" || p.kind === fKind));
  const occ = p => {
    if (p.cls === "C") return `<span class="kd">第 4 圖層判定</span>`;
    const ch = p.occ.map(id => `<button class="chip" data-go="${id}">${label(CELL[id])}</button>`);
    return ch.length <= 6 ? `<div class="links">${ch.join("")}</div>` : `<details><summary>${ch.length} 格（每表皆有）</summary><div class="links">${ch.join("")}</div></details>`;
  };
  $("#ptTable").innerHTML = `<thead><tr><th>格局</th><th>層級</th><th>成立條件</th><th>古訣</th><th>出現位置</th><th>筆記</th></tr></thead><tbody>${rows.map(p => {
    const path = Z.PATH.pat(p), has = Z.EDIT["格局"].some(([n]) => Z.getSection(S.notes.get(path) || "", n));
    return `<tr>
    <td class="n">${p.name}${p.alias && !p.name.includes(p.alias) ? `<small>又稱 ${p.alias}</small>` : ""}<small>${p.kind}</small></td>
    <td><span class="lv ${p.cls}">${p.cls}</span></td>
    <td>${p.cond}${p.need ? `<div class="kd">還需：${p.need}</div>` : ""}${p.note ? `<div class="kd">${p.note}</div>` : ""}</td>
    <td>${p.quote ? `<q>${p.quote}</q>` : ""}</td>
    <td>${occ(p)}</td>
    <td><button class="mini" data-note="${esc(path)}" data-title="格局筆記：${esc(short(p.name))}">${has ? "看筆記 ✎" : "寫筆記"}</button></td></tr>`;
  }).join("")}</tbody>`;
}
$("#v-patterns").addEventListener("click", e => { const a = e.target.closest("[data-fc]"), b = e.target.closest("[data-fk]"); if (a) { fCls = a.dataset.fc; renderPatterns(); } if (b) { fKind = b.dataset.fk; renderPatterns(); } });

/* ───────── 十四主星 ───────── */
function renderStars() {
  const hua = s => Object.entries(SIHUA).flatMap(([g, a]) => a.map((x, i) => x === s ? `<span class="${i === 3 ? "ji" : ""}">${g}化${"祿權科忌"[i]}</span>` : "")).join("") || `<span>不參與生年四化</span>`;
  $("#starGrid").innerHTML = ORDER.map(s => {
    const St = STARS[s], seats = CELLS.filter(c => c.stars.includes(s)), combos = [...new Set(seats.map(c => c.combo))];
    const pats = [...new Set(seats.flatMap(c => c.pats.filter(isA)))].map(k => short(PK[k].name));
    const path = Z.PATH.star(s), has = Z.EDIT["主星"].some(([n]) => Z.getSection(S.notes.get(path) || "", n).replace(/^出處：.*$/m, "").trim());
    return `<article class="card star"><div class="meta">${St.grp === 1 ? "第一系列" : "第二／三系列"}・${St.dou}・${St.wx}・${St.hua}</div><h2>${s}</h2><p>${St.kw}</p>
    <div class="hua">${hua(s)}</div>
    <p class="note-src" style="margin:6px 0 0"><b>《紫微四化星》</b>${BOOK.HUA_STAR[s].no ? BOOK.HUA_STAR[s].no + "。" : ""}${BOOK.HUA_STAR[s].sum}</p>
    <h3>開發潛能</h3>${potKV(s)}${potMore(s)}
    <p class="note-src" style="margin:8px 0 0">永久暗合夥伴：${PARTNER[s] ? `<b>${PARTNER[s]}</b>（十二表中恆在暗合宮）` : "無"}</p>
    <h3>坐命 ${seats.length} 格，組合</h3><div class="links">${combos.map(k => `<button class="chip" data-go="${seats.find(c => c.combo === k).id}">${k}</button>`).join("")}</div>
    ${pats.length ? `<h3>坐命可成之格</h3><div class="note-src">${pats.join("、")}</div>` : ""}
    <div style="margin-top:12px"><button class="btn ghost" data-note="${esc(path)}" data-title="主星筆記：${s}">${has ? "看我的筆記 ✎" : "寫筆記"}</button></div></article>`;
  }).join("");
}

/* ───────── 開發潛能（《紫微斗數開發潛能》） ───────── */
let potA = "武曲", potB = "破軍";
function renderPotential() {
  const B = BOOK, P = B.POT;
  const pick = (k, v) => `<div class="chips">${POT_STARS.map(s => `<button class="chip" data-pp="${k}:${s}" aria-pressed="${v === s}">${s}</button>`).join("")}</div>`;
  $("#v-potential").innerHTML = `<div class="prose wide">
    <p>慧心齋主《紫微斗數開發潛能》把諸星看成內在「精神潛能」與外在「物質潛能」的投射：精神是因、物質是果，受阻就出現負面代償。以下摘要改寫自研讀筆記，頁碼請對照原書。</p>
    <dl class="kv bk">${B.POT_INTRO.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <h2>四個調和工具</h2>
    <div class="ovw"><table class="hm dims"><thead><tr><th scope="col">工具</th><th scope="col">作用</th><th scope="col">用法</th></tr></thead>
      <tbody>${B.POT_TOOLS.map(([k, a, b]) => `<tr><th scope="row">${k}</th><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table></div>
    <h2>潛能調和六步驟</h2>
    <ol>${B.POT_STEPS.map(([k, v]) => `<li><b>${k}</b>：${v}</li>`).join("")}</ol>
  </div>
  <h3 class="sec">諸星潛能一覽（十四主星＋祿存、天馬）</h3>
  <div class="ovw"><table class="hm dims pt2"><thead><tr><th scope="col">星</th>${POT_KV.map(([k]) => `<th scope="col">${k}</th>`).join("")}</tr></thead>
    <tbody>${POT_STARS.map(s => `<tr><th scope="row">${s}<small>${P[s].alias}</small></th>${POT_KV.map(([, f]) => `<td>${P[s][f]}${potAlt(s, f)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
  ${Object.keys(BOOK.POT_ALT).length ? `<p class="note-src">「另一份筆記」：其他研讀筆記的說法和《開發潛能》研讀筆記不同（${Object.keys(BOOK.POT_ALT).join("、")}），請對照原書。</p>` : ""}
  <h3 class="sec">雙星對照：精神、物質潛能相近還是相反？</h3>
  <div class="picker"><label>第一顆</label>${pick("a", potA)}<label>第二顆</label>${pick("b", potB)}</div>
  <div class="cards">${[potA, potB].map(s => `<article class="card star"><div class="meta">${P[s].alias}</div><h2>${s}</h2>${potKV(s)}${potMore(s)}</article>`).join("")}</div>
  <p class="note-src">書中以雙星坐命分四型：精神近似物質相反（武破）、精神相反物質近似（武府）、兩者皆近（同梁）、兩者皆不同（紫破）。兩星有衝突時，把一顆放在本職、另一顆放在副業或業餘。坐這兩顆星的格坐這兩顆星：${(() => { const cs = CELLS.filter(c => c.stars.includes(potA) && c.stars.includes(potB)); return cs.length ? cs.map(c => `<button class="chip" data-go="${c.id}">${label(c)}</button>`).join(" ") : "這兩顆星不會同宮。"; })()}</p>
  <h3 class="sec">七個命例</h3>
  <div class="cases">${CASES.filter(c => c.src === "pot").map(c => caseHTML(c)).join("")}</div>
  <div class="prose wide"><h2>宮位與大限流年</h2><ul>${B.POT_PALACE.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
}
$("#v-potential").addEventListener("click", e => { const b = e.target.closest("[data-pp]"); if (!b) return; const [k, s] = b.dataset.pp.split(":"); if (k === "a") potA = s; else potB = s; renderPotential(); });

/* ───────── 四化學習 ───────── */
const HCLS = ["hl", "hq", "hk", "hj"];   // 祿權科忌
const badge = i => `<b class="hb ${HCLS[i]}" title="化${HUA[i]}">${HUA[i]}</b>`;
const REL_CLS = { "同宮": "r0", "三合": "r1", "對宮": "r2", "暗合": "r3", "暗合・鄰宮": "r3", "鄰宮": "r4" };
let huaMode = "nature", huaSel = "甲0", huaG = "甲", huaT = 1;
const huaAux = { 左右: { who: "左輔", b: null } };   // 左右由出生月，獨立指定
const huaStemOn = { 祿存: false, 羊陀: false, 魁鉞: false };
// 昌曲、空劫共用一個時辰，位置一律由時辰推出，不會排出矛盾的盤（火鈴需年支與男女，和四化無關，不安）
let huaHour = null, sixOpen = false;
const huaOn = { 昌曲: false, 空劫: false };
const huaWho = { 昌曲: "文昌", 空劫: "地劫" };
const WHO_SWAP = { 文昌: "文曲", 文曲: "文昌", 地劫: "地空", 地空: "地劫" };
function hourStars() {
  const o = {}, h = huaHour;
  if (h == null) return o;
  if (huaOn.昌曲) { o.文昌 = Z.HOUR_AT.文昌(h); o.文曲 = Z.HOUR_AT.文曲(h); }
  if (huaOn.空劫) { o.地劫 = Z.HOUR_AT.地劫(h); o.地空 = Z.HOUR_AT.地空(h); }
  return o;
}
const auxArg = () => { const a = huaAux.左右, o = a.b == null ? {} : { [a.who]: a.b }, hs = hourStars(); if (hs.文昌 != null) o.文昌 = hs.文昌; return o; };
const AUX_LABEL = { 左右: "左輔右弼", 昌曲: "文昌文曲", 空劫: "地空地劫" };
const starCls = s => s === "祿存" ? "lu" : Z.UNLUCKY.includes(s) ? "sha" : "aux";

function renderSihua() {
  const modes = [["nature", "四化星性"], ["table", "四化入表"], ["book", "書中重點"]];
  $("#v-sihua").innerHTML = `<div class="filters"><div class="chips" role="group" aria-label="學習方式">${modes.map(([k, t]) => `<button class="chip" data-hm="${k}" aria-pressed="${huaMode === k}">${t}</button>`).join("")}</div>
    <span class="note-src">${{ nature: "先熟記十干四化：點任一化，看星性、寫自己的筆記。", table: "把四化放進十二表，看彼此同宮、三合、對宮、暗合。", book: "慧心齋主《紫微四化星》研讀重點：四化本質、四個解讀層次、輔煞與天羅地網、重疊看盤、四十個命例。" }[huaMode]}</span></div>`
    + (huaMode === "nature" ? huaNatureHTML() : huaMode === "table" ? huaTableHTML() : huaBookHTML());
}

function huaNatureHTML() {
  const g = huaSel[0], i = +huaSel.slice(1), star = SIHUA[g][i], name = star + "化" + HUA[i];
  const same = HUA_LIST.filter(h => h.name === name).map(h => h.g + "干");
  const others = HUA_LIST.filter(h => h.star === star && h.g + h.i !== huaSel);
  const rows = STEMS.map(x => `<tr><th scope="row">${x}</th>${SIHUA[x].map((s, k) => `<td><button class="hcell" data-hs="${x}${k}" aria-pressed="${x + k === huaSel}">${s}</button></td>`).join("")}</tr>`).join("");
  const book = HUA_BOOK[name], cs = CASES.filter(c => c.src === "hua" && c.cfg.includes(name));
  return `<div class="study">
    <div><table class="hz"><thead><tr><th scope="col">天干</th>${[...HUA].map((h, k) => `<th scope="col">${badge(k)} 化${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
      <p class="note-src">四化表依萬用命盤產生器所用之表（戊：右弼化科；庚：陽武同陰；壬：左輔化科），各派略有出入。</p></div>
    <article class="card">
      <div class="note-src">${same.join("、")}・化${HUA[i]}</div>
      <h2>${name}</h2>
      <h3>通行說法</h3><p class="htxt">${HUA_TXT[name]}</p>
      <h3>日記提示（《${BOOK.DIARY_SRC}》）</h3>${HUA_LIST.filter(h => h.name === name).map(h => `<p class="htxt">${same.length > 1 ? `<b>${h.g}干</b>　` : ""}${esc(Z.diaryHua(h.g, h.i))}</p>`).join("")}
      <h3>《紫微四化星》要點</h3>${book ? `<p class="htxt">${esc(book)}</p>` : `<p class="empty">待補。讀書時用自己的話寫進下方「我的星性筆記」，並註明頁碼。</p>`}
      ${levelsHTML(name)}
      <p class="note-src">化${HUA[i]}的四個層次：${BOOK.HUA_DIM[i].map((d, k) => `${BOOK.HUA_DIMS[k].replace(/（.*）/, "")}—${d}`).join("；")}</p>
      ${cs.length ? `<h3>書中命例</h3>${cs.map(x => caseHTML(x)).join("")}` : ""}
      <h3>${star}</h3>${BOOK.HUA_STAR[star] ? `<p class="note-src" style="margin:0 0 4px">${BOOK.HUA_STAR[star].no ? BOOK.HUA_STAR[star].no + "。" : ""}${BOOK.HUA_STAR[star].sum}</p>` : ""}${STARS[star] ? `<p style="margin:0;font-size:14px">${STARS[star].kw}</p>` : `<p style="margin:0;font-size:14px">輔星：左輔、右弼由出生月安，文昌、文曲由出生時辰安。${star}與${AUX[star]}成對，以丑未為軸左右對稱。</p>`}
      <h3>${star}的其他四化</h3><div class="links">${others.map(h => `<button class="chip" data-hs="${h.g}${h.i}">${h.g}干化${HUA[h.i]}</button>`).join("") || `<span class="empty">無</span>`}</div>
    </article></div>
    ${editorHTML(Z.PATH.myHua, `我的星性筆記：${name}`, [name])}`;
}

function levelsHTML(name) {
  const L = BOOK.HUA_LEVELS[name], P = BOOK.HUA_PALACE[name];
  if (!L && !P) return "";
  const lv = L ? L.lv.map((t, k) => t ? `<dt>${BOOK.HUA_DIMS[k].replace(/（.*）/, "")}</dt><dd>${esc(t)}</dd>` : "").join("") : "";
  return `${L ? `<h3>四個層次（書中細解）</h3>${L.lead ? `<p class="htxt">${esc(L.lead)}</p>` : ""}${lv ? `<dl class="kv bk">${lv}</dl>` : ""}` : ""}
    ${P ? `<h3>十二宮顯像</h3><dl class="kv bk">${P.split("；").map(seg => { const m = /^([子丑寅卯辰巳午未申酉戌亥]+)(宮)?(.*)$/.exec(seg); return m ? `<dt>${m[1]}</dt><dd>${esc(m[3])}</dd>` : `<dt>全盤</dt><dd>${esc(seg)}</dd>`; }).join("")}</dl>` : ""}`;
}
let caseStem = "all";
function huaBookHTML() {
  const B = BOOK, list = CASES.filter(c => c.src === "hua" && (caseStem === "all" || c.g === caseStem));
  const fixed = CASES.filter(c => c.src === "hua" && !c.ok).length;
  return `<div class="prose wide">
    <h2>四化的本質</h2>
    <dl class="kv bk">${B.HUA_INTRO.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <h2>推命四步：每一化的四個層次</h2>
    <div class="ovw"><table class="hm dims"><thead><tr><th scope="col">四化</th>${B.HUA_DIMS.map(d => `<th scope="col">${d}</th>`).join("")}</tr></thead>
      <tbody>${B.HUA_DIM.map((r, i) => `<tr><th scope="row">${badge(i)} 化${HUA[i]}</th>${r.map(d => `<td>${d}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <h2>十四主星的四化總評</h2>
    <div class="ovw"><table class="hm dims"><thead><tr><th scope="col">星</th><th scope="col">十干四化</th><th scope="col">不化</th><th scope="col">總評</th></tr></thead>
      <tbody>${ORDER.map(s => `<tr><th scope="row">${s}</th><td>${HUA_LIST.filter(h => h.star === s).map(h => `<button class="mini" data-hgo="${h.g}${h.i}">${h.g}化${HUA[h.i]}</button>`).join(" ") || "—"}</td><td>${B.HUA_STAR[s].no || "—"}</td><td>${B.HUA_STAR[s].sum}</td></tr>`).join("")}</tbody></table></div>
    <h2>六吉六煞與祿存</h2>
    <dl class="kv bk">${B.HUA_AUX.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <h2>六煞與化忌的差別</h2>
    <dl class="kv bk">${B.SHA.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <h2>天羅地網（辰、戌）</h2>
    <p>辰、戌二宮壓制多數星曜，唯有四化能扭轉其局限。</p>
    <dl class="kv bk">${B.TIANLUO.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <h2>重疊看盤：每一層以哪組四化為主</h2>
    <div class="ovw"><table class="hm dims"><thead><tr><th scope="col">層次</th><th scope="col">看法</th><th scope="col">主管</th></tr></thead>
      <tbody>${B.OVERLAY.map(([k, a, b]) => `<tr><th scope="row">${k}</th><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table></div>
    <h2>動態推演命例：大限、流年、流月、流日流時</h2>
    <p class="note-src">依書中生辰排盤，列出本命格位與大限；書中寫的表號和排盤不同時會標出。點「排盤」可在「生辰排盤」分頁看每一步。</p>
    <div class="cases">${Z.DYN.map(dynHTML).join("")}</div>
    <h2>研習心法</h2>
    <ul>${B.HUA_END.map(x => `<li>${x}</li>`).join("")}</ul>
    <h2>四十個命例</h2>
    <p class="note-src">每個命例都三方核對：筆記標的表號與命宮、依生辰排盤（命宮、五行局、紫微）、命宮主星。以命宮主星為準：生辰排出的命宮主星和書中相同，就依生辰定格（連命宮地支一起更正）；生辰不合時依主星定表號，並標「生辰待查」。命宮的輔星、煞星只靠生年、月、時安星，用來檢驗這三項是否抄對。共 ${fixed} 例已更正，點格名就能看盤。</p>
    <div class="chips" role="group" aria-label="年干" style="margin-bottom:10px"><button class="chip" data-cs="all" aria-pressed="${caseStem === "all"}">全部</button>${STEMS.map(g => `<button class="chip" data-cs="${g}" aria-pressed="${caseStem === g}">${g}<span class="s">${SIHUA[g].map(Z.starShort).join("")}</span></button>`).join("")}</div>
    <div class="cases">${list.map(c => caseHTML(c)).join("")}</div>
  </div>`;
}

function dynHTML(d) {
  const bc = d.bc, id = bc.cell, dx = bc.daxian.map(x => `${x.gz}${x.from}–${x.to}`).join("　");
  return `<div class="case"><b>${d.who}</b><span class="kd">${d.layer}</span>　<span class="cfg">${d.birth}・${d.sex === "男" ? (bc.yang ? "陽男" : "陰男") : (bc.yang ? "陽女" : "陰女")}</span>
    <p>${esc(d.cfg)}</p><ol>${d.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    <div class="note-src">排盤：${Z.cellLabel(id)}、${Z.JU_NAME[bc.ju]}、身宮${BR[bc.shen]}（${bc.shenPal}）。大限（${bc.dir > 0 ? "順" : "逆"}行）：${dx}</div>
    ${bc.t !== d.t ? `<div class="cflag">標表${d.t}，依生辰排盤為表${bc.t}，請對照原書</div>` : d.verified ? `<div class="note-src">已對照原書 ${d.verified} 命盤</div>` : ""}
    <div class="links"><button class="chip" data-go="${id}">${label(CELL[id])}</button><button class="chip" data-bload="${d.who}">排盤</button></div></div>`;
}
function huaTableHTML() {
  const aux = auxArg(), at = { ...Z.stemStars(huaG, huaStemOn), ...Z.auxPositions(aux), ...hourStars() }, places = Z.huaPlaces(huaT, huaG, aux), P = TABLES[huaT - 1];
  const pairs = Z.huaPairs(huaG, aux), star = i => places[i].star;
  const auxRow = key => {
    const a = huaAux[key], pair = Z.PAIRS[a.who], p = a.b == null || !pair ? null : Z.pairAt(a.who, a.b);
    return `<label>${AUX_LABEL[key]}</label><div><div class="chips">
      <button class="chip" data-aw="${key}" title="改成指定另一顆">指定${a.who} ⇄</button>
      <button class="chip" data-ab="${key}:" aria-pressed="${a.b == null}">不安</button>
      ${[...BR].map((b, k) => `<button class="chip" data-ab="${key}:${k}" aria-pressed="${a.b === k}">${b}</button>`).join("")}</div>
      ${a.b != null ? `<div class="note-src">${a.who}在${BR[a.b]} → ${pair}在${BR[p]}${a.b === p ? "（只有丑、未會同宮）" : ""}</div>` : ""}</div>`;
  };
  const H = huaHour, hTxt = H == null ? "" : BR[H] + "時";
  const posChips = (key, pos, ok = true) => [...BR].map((b, k) => `<button class="chip" data-hp="${key}:${k}" aria-pressed="${huaOn[key] && pos === k}" ${ok ? "" : "disabled"}>${b}</button>`).join("");
  const hourRow = key => {   // 昌曲、空劫
    const who = huaWho[key], other = WHO_SWAP[who], pos = H == null ? null : Z.HOUR_AT[who](H), op = H == null ? null : Z.HOUR_AT[other](H);
    const msg = H == null ? (huaOn[key] ? "請指定位置或時辰" : "")
      : `${hTxt}：${who}在${BR[pos]}、${other}在${BR[op]}${pos === op ? `（只有${key === "空劫" ? "巳、亥" : "丑、未"}會同宮）` : ""}${huaOn[key] ? "" : "（未安）"}`;
    return `<label>${AUX_LABEL[key]}</label><div><div class="chips">
      <button class="chip" data-hw="${key}" title="改成指定另一顆">指定${who} ⇄</button>
      <button class="chip" data-hon="${key}" aria-pressed="${!huaOn[key]}">不安</button>${posChips(key, pos)}</div>
      ${msg ? `<div class="note-src">${msg}</div>` : ""}</div>`;
  };
  const hourSel = `<label>時辰</label><div><div class="chips"><button class="chip" data-hh="" aria-pressed="${H == null}">未定</button>${[...BR].map((b, k) => `<button class="chip" data-hh="${k}" aria-pressed="${H === k}">${b}</button>`).join("")}</div>
      <div class="note-src">昌曲、空劫都由時辰決定，共用這一個時辰。在任一組指定位置，時辰就跟著定，另一組一起移動，不會排出不存在的盤。</div></div>`;
  const L = Z.LUCUN[huaG], KY = Z.KUIYUE[huaG];
  const stemOpts = [["祿存", `祿存${BR[L]}`], ["羊陀", `擎羊${BR[(L + 1) % 12]}・陀羅${BR[(L + 11) % 12]}`], ["魁鉞", `天魁${BR[KY[0]]}・天鉞${BR[KY[1]]}`]];
  const stemRow = `<label>隨${huaG}干</label><div class="chips">${stemOpts.map(([k, t]) => `<button class="chip" data-son="${k}" aria-pressed="${huaStemOn[k]}">${huaStemOn[k] ? "安" : "不安"}<span class="s">${t}</span></button>`).join("")}</div>`;
  const hz = s => { const p = places.find(x => x.star === s); return p ? badge(p.i) : ""; };
  let h = "";
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const b = DIV[r][k];
    if (b === null) {
      if (r === 1 && k === 1) h += `<div class="center"><div class="no">表${huaT}・紫微在${BR[huaT - 1]}</div><div class="big">${huaG}干四化</div>
        ${places.map(p => `<div class="sub">${badge(p.i)} ${p.star}　${p.b == null ? "未安，請指定位置" : BR[p.b] + "宮"}</div>`).join("")}</div>`;
      continue;
    }
    const auxHere = Object.keys(at).filter(s => at[s] === b);
    const st = (P[b].length ? P[b].map(s => `<span>${s}${hz(s)}</span>`).join("") : `<span class="borrow">（${starsTxt(P[(b + 6) % 12])}）</span>`)
      + auxHere.map(s => `<span class="${starCls(s)}">${s}${hz(s)}</span>`).join("");
    h += `<div class="pal ${places.some(p => p.b === b) ? "hon" : ""}" aria-label="${BR[b]}宮 ${[...P[b], ...auxHere].join(" ") || "空宮"}"><div class="stars">${st}</div><span class="br">${BR[b]}</span></div>`;
  }
  const co = p => [...P[p.b], ...Object.keys(at).filter(s => at[s] === p.b)].filter(s => s !== p.star);
  const meet = b => [4, 8, 6].flatMap(d => Object.keys(at).filter(s => at[s] === (b + d) % 12));
  const fall = places.map(p => {
    if (p.b == null) return `<div class="hrow">${badge(p.i)} <b>${p.name}</b>　<span class="empty">輔星未安</span></div>`;
    const j = Z.jiaAt(at, p.b), m = meet(p.b);
    return `<div class="hrow">${badge(p.i)} <b>${p.name}</b>　${BR[p.b]}宮${co(p).length ? "，同宮 " + co(p).join("・") : ""}${j.length ? `，<b>${j.join("、")}夾</b>` : ""}${m.length ? `<div class="note-src">三方四正會 ${m.map(s => `<span class="${starCls(s)}">${s}</span>`).join("・")}</div>` : ""}</div>`;
  }).join("");
  const rel = (x, k) => x.rels ? `<span class="rel ${REL_CLS[x.rels[k]] || ""}">${x.rels[k]}</span>` : `<span class="empty">需先安輔星</span>`;
  const now = pairs.map(x => `<div class="hrow">${badge(x.i)}${star(x.i)}—${badge(x.j)}${star(x.j)}：${rel(x, huaT - 1)}</div>`).join("");
  const sum = x => { if (!x.rels) return "需安輔星"; const c = {}; x.rels.forEach(r => c[r] = (c[r] || 0) + 1); const ks = Object.keys(c); return ks.length === 1 ? `<b>十二表恆為${ks[0]}</b>` : ks.map(r => r + c[r]).join("・"); };
  return `<div class="picker">
      <label>天干</label><div class="chips">${STEMS.map(g => `<button class="chip" data-hg="${g}" aria-pressed="${g === huaG}">${g}<span class="s">${SIHUA[g].map(Z.starShort).join("")}</span></button>`).join("")}</div>
      <label>表號</label><div class="chips">${TABLES.map((_, k) => `<button class="chip" data-ht="${k + 1}" aria-pressed="${huaT === k + 1}">表${k + 1}<span class="s">紫${BR[k]}</span></button>`).join("")}</div>
    </div>
    <details class="sixstars" ${sixOpen || Object.keys(at).length ? "open" : ""}><summary>輔星・煞星・祿存（與四化相關，依需要安上）</summary>
      <div class="picker">${stemRow}${auxRow("左右")}${hourSel}${hourRow("昌曲")}${hourRow("空劫")}</div>
      <p class="note-src">祿存、擎羊、陀羅、天魁、天鉞由天干決定，選「安」就自動排上；左右由出生月決定，指定一顆，另一顆自動安上。魁鉞依「甲戊庚牛羊…六辛逢馬虎」，各派略有出入。火星、鈴星要看年支與男女，和四化無關，這裡不安。</p>
    </details>
    <div class="study">
      <div><div class="chart hchart">${h}</div>
        <div class="legend">${[0, 1, 2, 3].map(i => `<span>${badge(i)} 化${HUA[i]}</span>`).join("")}<span><i style="background:var(--indigo-soft)"></i>四化所在宮</span><span class="aux">藍字吉星</span><span class="sha">紅字煞星</span><span class="lu">金字祿存</span></div></div>
      <article class="card"><h2>表${huaT}・${huaG}干</h2>
        <h3>四化落宮</h3>${fall}
        <h3>四化之間</h3>${now}
        <p class="note-src">暗合即地支六合（子丑、寅亥、卯戌、辰酉、巳申、午未）。六吉六煞可以不安，只看主星的四化；安上後會列出同宮、夾宮與三方四正會照的星。</p></article>
    </div>
    <h3 class="sec">十二表通觀：${huaG}干四化兩兩之間的關係</h3>
    <div class="ovw"><table class="hm">
      <thead><tr><th scope="col">表</th>${pairs.map(x => `<th scope="col">${badge(x.i)}${badge(x.j)}<small>${star(x.i)}・${star(x.j)}</small></th>`).join("")}</tr></thead>
      <tbody>${TABLES.map((_, k) => `<tr class="${k + 1 === huaT ? "cur" : ""}"><th scope="row"><button class="mini" data-ht="${k + 1}">表${k + 1}</button></th>${pairs.map(x => x.rels ? `<td class="${REL_CLS[x.rels[k]] || ""}">${x.rels[k]}</td>` : `<td class="empty">—</td>`).join("")}</tr>`).join("")}</tbody>
      <tfoot><tr><th scope="row">合計</th>${pairs.map(x => `<td>${sum(x)}</td>`).join("")}</tr></tfoot>
    </table></div>
    <div class="note-src prose"><p><b>為什麼有些關係十二表都一樣？</b>紫微星系（紫微、天機、太陽、武曲、天同、廉貞）和天府星系（天府、太陰、貪狼、巨門、天相、天梁、七殺、破軍）各自整組移動。同一星系的兩星<b>距離</b>固定，所以同宮、三合、對宮十二表都一樣；不同星系的兩星位置<b>和</b>固定（以某條軸互為鏡射），所以暗合要嘛十二表都成立、要嘛都不成立，其他關係則隨表號改變。</p>
      <p>六吉六煞不隨表號移動。左輔與右弼、文昌與文曲的位置和恆為 2，以丑未為軸對稱，只有在丑、未會同宮；地空與地劫的位置和恆為 10，以巳亥為軸對稱，只有在巳、亥會同宮。擎羊、陀羅永遠一前一後夾著祿存。</p></div>`;
}
$("#v-sihua").addEventListener("click", e => {
  const q = s => e.target.closest(s);
  const cs = q("[data-cs]"); if (cs) { caseStem = cs.dataset.cs; renderSihua(); return; }
  const m = q("[data-hm]"), s = q("[data-hs]"), g = q("[data-hg]"), t = q("[data-ht]"), w = q("[data-aw]"), ab = q("[data-ab]"), so = q("[data-son]");
  const hh = q("[data-hh]"), hw = q("[data-hw]"), hon = q("[data-hon]"), hp = q("[data-hp]");
  if (m) huaMode = m.dataset.hm;
  else if (s) huaSel = s.dataset.hs;
  else if (g) huaG = g.dataset.hg;
  else if (t) huaT = +t.dataset.ht;
  else if (w) { const a = huaAux[w.dataset.aw], o = a.who; a.who = Z.PAIRS[o]; if (a.b != null) a.b = Z.pairAt(o, a.b); }   // 換一顆指定，盤面不變
  else if (so) huaStemOn[so.dataset.son] = !huaStemOn[so.dataset.son];
  else if (hh) huaHour = hh.dataset.hh === "" ? null : +hh.dataset.hh;
  else if (hw) { const k = hw.dataset.hw; huaWho[k] = WHO_SWAP[huaWho[k]]; }
  else if (hon) huaOn[hon.dataset.hon] = false;
  else if (hp) {
    const [k, v] = hp.dataset.hp.split(":"), who = huaWho[k];
    huaHour = Z.HOUR_OF[who](+v);
    huaOn[k] = true;
  }
  else if (ab) { const [k, v] = ab.dataset.ab.split(":"); huaAux[k].b = v === "" ? null : +v; }
  else return;
  flush(); renderSihua();
});

$("#v-sihua").addEventListener("toggle", e => { if (e.target.matches("details.sixstars")) sixOpen = e.target.open; }, true);

/* ───────── 四化日記 ───────── */
let diarySel = null, diaryFilter = "all", newStem = null, newDate = null;
const DIARY_RE = /^四化日記\/\d{4}-\d{2}-\d{2}\.md$/;
const diaries = () => [...S.notes.keys()].filter(p => DIARY_RE.test(p)).sort().reverse();
async function noteExists(p) {
  if (S.notes.has(p)) return true;
  return S.mode === "folder" && S.perm ? (await readFile(p)) != null : false;   // Obsidian 剛建的檔也算
}
async function removeNote(p) {
  if (S.mode === "folder") {
    const parts = p.split("/"); let d = S.dir;
    for (const x of parts.slice(0, -1)) d = await d.getDirectoryHandle(x);
    await d.removeEntry(parts[parts.length - 1]);
    DB.del("mirror", p).catch(() => {});
  } else await DB.del("notes", p);
  S.notes.delete(p);
}
function renderDiary() {
  const list = diaries(), stemOf = p => Z.getFront(S.notes.get(p), "天干");
  if (diarySel && !S.notes.has(diarySel)) diarySel = null;
  if (!diarySel && list.length) diarySel = list[0];
  newDate ||= ymd(new Date());
  const shown = list.filter(p => diaryFilter === "all" || stemOf(p) === diaryFilter);
  const excerpt = p => Z.getSection(S.notes.get(p), "今日事件").split("\n")[0].slice(0, 40);
  const left = `<article class="card"><h2>寫一篇</h2>
      <div class="field"><label for="dDate">日期</label><span class="hint">預設今天，可以改成之前的日子補寫。</span><input type="date" id="dDate" value="${newDate}"></div>
      <div class="field"><label>當天天干</label><span class="hint">請查萬年曆的日干支，例如「丁亥日」就選丁。</span>
        <div class="chips">${STEMS.map(g => `<button class="chip" data-dg="${g}" aria-pressed="${g === newStem}">${g}</button>`).join("")}</div>
        ${newStem ? `<div class="note-src" style="margin-top:6px">${SIHUA[newStem].map((s, i) => `${badge(i)} ${s}化${HUA[i]}：${esc(Z.diaryHua(newStem, i))}`).join("<br>")}</div>` : ""}</div>
      <div class="row" style="margin-top:14px"><button class="btn" data-dnew>開始寫</button></div></article>
    <article class="card"><h2>我的日記（${list.length} 篇）</h2>
      <div class="chips" role="group" aria-label="依天干篩選"><button class="chip" data-df="all" aria-pressed="${diaryFilter === "all"}">全部</button>${STEMS.map(g => `<button class="chip" data-df="${g}" aria-pressed="${diaryFilter === g}">${g}日</button>`).join("")}</div>
      <div class="dlist">${shown.map(p => `<button class="ditem" data-dopen="${esc(p)}" aria-pressed="${p === diarySel}"><b>${esc(Z.getFront(S.notes.get(p), "日期"))}</b><span>${esc(stemOf(p))}日</span><small>${esc(excerpt(p))}</small></button>`).join("") || `<p class="empty">${list.length ? "這個天干還沒有日記。" : "還沒有日記，從左上角開始寫第一篇。"}</p>`}</div></article>`;
  const right = diarySel ? diaryPanel(diarySel) : `<article class="card"><h2>四化日記</h2>
    <p>每天觀察當日天干的四化，對照自己當天的念頭與事件。寫久了，會慢慢分辨哪些是星曜的特性、哪些是自己的投射。</p>
    <ol class="steps"><li>選日期，查萬年曆選當天的天干。</li><li>按「開始寫」，記下今天發生的事。</li><li>對照四化：哪件事像化祿、化權、化科、化忌？</li><li>過幾天回頭看，同一個天干的日子有沒有共同的味道。</li></ol>
    <p class="note-src">喜歡手寫？<a href="紫微144格練習簿.pdf" download>PDF 練習簿</a>的四化日記章有甲日到癸日十個範本，印出來就能寫。</p></article>`;
  $("#v-diary").innerHTML = `<div class="study diary"><div class="dleft">${left}</div><div>${right}</div></div>`;
}
function diaryPanel(p) {
  const md = S.notes.get(p), d = Z.getFront(md, "日期"), g = Z.getFront(md, "天干");
  return `<article class="card">
    <div class="notes-head"><h2>${esc(d)}　${SIHUA[g] ? g + "日" : ""}</h2>
      <div class="row"><input type="date" id="dMove" value="${esc(d)}" aria-label="改成哪一天"><button class="mini" data-dmove>改日期</button><button class="mini" data-ddel>刪除</button></div></div>
    <h3>當天天干</h3><div class="chips">${STEMS.map(x => `<button class="chip" data-dchg="${x}" aria-pressed="${x === g}">${x}</button>`).join("")}</div>
    <h3>今日四化</h3>${SIHUA[g] ? SIHUA[g].map((s, i) => `<div class="hrow">${badge(i)} <button class="linkbtn" data-hgo="${g}${i}">${s}化${HUA[i]}</button>　<span class="note-src">${esc(Z.diaryHua(g, i))}</span></div>`).join("") + `<p class="note-src">解說取自《${BOOK.DIARY_SRC}》。</p>` : `<p class="empty">還沒選天干</p>`}
  </article>
  ${editorHTML(p, "日記")}`;
}
const okDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
async function newDiary() {
  if (!editable()) { toast("請先重新連接筆記資料夾"); return; }
  const d = newDate = $("#dDate").value;
  if (!okDate(d)) { toast("請先選日期"); return; }
  if (!newStem) { toast("請先選當天的天干（查萬年曆的日干支）"); return; }
  const p = Z.PATH.diary(d);
  if (await noteExists(p)) {
    if (!S.notes.has(p)) S.notes.set(p, await readFile(p));
    const g = Z.getFront(S.notes.get(p), "天干");
    const r = await ask("這一天已經寫過了", `${esc(d)}${g ? `（${esc(g)}日）` : ""}已經有一篇四化日記，不會再建立第二篇。要開啟那篇，還是換個日期？`, [["開啟那篇", 0], ["換個日期", 1]]);
    if (r === 0) { flush(); diarySel = p; renderDiary(); } else $("#dDate")?.focus();
    return;
  }
  flush();
  let err = "";
  await queue(async () => { try { await persist(p, Z.diaryNote(d, newStem)); } catch (e) { err = e.message || String(e); } });
  if (err) { toast("沒有存到：" + err); return; }
  diarySel = p; newStem = null; diaryFilter = "all"; renderDiary(); toast(`已建立 ${d} 的四化日記`);
  $("#v-diary .notes textarea")?.focus();
}
async function changeStem(g) {
  if (!editable()) { toast("請先重新連接筆記資料夾"); return; }
  flush(); await saveNote(diarySel, { fn: md => Z.setDiaryStem(md, g) }); renderDiary();
}
async function moveDiary(to) {
  if (!editable()) { toast("請先重新連接筆記資料夾"); return; }
  const from = diarySel;
  if (!okDate(to) || to === Z.getFront(S.notes.get(from), "日期")) return;
  const np = Z.PATH.diary(to);
  if (await noteExists(np)) { await ask("那一天已經有日記", `${esc(to)} 已經寫過一篇，不能覆蓋。可以先開啟那篇，把這篇的內容貼過去。`, [["知道了", 1]]); return; }
  flush();
  let err = "";
  await queue(async () => {
    try {
      const md = (S.mode === "folder" ? await readFile(from) : null) ?? S.notes.get(from);
      await persist(np, Z.setDiaryDate(md, to)); await removeNote(from);
    } catch (e) { err = e.message || String(e); }
  });
  if (err) { toast("沒有改成：" + err); return; }
  diarySel = np; renderDiary(); toast(`已改到 ${to}`);
}
async function delDiary() {
  if (!editable()) { toast("請先重新連接筆記資料夾"); return; }
  const p = diarySel, d = Z.getFront(S.notes.get(p), "日期");
  const r = await ask("刪除這篇日記？", `${esc(d)} 的四化日記會被刪除${S.mode === "folder" ? "，資料夾裡的檔案也會一起刪掉" : ""}，無法復原。`, [["刪除", 0], ["取消", 1]]);
  if (r !== 0) return;
  flush();
  let err = "";
  await queue(async () => { try { await removeNote(p); } catch (e) { err = e.message || String(e); } });
  if (err) { toast("沒有刪掉：" + err); return; }
  diarySel = null; renderDiary(); toast("已刪除");
}
$("#v-diary").addEventListener("click", e => {
  const q = s => e.target.closest(s);
  const dg = q("[data-dg]"), df = q("[data-df]"), op = q("[data-dopen]"), chg = q("[data-dchg]");
  if (dg) { newStem = dg.dataset.dg; newDate = $("#dDate").value; renderDiary(); }
  else if (df) { diaryFilter = df.dataset.df; renderDiary(); }
  else if (op) { flush(); diarySel = op.dataset.dopen; renderDiary(); }
  else if (chg) changeStem(chg.dataset.dchg);
  else if (q("[data-dnew]")) newDiary();
  else if (q("[data-dmove]")) moveDiary($("#dMove").value);
  else if (q("[data-ddel]")) delDiary();
});
$("#v-diary").addEventListener("change", e => { if (e.target.id === "dDate") newDate = e.target.value; });

/* ───────── 生辰排盤 ───────── */
// 依農曆生辰一步步排出命宮、身宮、五行局、紫微（＝144 格中的哪一格）與大限，並安年月時系輔煞
const GZ60 = Array.from({ length: 60 }, (_, i) => Z.GAN[i % 10] + BR[i % 12]);
const MONTHS = "正二三四五六七八九十冬臘";
const dayName = d => d <= 10 ? "初" + "一二三四五六七八九十"[d - 1] : d < 20 ? "十" + "一二三四五六七八九"[d - 11] : d === 20 ? "二十" : d < 30 ? "廿" + "一二三四五六七八九"[d - 21] : "三十";
const bIn = { gz: "庚寅", m: 3, d: 5, h: 1, sex: "男", who: "" };
function loadBirth(who) {
  const c = CASES.find(x => x.who === who && x.birth), d = Z.DYN.find(x => x.who === who), str = c ? c.birth : d?.birth;
  if (!str) return;
  const r = Z.parseBirth(str);
  Object.assign(bIn, { gz: r.g + r.yb, m: r.m, d: r.d, h: r.h, sex: d ? d.sex : (who.endsWith("女士") ? "女" : "男"), who });
  if (view() === "birth") renderBirth(); else location.hash = "birth";
}
function renderBirth() {
  const g = bIn.gz[0], yb = bIn.gz[1], bc = Z.birthChart({ g, m: bIn.m, d: bIn.d, h: bIn.h, sex: bIn.sex });
  const aux = Z.auxOf({ g, yb, m: bIn.m, h: bIn.h }), P = TABLES[bc.t - 1], cell = CELL[bc.cell];
  const hua = Object.fromEntries(SIHUA[g].map((s, i) => [s, i]));
  const sel = (k, opts) => `<select data-bin="${k}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(bIn[k]) ? " selected" : ""}>${t}</option>`).join("")}</select>`;
  const mon = Z.mod(2 + bIn.m - 1), x = bc.zx, q = bc.zq;
  const zSteps = x ? `${bIn.d} 不能被 ${bc.ju} 整除，補 ${x} 成 ${bIn.d + x}，商 ${q}；從寅起數第 ${q} 格是${BR[Z.mod(2 + q - 1)]}，補數 ${x} 是${x % 2 ? "奇數，逆退" : "偶數，順進"} ${x} 格` : `${bIn.d} ÷ ${bc.ju} ＝ ${q}，從寅起數第 ${q} 格`;
  const starAt = b => [...P[b].map(s => `<span${hua[s] != null ? ` class="hs"` : ""}>${s}${hua[s] != null ? badge(hua[s]) : ""}</span>`),
    ...Object.entries(aux).filter(([, at]) => at === b).map(([s]) => `<span class="${starCls(s)}">${s}${hua[s] != null ? badge(hua[s]) : ""}</span>`)].join("");
  let grid = "";
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const b = DIV[r][k];
    if (b === null) { if (r === 1 && k === 1) grid += `<div class="center"><div class="no">${bIn.gz}年 ${MONTHS[bIn.m - 1]}月${dayName(bIn.d)} ${BR[bIn.h]}時 ${bc.yang ? "陽" : "陰"}${bIn.sex}</div><div class="big">${label(cell)}</div>
      <div class="sub">${Z.JU_NAME[bc.ju]}（命宮${bc.gz}・${bc.nayin}）　身宮${BR[bc.shen]}（${bc.shenPal}）</div><div class="sub"><button class="chip" data-go="${bc.cell}">逐格研讀這一格</button></div></div>`; continue; }
    const pi = Z.mod(bc.ming - b), dx = bc.daxian.find(z => z.b === b);
    grid += `<div class="pal ${b === bc.ming ? "ming" : [4, 6, 8].includes(Z.mod(b - bc.ming)) ? "tri" : ""}"><div class="stars">${starAt(b) || `<span class="borrow">（${starsTxt(P[Z.mod(b + 6)])}）</span>`}</div>
      <span class="pn">${PAL[pi]}${b === bc.shen ? "・身" : ""}</span><span class="br">${GAN_OF(g, b)}${BR[b]}</span>${dx ? `<span class="dx">${dx.from}–${dx.to}</span>` : ""}</div>`;
  }
  const cs = CASES.filter(c => c.birth).concat(Z.DYN.filter(d => !CASES.some(c => c.who === d.who)));
  $("#v-birth").innerHTML = `<div class="filters"><div class="row bform">
      <label>年 ${sel("gz", GZ60.map(x => [x, x]))}</label><label>農曆 ${sel("m", [...MONTHS].map((t, i) => [i + 1, t + "月"]))}</label>
      <label>${sel("d", Array.from({ length: 30 }, (_, i) => [i + 1, dayName(i + 1)]))}</label><label>${sel("h", [...BR].map((t, i) => [i, t + "時"]))}</label>
      <label>${sel("sex", [["男", "男"], ["女", "女"]])}</label>
      <label>書中命例 <select data-bin="who"><option value="">—</option>${cs.map(c => `<option${c.who === bIn.who ? " selected" : ""}>${c.who}</option>`).join("")}</select></label></div>
    <span class="note-src">農曆生辰；閏月、晚子時等各派處理不同，這裡不處理。火星鈴星依《全書》通行起法（年支起子時順數）。</span></div>
  <div class="study"><div><div class="chart">${grid}</div>
    <div class="legend"><span><i style="background:var(--cinnabar-soft)"></i>命宮</span><span><i style="background:var(--gold-soft)"></i>三方四正</span><span>宮名後「・身」為身宮；宮格下方中間為大限歲數</span></div></div>
  <article class="card"><h2>排盤四步</h2>
    <ol class="steps">
      <li><b>命宮、身宮</b>：寅宮起正月，順數到${MONTHS[bIn.m - 1]}月是${BR[mon]}宮；從這裡起子時，<em>逆</em>數到${BR[bIn.h]}時是命宮 <b>${BR[bc.ming]}</b>，<em>順</em>數到${BR[bIn.h]}時是身宮 <b>${BR[bc.shen]}</b>（落${bc.shenPal}）。身宮＝命宮＋2×時支，只會落命、財、官、夫、遷、福六宮。</li>
      <li><b>五行局</b>：五虎遁，${g}年寅宮天干為${Z.GAN[Z.palaceStem(g, 2)]}，順排到命宮得 <b>${bc.gz}</b>，納音${bc.nayin}，為 <b>${Z.JU_NAME[bc.ju]}</b>。</li>
      <li><b>紫微</b>：${zSteps}，紫微在 <b>${BR[bc.z]}</b> → <b>表${bc.t}</b>；其餘十三主星依十二表排定。</li>
      <li><b>大限</b>：${g}為${bc.yang ? "陽" : "陰"}干、${bIn.sex}命，${bc.dir > 0 ? "陽男陰女順行" : "陰男陽女逆行"}；${Z.JU_NAME[bc.ju]}從 ${bc.ju} 歲起，第一大限在命宮。</li>
    </ol>
    <h3>本命四化（${g}干）</h3><p style="margin:0;font-size:14px">${SIHUA[g].map((s, i) => { const b = s in aux ? aux[s] : P.findIndex(a => a.includes(s)); return `<button class="mini" data-hgo="${g}${i}">${badge(i)} ${s}</button> 在${BR[b]}（${PAL[Z.mod(bc.ming - b)]}）`; }).join("<br>")}</p>
    <h3>命宮 ${BR[bc.ming]}</h3><p style="margin:0;font-size:14px">${cell.stars.length ? starsTxt(cell.stars) : "無正曜，借遷移 " + starsTxt(cell.borrow)}${(() => { const a = Object.entries(aux).filter(([, at]) => at === bc.ming).map(([s]) => s); return a.length ? "；" + a.join("・") : ""; })()}</p>
    ${bIn.who ? (() => { const c = CASES.find(x => x.who === bIn.who); return c ? `<h3>書中命例</h3>${caseHTML(c, { links: false })}` : ""; })() : ""}
  </article></div>
  <p class="note-src">生辰排盤只決定 144 格中的哪一格與輔煞位置；四化、大限流年的疊盤請看「四化學習」。驗證：本頁的排盤公式，用書中命例的生辰核對過，${CASES.filter(c => c.bFit).length}／${CASES.filter(c => c.bc).length} 例排出的命宮主星與書中相同，命宮輔煞 ${CASES.reduce((n, c) => n + c.auxCheck.filter(a => a.ok).length, 0)}／${CASES.reduce((n, c) => n + c.auxCheck.length, 0)} 顆全部相符。</p>`;
}
const GAN_OF = (g, b) => Z.GAN[Z.palaceStem(g, b)];
$("#v-birth").addEventListener("change", e => {
  const k = e.target.dataset.bin; if (!k) return;
  if (k === "who") { if (e.target.value) loadBirth(e.target.value); else { bIn.who = ""; renderBirth(); } return; }
  bIn[k] = ["m", "d", "h"].includes(k) ? +e.target.value : e.target.value; bIn.who = ""; renderBirth();
});

/* ───────── 練習 ───────── */
const comboTxt = c => c.stars.length ? starsTxt(c.stars) : "命無正曜";
const pad4 = (ans, pool) => shuffle([ans, ...sample([...new Set(pool)].filter(x => x !== ans), 3)]);
const QTYPES = {
  stars: { name: "命宮主星", make(pool) { const c = rand(pool), ans = comboTxt(c);
    return { q: `${label(c)}（紫微在${BR[c.t - 1]}），命宮坐什麼主星？`, ans, opts: pad4(ans, CELLS.map(comboTxt)), cell: c.id,
      ex: `${label(c)} 命宮${c.stars.length ? "坐" + starsTxt(c.stars) : "無正曜，借對宮" + starsTxt(c.borrow)}。` }; } },
  where: { name: "星在哪宮", make(pool) { const t = rand(pool).t, s = rand(ORDER), b = TABLES[t - 1].findIndex(a => a.includes(s)), ans = BR[b] + "宮";
    return { q: `表${t}（紫微在${BR[t - 1]}），${s}在哪一宮？`, ans, opts: pad4(ans, [...BR].map(x => x + "宮")), cell: id2(t, b),
      ex: `表${t} 的${s}在${BR[b]}宮${TABLES[t - 1][b].length > 1 ? "，與" + TABLES[t - 1][b].filter(x => x !== s).join("・") + "同宮" : ""}。` }; } },
  tri: { name: "三方四正", make(pool) { const c = rand(pool), [k, nm] = rand([["財", "財帛"], ["官", "事業"], ["遷", "遷移"]]), f = x => starsTxt(x.tri[k]) || "空宮", ans = f(c);
    return { q: `${label(c)}，${nm}宮坐什麼主星？`, ans, opts: pad4(ans, CELLS.map(f)), cell: c.id,
      ex: `命宮${BR[c.m]}，財帛在${BR[(c.m + 8) % 12]}、事業在${BR[(c.m + 4) % 12]}、遷移在${BR[(c.m + 6) % 12]}。${nm}宮：${ans}。` }; } },
  pat: { name: "成什麼格", make(pool) { const cs = pool.filter(c => c.pats.some(isA)); if (!cs.length) return null;
    const c = rand(cs), k = rand(c.pats.filter(isA)), ans = short(PK[k].name);
    const others = PATS.filter(p => p.cls === "A" && !QUIET.has(p.key) && !c.pats.includes(p.key)).map(p => short(p.name));
    return { q: `${label(c)}，命宮${comboTxt(c)}，只看主星可以判定成哪個格局？`, ans, opts: pad4(ans, others), cell: c.id,
      ex: `${PK[k].name}：${PK[k].cond}${PK[k].quote ? `　「${PK[k].quote}」` : ""}` }; } },
  patcell: { name: "哪一格成格", make(pool) { const ps = PATS.filter(p => p.cls === "A" && !QUIET.has(p.key) && p.occ.length && p.occ.length <= 12 && p.occ.some(id => pool.includes(CELL[id]))); if (!ps.length) return null;
    const p = rand(ps), c = CELL[rand(p.occ.filter(id => pool.includes(CELL[id])))], ans = label(c);
    return { q: `下列哪一格成「${short(p.name)}」？`, ans, opts: pad4(ans, CELLS.filter(x => !p.occ.includes(x.id)).map(label)), cell: c.id,
      ex: `${p.name}：${p.cond}。出現在 ${p.occ.map(id => label(CELL[id])).join("、")}。` }; } },
  twin: { name: "鏡像格", make(pool) { const c = rand(pool), tw = Z.twinOf(c), ans = label(tw);
    const near = [label(CELL[id2(c.t, (c.m + 6) % 12)]), label(CELL[id2((c.t + 5) % 12 + 1, c.m)]), ...sample(CELLS, 6).map(label)];
    return { q: `${label(c)} 的鏡像格是哪一格？`, ans, opts: pad4(ans, near), cell: c.id, ex: `鏡像格是表號+6、命宮+6：${ans}。兩格主星佈局完全相同，只差地支。` }; } },
  huaGan: { name: "十干四化", make() { const g = rand(STEMS), f = x => SIHUA[x].map(Z.starShort).join(""), ans = f(g), mix = shuffle(SIHUA[g]).map(Z.starShort).join("");
    return { q: `${g}干的四化（依祿、權、科、忌）是？`, ans, opts: pad4(ans, STEMS.filter(x => x !== g).map(f).concat(mix !== ans ? [mix] : [])), hua: g + "0",
      ex: `${g}干：${SIHUA[g].map((s, i) => s + "化" + HUA[i]).join("、")}。` }; } },
  huaStem: { name: "化星屬哪干", make() { const h = rand(HUA_LIST), gs = HUA_LIST.filter(x => x.name === h.name).map(x => x.g), ans = h.g + "干";
    return { q: `${h.name}是哪一干的四化？`, ans, opts: pad4(ans, STEMS.filter(g => !gs.includes(g)).map(g => g + "干")), hua: h.g + h.i,
      ex: `${h.name}：${gs.map(g => g + "干").join("、")}。${HUA_TXT[h.name]}` }; } },
  huaStar: { name: "某干化某星", make() { const h = rand(HUA_LIST), ans = h.star;
    return { q: `${h.g}干化${HUA[h.i]}是哪顆星？`, ans, opts: pad4(ans, HUA_LIST.map(x => x.star)), hua: h.g + h.i,
      ex: `${h.g}干：${SIHUA[h.g].map((s, i) => s + "化" + HUA[i]).join("、")}。` }; } },
  potMind: { name: "精神潛能", make() { const s = rand(POT_STARS), P = BOOK.POT, f = rand(["mind", "body", "kMind"]), nm = { mind: "精神潛能", body: "物質潛能", kMind: "最大精神剋星" }[f];
    return { q: `依《紫微斗數開發潛能》，哪顆星的${nm}是「${P[s][f]}」？`, ans: s, opts: pad4(s, POT_STARS.filter(x => P[x][f] !== P[s][f])),
      ex: `${s}：精神潛能「${P[s].mind}」、物質潛能「${P[s].body}」；精神剋星「${P[s].kMind}」、物質剋星「${P[s].kBody}」。` }; } },
  huaBook: { name: "四化星性（書）", make() { const names = Object.keys(HUA_BOOK), n = rand(names), h = HUA_LIST.find(x => x.name === n);
    const mask = [...ORDER, "左輔", "右弼", "文昌", "文曲"].reduce((t, x) => t.split(x).join("此星"), HUA_BOOK[n]);
    return { q: `依《紫微四化星》，哪一化的要點是：「${mask}」`, ans: n, opts: pad4(n, names.filter(x => x.slice(-1) === n.slice(-1))), hua: h.g + h.i,
      ex: `${n}：${HUA_BOOK[n]}` }; } },
  caseTab: { name: "命例定盤", make() { const c = rand(CASES.filter(x => x.cells.length === 1)), id = c.cells[0], ans = label(CELL[id]);
    const who = c.src === "hua" ? `${c.g}年生的${c.who}` : c.who, stars = CELL[id].stars;
    return { q: `書中命例：${who}，命宮在${c.br}，坐${stars.join("、") || "無正曜"}。是哪一格？`, ans, opts: pad4(ans, CELLS.filter(x => x.m === c.b && x.combo !== CELL[id].combo).map(label)), cell: id,
      ex: `${ans}（紫微在${BR[CELL[id].t - 1]}）。${c.ok ? "" : Z.caseWhere(c) + "。"}${c.src === "hua" ? c.txt : c.fix}` }; } },
  birthMing: { name: "排命宮", make() { const m = 1 + Math.floor(Math.random() * 12), h = Math.floor(Math.random() * 12), ans = BR[Z.mingAt(m, h)] + "宮";
    return { q: `農曆${MONTHS[m - 1]}月${BR[h]}時生，命宮在哪一支？`, ans, opts: pad4(ans, [...BR].map(x => x + "宮")),
      ex: `寅起正月順數到${MONTHS[m - 1]}月是${BR[Z.mod(2 + m - 1)]}，從這裡起子時逆數到${BR[h]}時：命宮${ans}；順數則是身宮${BR[Z.shenAt(m, h)]}。` }; } },
  birthJu: { name: "定五行局", make() { const g = rand(STEMS), b = Math.floor(Math.random() * 12), J = Z.juOf(g, b), ans = Z.JU_NAME[J.ju];
    return { q: `${g}年生，命宮在${BR[b]}，是什麼五行局？`, ans, opts: pad4(ans, Object.values(Z.JU_NAME)),
      ex: `五虎遁：${g}年寅宮天干為${Z.GAN[Z.palaceStem(g, 2)]}，命宮${BR[b]}為${J.gz}，納音${J.nayin}，所以是${ans}。` }; } },
  birthZw: { name: "安紫微", make() { const ju = rand([2, 3, 4, 5, 6]), d = 1 + Math.floor(Math.random() * 30), Zw = Z.ziweiAt(ju, d), ans = `表${Zw.b + 1}（紫微在${BR[Zw.b]}）`;
    return { q: `${Z.JU_NAME[ju]}，農曆${dayName(d)}生，紫微在哪？`, ans, opts: pad4(ans, Array.from({ length: 12 }, (_, i) => `表${i + 1}（紫微在${BR[i]}）`)), cell: id2(Zw.b + 1, Zw.b),
      ex: Zw.x ? `${d} 補 ${Zw.x} 成 ${d + Zw.x}，÷${ju} 得 ${Zw.q}；寅起第 ${Zw.q} 格是${BR[Z.mod(2 + Zw.q - 1)]}，補數${Zw.x % 2 ? "奇數逆退" : "偶數順進"} ${Zw.x} 格 → ${BR[Zw.b]}。` : `${d} ÷ ${ju} ＝ ${Zw.q}，寅起第 ${Zw.q} 格 → ${BR[Zw.b]}。` }; } },
  anhe: { name: "暗合宮", make() { const m = Math.floor(Math.random() * 12), ans = BR[Z.mod(1 - m)] + "宮";
    return { q: `命宮在${BR[m]}，命宮的暗合宮在哪一支？`, ans, opts: pad4(ans, [...BR].map(x => x + "宮")), ex: "暗合即地支六合：子丑、寅亥、卯戌、辰酉、巳申、午未。" }; } },
};
let quizScope = "all", quizOnlyWrong = false, quizTypes = new Set(Object.keys(QTYPES)), Q = null, score = { r: 0, n: 0 }, wrong = [];
async function loadWrong() { wrong = (await DB.get("kv", "quizWrong").catch(() => null)) || []; }
const saveWrong = () => DB.set("kv", "quizWrong", wrong.slice(-60)).catch(() => {});
function newQuestion() {
  const pool = quizScope === "all" ? CELLS : CELLS.filter(c => c.t === +quizScope);
  if (wrong.length && (quizOnlyWrong || Math.random() < 0.3)) return { ...rand(wrong), again: true };
  if (quizOnlyWrong) return null;
  for (let i = 0; i < 20; i++) { const q = QTYPES[rand([...quizTypes])].make(pool); if (q) return q; }
  return null;
}
function renderQuiz() {
  if (!Q) Q = newQuestion();
  const scopes = [["all", "全部 144 格"], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), "表" + (i + 1)])];
  $("#v-quiz").innerHTML = `<div class="quiz">
    <div class="filters">
      <div class="chips" role="group" aria-label="範圍">${scopes.map(([v, t]) => `<button class="chip" data-qs="${v}" aria-pressed="${quizScope === v}">${t}</button>`).join("")}</div>
      <div class="chips" role="group" aria-label="題型">${Object.entries(QTYPES).map(([k, v]) => `<button class="chip" data-qt="${k}" aria-pressed="${quizTypes.has(k)}">${v.name}</button>`).join("")}</div>
    </div>
    <div class="qcard">
      <div class="row" style="justify-content:space-between"><span class="note-src">本次答對 ${score.r}／${score.n}　錯題本 ${wrong.length} 題${Q?.again ? "・<b>錯題再練</b>" : ""}</span>
        <label class="note-src"><input type="checkbox" id="onlyWrong" ${quizOnlyWrong ? "checked" : ""}> 只練錯題</label></div>
      ${Q ? `<div class="q">${esc(Q.q)}</div>
      <div class="opts">${Q.opts.map(o => `<button data-ans="${esc(o)}">${esc(o)}</button>`).join("")}</div>
      <div id="qex"></div>` : `<div class="q">${quizOnlyWrong ? "錯題本是空的，太好了！" : "這個範圍沒有題目，換個題型或範圍試試。"}</div>`}
    </div></div>`;
}
$("#v-quiz").addEventListener("click", e => {
  const s = e.target.closest("[data-qs]"), t = e.target.closest("[data-qt]"), a = e.target.closest("[data-ans]"), n = e.target.closest("[data-next]");
  if (s) { quizScope = s.dataset.qs; Q = null; renderQuiz(); }
  if (t) { const k = t.dataset.qt; if (quizTypes.has(k) && quizTypes.size > 1) quizTypes.delete(k); else quizTypes.add(k); Q = null; renderQuiz(); }
  if (n) { Q = null; renderQuiz(); }
  if (a && Q && !Q.done) {
    Q.done = true; const ok = a.dataset.ans === Q.ans; score.n++; if (ok) score.r++;
    document.querySelectorAll("#v-quiz [data-ans]").forEach(b => { b.disabled = true; if (b.dataset.ans === Q.ans) b.classList.add("ok"); else if (b === a) b.classList.add("ng"); });
    const key = Q.q;
    if (ok) wrong = wrong.filter(w => w.q !== key);
    else if (!wrong.some(w => w.q === key)) { const { done, again, ...plain } = Q; wrong.push(plain); }
    saveWrong();
    $("#qex").innerHTML = `<div class="explain"><b>${ok ? "答對了！" : "正確答案：" + esc(Q.ans)}</b>　${esc(Q.ex)}</div>
      <div class="row" style="margin-top:12px"><button class="btn" data-next>下一題</button>${Q.cell ? `<button class="btn ghost" data-go="${Q.cell}">去看這一格</button>` : ""}${Q.hua ? `<button class="btn ghost" data-hgo="${Q.hua}">看這一化的星性</button>` : ""}</div>`;
    $("#qex [data-next]").focus();
  }
});
$("#v-quiz").addEventListener("change", e => { if (e.target.id === "onlyWrong") { quizOnlyWrong = e.target.checked; Q = null; renderQuiz(); } });

/* ───────── 書目與學習路徑 ───────── */
function renderBooks() {
  $("#books").innerHTML = `
  <h2>學習路徑</h2>
  <ol>
    <li><b>十四主星本性</b>：讀「十四主星」頁，逐星對照《全書》諸星問答論與《紫微斗數新詮》四十周年增訂版，心得寫在每顆星的「寫筆記」。</li>
    <li><b>十二表結構</b>：表號＝紫微所在地支（表1紫微在子…表12紫微在亥）。對照《慧心齋主談星際關係》書末基礎命盤表一至表十二。</li>
    <li><b>逐表逐格</b>：每張表先看上方「本表格局」條，知道這張表出現哪些古籍格局，再從命子讀到命亥。命宮主星以《慧心齋主談命宮》為主，筆記寫在盤面下方。</li>
    <li><b>鏡像對讀</b>：讀完表1跳表7，依序完成 1↔7、2↔8……六對，特別比較只在一邊出現的地支型格局（明珠出海、月朗天門、極向離明等）。</li>
    <li><b>格局總表</b>：每讀完一張表，回格局總表把 A 類格局逐條核對古訣；B 類到萬用命盤產生器第 4 圖層疊加輔星確認。</li>
    <li><b>練習</b>：每讀完一張表，到「練習」把範圍設成那張表，做到全對。</li>
    <li><b>開發潛能</b>：在「開發潛能」頁對照《紫微斗數開發潛能》，看每顆星的精神潛能、物質潛能與剋星；逐格研讀時研讀卡也會列出命宮主星的潛能，雙星坐命要比較兩星相近或相反。</li>
    <li><b>四化</b>：在「四化學習」熟記十干四化與星性，與《紫微四化星》逐干對讀（「書中重點」收四化本質、四個層次、六煞與化忌、天羅地網、重疊看盤、四十個命例與四個大限流年流月流日命例；點任一化可看書中的四層次細解與十二宮顯像，逐格研讀也會列出該格命宮主星的十二宮顯像），再看四化入十二表的分布；每天寫「四化日記」。</li>
    <li><b>疊加宮位</b>：《談星際關係》對十二宮關係。</li>
  </ol>
  <h2>PDF 練習簿</h2>
  <p>喜歡手寫的話，可以<a href="紫微144格練習簿.pdf" download>下載 PDF 練習簿</a>印出來：A4 共 213 頁，包含十四主星、144 格各一頁（盤面、格局古訣、手寫欄）、每張表的默寫測驗（答案倒印在頁尾）、四化學習（十干各一頁，附十二表通觀與輔星安星對照）、甲日到癸日十個四化日記範本（可影印重複使用），以及附頁碼的格局總表。</p>
  <h2>結構速查（程式窮舉驗證）</h2>
  <ul>
    <li>命宮組合共 39 種：單星 14 種（11 星各坐 6 格，紫微、武曲、廉貞單坐各 2 格），雙星 24 種各 2 格，空宮 24 格。</li>
    <li>每格都有鏡像格（表號+6、命宮+6），主星佈局完全相同，144 格成 72 對。</li>
    <li>五永久暗合橋：${BRIDGES.map(p => p.join("—")).join("、")}，十二表中恆互在對方暗合宮；紫微、巨門、天相、七殺沒有永久暗合夥伴。</li>
    <li>命宮的暗合宮只會是兄弟、子女、疾厄、交友、田宅、父母（宮序差恆為奇數）。</li>
    <li>格局編碼：A 類 ${PATS.filter(p => p.cls === "A").length} 個、B 類 ${PATS.filter(p => p.cls === "B").length} 個、C 類 ${PATS.filter(p => p.cls === "C").length} 個。</li>
  </ul>
  <h2>慧心齋主著作</h2>
  <h3>大塊文化・生命之旅系列（主讀）</h3>
  <table class="books"><thead><tr><th>書名</th><th>出版</th><th>用途</th></tr></thead><tbody>
   <tr><td>慧心齋主談命宮</td><td>2025</td><td>144 格命宮筆記主軸；甲級星分第一至第三系列，另論六吉、六煞、四化、乙級星與盤性</td></tr>
   <tr><td>慧心齋主談星際關係</td><td>2025</td><td>十二宮與星曜彼此關係；書末附基礎命盤表一至表十二</td></tr>
   <tr><td>紫微斗數新詮 四十周年經典增訂版＋修練指引手冊</td><td>2021</td><td>名詞、十二宮、各星系分析</td></tr>
   <tr><td>紫微四化星：如何改變一生的祕笈＋奇妙修練日記簿</td><td>2021</td><td>十干四化逐章、四化與大運流年；研讀重點收在「四化學習 → 書中重點」，命例可直接跳到對應的格</td></tr>
  </tbody></table>
  <h3>時報文化等舊版</h3>
  <table class="books"><tbody>
   <tr><td>紫微斗數新詮</td><td>時報 1982</td><td>原版，與增訂版對照</td></tr>
   <tr><td>紫微斗數看命宮</td><td>時報</td><td>與《談命宮》對照新舊觀點</td></tr>
   <tr><td>紫微斗數導讀</td><td>時報</td><td>入門架構</td></tr>
   <tr><td>如何推算命運</td><td>時報 1984</td><td>推運</td></tr>
   <tr><td>紫微斗數看婚姻／看錢財／看工商人</td><td>時報 1984–1988</td><td>夫妻、財帛、事業宮專題</td></tr>
   <tr><td>紫微斗數趨吉避凶法</td><td>自立 1986</td><td>煞忌與化解</td></tr>
   <tr><td>紫微斗數開發潛能（一）（二）</td><td>時報</td><td>精神潛能、物質潛能、幸運色與剋星；研讀重點收在「開發潛能」頁與十四主星卡</td></tr>
  </tbody></table>
  <h2>古籍</h2>
  <ul>
    <li>《紫微斗數全書》（明，託名陳希夷著、羅洪先校）：〈太微賦〉〈骨髓賦〉〈形性賦〉〈女命骨髓賦〉〈諸星問答論〉及定富局、定貴局等格局。本頁古訣多出於此，各刊本文字略有異同。</li>
    <li>《紫微斗數全集》：與《全書》互校。</li>
    <li>「探花格」「狀元格」等名稱屬後世通稱，《全書》未見，已在格局總表註明。</li>
  </ul>`;
}

/* ───────── 使用說明（和課程群組公告同一份內容） ───────── */
function renderHelp() {
  $("#help").innerHTML = `
  <h2>這是什麼</h2>
  <p>紫微斗數十二表 × 十二命宮共 144 格的研習工具。不用安裝、不用註冊，建議用電腦的 Chrome 或 Edge。${ONLINE ? "" : "你現在用的是離線版，沒有網路也能用。"}</p>
  <ul>
    <li><b>逐格研讀</b>：選表號和命宮，看盤面、三方四正、格局古訣、鏡像格。</li>
    <li><b>寫筆記</b>：盤面下方直接打字，會自動存檔。</li>
    <li><b>看進度</b>：「開始」頁會顯示讀到哪裡，並帶你讀下一格。</li>
    <li><b>練習</b>：隨機出題，答錯的題目之後會再出現。</li>
    <li><b>四化學習</b>：「四化星性」熟記十干四化並寫星性筆記；「四化入表」看四化在十二表中同宮、三合、對宮、暗合的分布，與四化相關的輔星、煞星可選擇安或不安：祿存、羊陀、魁鉞隨天干自動排；左右指定一顆，另一顆自動安上；昌曲、空劫共用一個時辰，指定任一顆，另一組一起移動，不會排出不存在的盤。火鈴和四化無關，不安。安上後會列出四化同宮、被夾、三方四正會照的星。</li>
    <li><b>開發潛能</b>：慧心齋主《紫微斗數開發潛能》的重點：每顆星的精神潛能、物質潛能、幸運色、矯正色與剋星，雙星對照和七個命例。</li>
    <li><b>生辰排盤</b>：輸入農曆生辰，一步步看命宮、身宮、五行局、紫微怎麼排出來，落在 144 格的哪一格，並安上大限與年月時系的輔煞。可從下拉選單載入書中命例，對照書上的盤。練習裡的「排命宮」「定五行局」「安紫微」三種題型練的就是這幾步。</li>
    <li><b>四化日記</b>：選日期、查萬年曆選當天天干，帶出當天四化寫日記。同一天已經寫過會提醒，不會覆蓋；可以補寫之前的日子。</li>
  </ul>
  <h2>第一次使用，請先做這一步</h2>
  <ol>${ONLINE
    ? `<li>在電腦上建一個空資料夾，例如「紫微筆記」。</li>
    <li>按上方的「選擇筆記資料夾」，選剛剛那個資料夾。</li>
    <li>跳出「建立筆記」時按確定。</li>`
    : `<li>按上方的「選擇筆記資料夾」。</li>
    <li>選研習包裡的「${esc(CFG.notesDir)}」資料夾（選到整個研習包資料夾也可以，會自動進去）。</li>`}
  </ol>
  <p>之後寫的筆記都會存成檔案放在這個資料夾裡，換電腦時整個資料夾帶走就好。每次重新打開瀏覽器，上方會出現「繼續」按鈕，按一下就能接著寫。</p>
  <p>${S.canFolder ? `<button class="btn" data-act="chooseFolder">選擇筆記資料夾</button>` : `<b>這個瀏覽器不能直接存到資料夾</b>，請看下一段。`}</p>
  <h2>用手機、iPad、Safari 的同學</h2>
  <p>一樣可以讀、寫筆記，但筆記會存在瀏覽器裡。請記得到「<a href="#backup">筆記與備份</a>」按「匯出備份」，把 zip 檔存好。也請不要用無痕視窗，關掉後筆記就會消失。</p>
  <h2>喜歡手寫的同學</h2>
  <p>可以<a href="紫微144格練習簿.pdf" download>下載 PDF 練習簿</a>（A4，213 頁）：每格一頁，附手寫欄和每張表的默寫測驗；還有四化學習章和十個四化日記範本，印出來搭配書讀。</p>
  <h2>沒有網路時</h2>
  <p>${ONLINE ? `頁首右上角有「<a href="紫微研習包.zip" download>下載離線版</a>」（約 9MB，含 PDF 練習簿），解壓縮後雙擊「紫微研習.html」，沒有網路也能用。` : `你現在用的就是離線版。研習包資料夾整個複製或壓縮帶走即可。`}離線版和線上版可以共用同一個筆記資料夾；筆記存在瀏覽器裡的話，兩邊是分開的，要用「匯出備份」再「匯入」搬過去。</p>
  <h2>建議讀法</h2>
  <p>十四主星 → 表一逐格讀完 → 鏡像的表七 → 表二↔表八……共六對。每讀完一張表，到「<a href="#quiz">練習</a>」把範圍設成那張表，做到全對。更詳細的學習路徑見「<a href="#books">書目與路徑</a>」。</p>
  <h2>隱私</h2>
  <p>筆記只存在你自己的電腦或瀏覽器裡，不會上傳到任何地方。</p>
  <h2>進階：Obsidian、Typora</h2>
  <p>筆記都是一般的 Markdown（.md）檔，可以用 Obsidian「開啟資料夾作為 vault」或 Typora 打開同一個筆記資料夾。切回研習頁時會自動重新讀取，但請不要兩邊同時改同一則筆記。</p>`;
}

/* ───────── 筆記與備份 ───────── */
function renderBackup() {
  const n = [...S.notes.keys()].length;
  const where = S.mode === "folder"
    ? `<div class="where">資料夾「${esc(S.dir.name)}」</div><p>${S.perm ? "筆記直接存成 .md 檔。整個研習包資料夾複製、壓縮帶走，筆記都在裡面。" : S.lost ? "找不到這個資料夾，可能已經搬走或改名，請重新選擇。" : "瀏覽器需要你按一次「繼續」才能讀寫。"}</p>
       <div class="row">${S.perm ? "" : S.lost ? `<button class="btn" data-act="chooseFolder">重新選擇</button>` : `<button class="btn" data-act="reconnect">繼續</button>`}<button class="btn ghost" data-act="chooseFolder">換一個資料夾</button><button class="btn ghost" data-act="useBrowser">改存在瀏覽器</button></div>`
    : `<div class="where">這個瀏覽器裡（${n} 則）</div><p>${S.canFolder ? "建議改存到研習包裡的「筆記」資料夾，筆記會變成檔案，搬家、備份都簡單。" : "這個瀏覽器不能直接存到資料夾（Chrome、Edge 才可以）。請常按「匯出備份」。"}</p>
       <div class="row">${S.canFolder ? `<button class="btn" data-act="chooseFolder">選擇筆記資料夾</button>` : ""}</div>`;
  $("#v-backup").innerHTML = `<div class="cards">
    <article class="card"><h2>筆記存在哪裡</h2>${where}</article>
    <article class="card"><h2>匯出備份</h2><p>把全部筆記打包成一個 zip 檔下載。換電腦、交作業、給老師看都用這個。<br><span class="note-src">上次備份：${S.lastBackup ? ymd(new Date(S.lastBackup)) : "還沒有"}</span></p>
      <div class="row"><button class="btn" data-act="exportZip">匯出備份 zip</button></div></article>
    <article class="card"><h2>匯入</h2><p>把備份 zip 或筆記資料夾讀進來。空白的段落會補上；兩邊都寫過的段落，匯入的文字會接在後面，<b>不會覆蓋</b>任何文字。</p>
      <div class="row"><button class="btn ghost" data-act="importZip">匯入 zip</button><button class="btn ghost" data-act="importDir">匯入資料夾</button></div></article>
    ${S.mode === "folder" && S.perm ? `<article class="card"><h2>補齊筆記檔</h2><p>如果不小心刪掉某些筆記檔，這裡可以把缺少的補回空白範本，已經存在的檔案不會動。</p><div class="row"><button class="btn ghost" data-act="fill">補齊缺少的筆記</button></div></article>` : ""}
    <article class="card"><h2>進階：用 Obsidian 或 Typora</h2><p>筆記都是一般的 Markdown（.md）檔。用 Obsidian「開啟資料夾作為 vault」選「筆記」資料夾，就有雙向連結；Typora 也能直接打開來讀寫。研習頁和它們改的是同一批檔案，切回研習頁時會自動重新讀取，但請不要兩邊同時改同一則筆記。</p></article>
    ${ONLINE ? `<article class="card"><h2>下載離線版</h2><p>研習包 zip 裡有研習頁、萬用命盤產生器和整套筆記，解壓縮後雙擊「紫微研習.html」就能在沒有網路時使用。線上版和離線版的筆記可以共用同一個筆記資料夾。</p><div class="row"><a class="btn ghost" href="紫微研習包.zip" download>下載紫微研習包</a></div></article>` : ""}
    <article class="card"><h2>瀏覽器說明</h2><p><b>Chrome、Edge</b>：可以直接存到資料夾，最推薦。<br><b>Safari、Firefox</b>：筆記存在瀏覽器裡，請定期匯出備份。<br>請不要用無痕視窗，關掉後筆記會消失。</p></article>
  </div>`;
}
$("#inZip").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { await runImport(await Z.readZip(await f.arrayBuffer()), "匯入 " + ymd(new Date())); }
  catch (err) { toast("讀不到這個 zip 檔：" + (err.message || err)); }
});
$("#inDir").addEventListener("change", async e => {
  const fs = [...e.target.files].filter(f => f.name.endsWith(".md")); e.target.value = "";
  const list = []; for (const f of fs) list.push({ path: f.webkitRelativePath || f.name, text: await f.text() });
  await runImport(list, "匯入 " + ymd(new Date()));
});

/* ───────── 啟動 ───────── */
(async () => {
  if (ONLINE) $(".vault").innerHTML = `線上版・<a href="紫微研習包.zip" download>下載離線版</a><br><b>筆記：你選的筆記資料夾</b>`;
  await boot(); await loadWrong();
  renderBooks(); renderHelp(); renderBanner(); route();
})();
