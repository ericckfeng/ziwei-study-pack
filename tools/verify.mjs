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
// 四化
assert.equal(Z.HUA_LIST.length, 40); assert.equal(Z.HUA_NAMES.length, 39);
assert.deepStrictEqual(Object.keys(Z.HUA_TXT).sort(), [...Z.HUA_NAMES].sort(), "每一化都有通行說法");
for (let mo = 0; mo < 12; mo++) for (const [a, start, dir] of [["左輔", 4, 1], ["文曲", 4, 1]]) {   // 左輔辰起順行、右弼戌起逆行；文曲辰起順行、文昌戌起逆行
  const b = Z.mod(start + dir * mo), partner = Z.mod(10 - mo);
  assert.equal(Z.auxPositions({ [a]: b })[Z.AUX[a]], partner, a + "對稱");
  assert.equal(Z.auxPositions({ [Z.AUX[a]]: partner })[a], b);
}
assert.deepStrictEqual([...Array(12).keys()].filter(b => Z.auxPartnerAt(b) === b), [1, 7], "只有丑未同宮");
// 六吉六煞：地劫亥起子時順、地空亥起子時逆；祿存、羊陀、魁鉞隨天干
for (let h = 0; h < 12; h++) assert.strictEqual(Z.pairAt("地劫", (11 + h) % 12), (11 - h + 12) % 12, "空劫對稱");
assert.deepStrictEqual([...Array(12).keys()].filter(b => Z.pairAt("地空", b) === b), [5, 11], "只有巳亥同宮");
assert.deepStrictEqual(Z.STEMS.map(g => Z.BR[Z.LUCUN[g]]).join(""), "寅卯巳午巳午申酉亥子", "祿存");
assert.deepStrictEqual(Z.STEMS.map(g => Z.KUIYUE[g].map(b => Z.BR[b]).join("")).join(" "), "丑未 子申 亥酉 亥酉 丑未 子申 丑未 午寅 卯巳 卯巳", "魁鉞");
for (const g of Z.STEMS) { const at = Z.stemStars(g, { 祿存: 1, 羊陀: 1 }); assert.deepStrictEqual(Z.jiaAt(at, at.祿存), ["擎羊陀羅"], g + " 羊陀夾祿存"); }
assert.deepStrictEqual(Z.stemStars("甲", {}), {}, "不安");
assert.deepStrictEqual(Z.auxPositions({ 地劫: 0 }), { 地劫: 0, 地空: 10 }, "空劫成對");
// 時辰星：與成對規則一致、可反推時辰
for (let h = 0; h < 12; h++) {
  for (const [x, y] of [["文昌", "文曲"], ["地劫", "地空"]]) {
    assert.strictEqual(Z.pairAt(x, Z.HOUR_AT[x](h)), Z.HOUR_AT[y](h), x + y + " 成對");
    for (const s of [x, y]) assert.strictEqual(Z.HOUR_OF[s](Z.HOUR_AT[s](h)), h, s + " 反推時辰");
  }
}
assert.deepStrictEqual([Z.BR[Z.HOUR_AT.文昌(0)], Z.BR[Z.HOUR_AT.文曲(0)], Z.BR[Z.HOUR_AT.地劫(1)], Z.BR[Z.HOUR_AT.地空(1)]], ["戌", "辰", "子", "戌"], "子時昌曲、丑時空劫");
const rels = g => Z.huaPairs(g).map(x => x.rels && [...new Set(x.rels)].join("/"));
assert.equal(rels("甲")[1], "三合", "甲：廉祿武科恆三合");
assert.equal(rels("庚")[4].split("/").every(r => r.startsWith("暗合")), true, "庚：武權陰忌恆暗合");
assert.equal(Z.huaPairs("壬")[1].rels, null, "壬：左輔未安");
assert.equal(new Set(Z.huaPairs("壬", { 右弼: 3 })[1].rels).size > 1, true);
assert.equal(Z.huaPlaces(1, "壬", { 右弼: 3 })[2].b, Z.mod(2 - 3), "右弼卯→左輔亥");
assert.equal(Z.relOf(6, 7), "暗合・鄰宮"); assert.equal(Z.relOf(2, 6), "三合"); assert.equal(Z.relOf(0, 6), "對宮");
// 慧心齋主兩書重點（book.js）
assert.deepStrictEqual(Object.keys(Z.HUA_BOOK).sort(), [...Z.HUA_NAMES].sort(), "每一化都有書中要點");
for (const s of Z.ORDER) {
  assert.ok(Z.BOOK.POT[s] && Z.BOOK.HUA_STAR[s], s + " 有潛能與四化總評");
  for (const f of ["mind", "body", "lucky", "fix", "kMind", "kBody", "core", "tMind", "tBody", "jobs"]) assert.ok(Z.BOOK.POT[s][f], `${s} 潛能檔案缺 ${f}`);
  const no = Z.BOOK.HUA_STAR[s].no, banned = no === "全無四化" ? "祿權科忌" : [...no.matchAll(/不化([祿權科忌])/g)].map(m => m[1]).join("");
  for (const h of banned) assert.ok(!Z.HUA_LIST.some(x => x.star === s && Z.HUA[x.i] === h), `${s}不化${h}，但四化表有`);
}
assert.equal(Z.CASES.length, 47);
for (const c of Z.CASES) {
  assert.ok(c.b >= 0 && c.cells.every(id => Z.CELL[id]), c.who + " 格位");
  if (c.src === "hua") assert.ok(Z.SIHUA[c.g].some((s, i) => c.cfg.includes(s + "化" + Z.HUA[i])), c.who + " 命宮的化星屬於年干");
}
// 生辰排盤：紫微安星表（各局初一至初六）、命身宮、五虎遁納音、書中命例
assert.equal([2, 3, 4, 5, 6].map(j => Z.BR[Z.ziweiAt(j, 1).b]).join(""), "丑辰亥午酉", "各局初一紫微");
assert.equal([2, 3, 4, 5, 6].map(j => Z.BR[Z.ziweiAt(j, j).b]).join(""), "寅寅寅寅寅", "日數等於局數，紫微在寅");
for (let m = 1; m <= 12; m++) for (let h = 0; h < 12; h++) assert.equal(Z.mod(Z.shenAt(m, h) - Z.mingAt(m, h)), Z.mod(2 * h), "身宮＝命宮＋2×時");
assert.equal(Z.juOf("甲", 0).gz, "丙子", "甲年子宮為丙子（子丑接在亥之後）");
assert.equal(Z.juOf("庚", 3).nayin, "城頭土");
let bc = Z.birthChart({ g: "庚", m: 3, d: 5, h: 1, sex: "男" });   // 魏先生
assert.deepStrictEqual([bc.t, Z.BR[bc.ming], bc.ju], [3, "卯", 5], "魏先生：表3・命卯・土五局");
bc = Z.birthChart({ g: "辛", m: 10, d: 27, h: 3, sex: "男" });   // 潘先生：書中乙未大限 16–25
assert.deepStrictEqual([bc.daxian[1].gz, bc.daxian[1].from], ["乙未", 16]);
assert.equal(Z.CASES.filter(c => c.bFit).length, 37, "生辰排出的命宮主星與書中相同");
assert.deepStrictEqual(Z.CASES.filter(c => c.bc && !c.bFit).map(c => c.who).sort(), ["戚女士", "柏女士", "褚女士"].sort(), "只剩原書自身排盤有誤的三例");
assert.ok(Z.CASES.filter(c => c.bc && !c.bFit).every(c => c.verified && c.ok), "原書排盤有誤的命例都已對照原書");
assert.ok(Z.DYN.every(d => d.bc.t === d.t), "動態命例：生辰排盤與原書命盤相同");
assert.ok(Z.CASES.every(c => c.auxCheck.every(a => a.ok)), "命宮輔煞全部落在命宮");
{ const c = Z.CASES.find(c => c.who === "丙女士"); assert.ok(c.ok && !c.shenBad && c.cells[0] === "0406", "丙女士依原書：表4・命午，身宮戌天同"); }
for (const [n, t] of Object.entries(Z.BOOK.HUA_PALACE)) assert.ok(Z.HUA_NAMES.includes(n) && t.split("；").every(x => x.length > 2), n + " 十二宮顯像");
// 資料檔：十干四化（日記用）星名須與四化表一致；命例欄位與生辰格式
for (const g of Z.STEMS) assert.deepStrictEqual(Z.BOOK.DIARY_HUA[g].map(r => r[0]), Z.SIHUA[g].map((s, i) => s + "化" + Z.HUA[i]), g + "干十干四化");
for (const c of Z.BOOK.CASES) {
  assert.ok(c.who && ["hua", "pot"].includes(c.book) && c.t >= 1 && c.t <= 12 && Z.BR.includes(c.br) && c.cfg, "命例欄位：" + c.who);
  if (c.birth) Z.parseBirth(c.birth);
}
assert.notEqual(Z.diaryHua("乙", 3), Z.diaryHua("庚", 3), "乙、庚太陰化忌的日記解說各自不同");
// 四化日記
let dy = Z.diaryNote("2026-11-09", "丁");
assert.equal(Z.getFront(dy, "天干"), "丁"); assert.match(Z.getSection(dy, "今日四化"), /化忌：\[\[巨門\]\]/);
dy = Z.setSection(dy, "今日事件", "記帳");
dy = Z.setDiaryDate(Z.setDiaryStem(dy, "辛"), "2026-11-07");
assert.equal(Z.getFront(dy, "日期"), "2026-11-07"); assert.match(dy, /^# 2026-11-07　四化日記$/m);
assert.match(Z.getSection(dy, "今日四化"), /化忌：文昌/); assert.equal(Z.getSection(dy, "今日事件"), "記帳");
assert.deepStrictEqual(Z.sectionsOf(dy).map(x => x[0]), ["今日事件", "對應四化", "心得"]);
assert.equal(Z.normalizeImportPath("備份/四化日記/2026-11-09.md"), "四化日記/2026-11-09.md");
const my = files.find(f => f.path === Z.PATH.myHua).text;
assert.equal(Z.sectionsOf(my).length, 39); assert.equal(Z.getSection(Z.setSection(my, "太陰化忌", "x"), "太陰化忌"), "x");
console.log("全部通過：", files.length, "則筆記");
