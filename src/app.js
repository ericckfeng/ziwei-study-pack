/* 紫微研習包介面：看盤、寫筆記、進度、練習、備份。資料與範本來自 core.js（window.ZW）。 */
"use strict";
const Z = window.ZW;
const { BR, PAL, CELL, CELLS, PK, PATS, PARTNER, QUIET, DIV, TABLES, STARS, SIHUA, ORDER, BRIDGES } = Z;
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
function saveNote(path, { sections = {}, status } = {}) {
  return queue(async () => {
    let base = S.mode === "folder" ? await readFile(path) : S.notes.get(path);   // 先讀最新檔案，保留 Obsidian 那邊的修改
    if (base == null) base = tpl().get(path);
    let t = base;
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
function editorHTML(path, title) {
  const md = noteText(path), secs = Z.sectionsOf(md), isCell = Z.getFront(md, "類型") === "格";
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
const VIEWS = ["home", "study", "overview", "patterns", "stars", "quiz", "books", "backup"];
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
        <li>先到「十四主星」認識每顆星的性情。</li>
        <li>在「逐格研讀」看盤面、格局、鏡像格，下面直接寫筆記，會自動存檔。</li>
        <li>讀完把狀態改成「已完成」，這裡會自動帶到下一格。</li>
        <li>每讀完一張表，到「練習」做幾題，答錯的題目之後會再出現。</li>
        <li>常到「筆記與備份」看筆記存在哪裡，記得備份。</li>
      </ol>
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
    <p class="note-src">鏡像格：表號+6、命宮+6，主星佈局完全相同，只差地支。日月廟陷、子午卯酉等地支型格局會在鏡像格消失或改變，這正是比較重點。</p>`;
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
    <p class="note-src" style="margin:8px 0 0">永久暗合夥伴：${PARTNER[s] ? `<b>${PARTNER[s]}</b>（十二表中恆在暗合宮）` : "無"}</p>
    <h3>坐命 ${seats.length} 格，組合</h3><div class="links">${combos.map(k => `<button class="chip" data-go="${seats.find(c => c.combo === k).id}">${k}</button>`).join("")}</div>
    ${pats.length ? `<h3>坐命可成之格</h3><div class="note-src">${pats.join("、")}</div>` : ""}
    <div style="margin-top:12px"><button class="btn ghost" data-note="${esc(path)}" data-title="主星筆記：${s}">${has ? "看我的筆記 ✎" : "寫筆記"}</button></div></article>`;
  }).join("");
}

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
      <div class="row" style="margin-top:12px"><button class="btn" data-next>下一題</button>${Q.cell ? `<button class="btn ghost" data-go="${Q.cell}">去看這一格</button>` : ""}</div>`;
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
    <li><b>疊加四化與宮位</b>：《紫微四化星》逐干對讀，《談星際關係》對十二宮關係。</li>
  </ol>
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
   <tr><td>紫微四化星：如何改變一生的祕笈＋奇妙修練日記簿</td><td>2021</td><td>十干四化逐章、四化與大運流年</td></tr>
  </tbody></table>
  <h3>時報文化等舊版</h3>
  <table class="books"><tbody>
   <tr><td>紫微斗數新詮</td><td>時報 1982</td><td>原版，與增訂版對照</td></tr>
   <tr><td>紫微斗數看命宮</td><td>時報</td><td>與《談命宮》對照新舊觀點</td></tr>
   <tr><td>紫微斗數導讀</td><td>時報</td><td>入門架構</td></tr>
   <tr><td>如何推算命運</td><td>時報 1984</td><td>推運</td></tr>
   <tr><td>紫微斗數看婚姻／看錢財／看工商人</td><td>時報 1984–1988</td><td>夫妻、財帛、事業宮專題</td></tr>
   <tr><td>紫微斗數趨吉避凶法</td><td>自立 1986</td><td>煞忌與化解</td></tr>
   <tr><td>紫微斗數開發潛能（一）（二）</td><td>時報</td><td>星曜特質應用</td></tr>
  </tbody></table>
  <h2>古籍</h2>
  <ul>
    <li>《紫微斗數全書》（明，託名陳希夷著、羅洪先校）：〈太微賦〉〈骨髓賦〉〈形性賦〉〈女命骨髓賦〉〈諸星問答論〉及定富局、定貴局等格局。本頁古訣多出於此，各刊本文字略有異同。</li>
    <li>《紫微斗數全集》：與《全書》互校。</li>
    <li>「探花格」「狀元格」等名稱屬後世通稱，《全書》未見，已在格局總表註明。</li>
  </ul>`;
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
  renderBooks(); renderBanner(); route();
})();
