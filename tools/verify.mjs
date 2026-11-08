// 驗證 core.js 與原研習頁（由 gen2.py 產生）的資料逐格一致，並測試段落合併與 zip
import { createRequire } from "module"; import assert from "assert";
const require = createRequire(import.meta.url);
const Z = require("../src/core.js"), REF = require("./reference-data.json");
assert.deepStrictEqual(Z.TABLES, REF.tables, "十二表");
assert.deepStrictEqual(Z.BRIDGES, REF.bridges, "暗合橋");
assert.deepStrictEqual(Z.CELLS, REF.cells, "144 格");
const noNote = a => a.map(({ note, ...r }) => r);   // 備註文字刻意改寫（拿掉個人知識庫字眼）
assert.deepStrictEqual(noNote(Z.PATS), noNote(REF.pats), "格局判定與出現位置");
// 段落
let md = Z.cellNote(Z.CELL["0707"]);
md = Z.setSection(md, "我的心得與驗證", "第一行\n第二行");
assert.equal(Z.getSection(md, "我的心得與驗證"), "第一行\n第二行");
assert.equal(Z.getSection(md, "慧心齋主觀點"), "出處：[[慧心齋主談命宮]] 頁");
md = Z.setFront(md, "狀態", "研讀中"); assert.equal(Z.getFront(md, "狀態"), "研讀中");
const base = Z.setSection(Z.cellNote(Z.CELL["0101"]), "古籍摘記", "A");
const inc = Z.setFront(Z.setSection(Z.setSection(Z.cellNote(Z.CELL["0101"]), "古籍摘記", "B"), "我的心得與驗證", "C"), "狀態", "已完成");
const m = Z.mergeNote(base, inc, "匯入").text;
assert.match(Z.getSection(m, "古籍摘記"), /^A\n\n---\n（匯入）\nB$/);
assert.equal(Z.getSection(m, "我的心得與驗證"), "C"); assert.equal(Z.getFront(m, "狀態"), "已完成");
assert.equal(Z.mergeNote(m, inc, "x").changed, false);
// zip 往返
const files = Z.allNotes("2026-11-08");
const back = await Z.readZip(Z.makeZip(files.map(f => ({ path: "筆記/" + f.path, data: f.text }))));
assert.equal(back.length, files.length); assert.equal(back[5].text, files[5].text);
assert.equal(Z.normalizeImportPath("x/紫微研習包/筆記/144格/a.md"), "144格/a.md");
console.log("全部通過：", files.length, "則筆記");
