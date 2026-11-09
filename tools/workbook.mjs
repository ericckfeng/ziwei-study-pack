// PDF 練習簿：用 core.js 的資料排成 A4 頁面，交給 Chrome 印成 PDF。
// 版面都是固定一頁，頁碼可以預先算好，讓鏡像格、格局出現位置都能寫「p.xx」。
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Z = require(path.join(ROOT, "src/core.js"));
const { BR, PAL, CELL, CELLS, PK, PATS, PARTNER, QUIET, DIV, TABLES, STARS, SIHUA, ORDER, BRIDGES } = Z;
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const OUT = path.join(ROOT, "dist"), PDF = path.join(OUT, "紫微144格練習簿.pdf");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* ───────── 頁碼 ───────── */
const P_GUIDE = 2, P_PROGRESS = 3, P_STAR0 = 4;
const tableStart = t => P_STAR0 + 14 + (t - 1) * 14;
const cellPage = c => tableStart(c.t) + 1 + c.m;
const testPage = t => tableStart(t) + 13;
const P_HUA = tableStart(13);                 // 四化章：首頁、十干各一頁、輔星對照、日記說明、十天干日記範本
const huaStemPage = g => P_HUA + 1 + Z.STEMS.indexOf(g), P_HUA_AUX = P_HUA + 11, P_DIARY = P_HUA + 12;
const diaryPage = g => P_DIARY + 1 + Z.STEMS.indexOf(g);
const P_PATS = P_DIARY + 11;
const starPage = s => P_STAR0 + ORDER.indexOf(s);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const id2 = Z.cellId, label = Z.label, short = Z.shortName, j = a => a.join("・");
const isA = k => PK[k].cls === "A" && !QUIET.has(k);
const isB = k => PK[k].cls === "B" && PK[k].occ.length <= 4;
const pg = n => `<span class="pg">p.${n}</span>`;

/* ───────── 盤面 ───────── */
function chart(t, { ming = null, tags = false, blank = false, center = "" } = {}) {
  const P = TABLES[t - 1];
  const tri = ming === null ? new Set() : new Set([(ming + 4) % 12, (ming + 8) % 12, (ming + 6) % 12]);
  let h = "";
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const b = DIV[r][k];
    if (b === null) { if (r === 1 && k === 1) h += `<div class="cc">${center}</div>`; continue; }
    const cls = b === ming ? "ming" : tri.has(b) ? "tri" : "";
    const st = blank ? "" : P[b].length ? P[b].map(s => `<b>${s}</b>`).join("") : `<i>（${j(P[(b + 6) % 12])}）</i>`;
    const c = CELL[id2(t, b)];
    const tg = tags && !blank ? c.pats.filter(isA).map(k => `<u>${short(PK[k].name)}</u>`).concat(c.pats.filter(isB).map(k => `<u class="b">${short(PK[k].name)}</u>`)).join("") : "";
    const pn = ming === null ? (blank ? "" : `p.${cellPage(c)}`) : PAL[((ming - b) % 12 + 12) % 12];
    h += `<div class="pal ${cls}"><div class="st">${st}</div>${tg ? `<div class="tg">${tg}</div>` : ""}<span class="pn">${pn}</span><span class="br">${BR[b]}</span></div>`;
  }
  return `<div class="chart">${h}</div>`;
}
const lines = (title, hint, grow = 1) => `<div class="write" style="flex-grow:${grow}"><div class="wh"><b>${title}</b>${hint ? `<span>${hint}</span>` : ""}</div><div class="ln"></div></div>`;
const page = (body, cls = "") => `<section class="page ${cls}">${body}</section>`;

/* ───────── 封面、說明、進度 ───────── */
const today = new Date().toISOString().slice(0, 10);
const cover = page(`
  <div class="cover">
    <div class="eyebrow">紫微斗數研習</div>
    <h1>紫微一百四十四格<br>練習簿</h1>
    <p class="sub">十二表 × 十二命宮 ‧ 古籍格局對照 ‧ 四化學習與四化日記<br>以古籍與慧心齋主著作為本</p>
    <div class="me"><div>姓名<span></span></div><div>開始日期<span></span></div><div>完成日期<span></span></div></div>
    <p class="foot">v${VERSION}（${today}）・線上研習頁 ericckfeng.github.io/ziwei-study-pack</p>
  </div>`, "cv");

const guide = page(`
  <h2 class="ph">使用方式</h2>
  <div class="prose">
  <h3>這本練習簿怎麼排</h3>
  <ul>
    <li><b>十四主星</b>（p.${P_STAR0}–${P_STAR0 + 13}）：每顆星一頁，先認識星性。</li>
    <li><b>十二表</b>（p.${tableStart(1)}–${P_PATS - 1}）：每張表 14 頁：本表總覽、命子到命亥 12 格、本表自我測驗。</li>
    <li><b>四化學習</b>（p.${P_HUA}–${P_DIARY - 1}）：十干四化表、每干一頁（通行說法、十二表中四化兩兩的關係）、輔星安星對照。</li>
    <li><b>四化日記</b>（p.${P_DIARY}–${P_PATS - 1}）：寫法說明與甲日到癸日十個範本，可影印重複使用。</li>
    <li><b>格局總表</b>（p.${P_PATS} 起）：每個格局出現在哪幾格、第幾頁。</li>
    <li>表號＝紫微所在的地支：表1 紫微在子、表2 紫微在丑……表12 紫微在亥。</li>
  </ul>
  <h3>讀一格的步驟</h3>
  <ol>
    <li>看盤面：紅底是命宮，淡黃是三方四正（財帛、事業、遷移）。空宮括號裡是借對宮的星。</li>
    <li>看格局：「已成格」只看主星就成立；「待成格」主星條件已具，還要看輔星、煞星或年干。</li>
    <li>讀書寫筆記：古籍摘記註明篇名；慧心齋主觀點用自己的話寫並註頁碼，不整段抄錄。</li>
    <li>翻到鏡像格（頁尾有頁碼）比較：主星佈局完全一樣，只差地支。</li>
    <li>勾頁尾的「研讀中／已完成」，再到 p.${P_PROGRESS} 的進度表塗格子。</li>
  </ol>
  <h3>建議順序</h3>
  <p>十四主星 → 表一逐格（命子到命亥）→ 鏡像表七 → 表二↔表八 …… 共六對。每讀完一表，做那張表最後一頁的自我測驗，答案倒印在頁尾。</p>
  <h3>盤面看法</h3>
  <div class="legend"><span><i class="lm"></i>命宮</span><span><i class="lt"></i>三方四正</span><span><u>格局</u>以此宮為命即成格</span><span><u class="b">格局</u>主星條件已具，待輔星</span></div>
  <p>萬用命盤產生器可疊加四化、十二宮與六吉六煞：每格頁面上的「生成碼」貼進去就能還原。B 類、C 類格局要在那裡確認。</p>
  <h3>和線上研習頁一起用</h3>
  <p>研習頁（ericckfeng.github.io/ziwei-study-pack）有同樣的盤面，還能打字寫筆記、自動統計進度、出練習題。手寫和打字可以並用：先在這本練習簿上讀、畫重點，整理好再打進研習頁。</p>
  </div>`);

const progress = page(`
  <h2 class="ph">研讀進度表</h2>
  <p class="note">讀完一格就把那一格塗滿（研讀中可以先畫斜線）。每格下方小字是頁碼。</p>
  <table class="prog"><thead><tr><th></th>${[...BR].map(b => `<th>命${b}</th>`).join("")}</tr></thead><tbody>
  ${Array.from({ length: 12 }, (_, i) => `<tr><th>表${i + 1}<small>紫${BR[i]}</small></th>${Array.from({ length: 12 }, (_, m) => { const c = CELL[id2(i + 1, m)]; return `<td><b>${c.combo}</b><small>${cellPage(c)}</small></td>`; }).join("")}</tr>`).join("")}
  </tbody></table>
  <div class="tally"><div>已完成<span></span>／144</div><div>研讀中<span></span></div><div>日期<span></span></div></div>`);

/* ───────── 十四主星 ───────── */
const starPages = ORDER.map(s => {
  const St = STARS[s], seats = CELLS.filter(c => c.stars.includes(s));
  const hua = Object.entries(SIHUA).flatMap(([g, a]) => a.map((x, i) => x === s ? `${g}化${"祿權科忌"[i]}` : null)).filter(Boolean).join("、") || "不參與生年四化";
  const combos = {}; seats.forEach(c => (combos[c.combo] ||= []).push(c));
  const pats = [...new Set(seats.flatMap(c => c.pats.filter(isA)))].map(k => short(PK[k].name));
  return page(`
    <div class="hd"><div><div class="eyebrow">十四主星 ${ORDER.indexOf(s) + 1}／14</div><h2>${s}</h2></div><div class="meta">${St.grp === 1 ? "第一系列" : "第二／三系列"}<br>${St.dou}・${St.wx}・${St.hua}</div></div>
    <p class="kw">${St.kw}</p>
    <table class="kv">
      <tr><th>生年四化</th><td>${hua}</td></tr>
      <tr><th>永久暗合夥伴</th><td>${PARTNER[s] ? `${PARTNER[s]}（十二表中恆在本星的暗合宮）` : "無"}</td></tr>
      <tr><th>坐命 ${seats.length} 格</th><td>${Object.entries(combos).map(([k, cs]) => `<span class="nw">${k}：${cs.map(c => `${label(c)} ${pg(cellPage(c))}`).join("、")}</span>`).join("<br>")}</td></tr>
      <tr><th>坐命可成之格</th><td>${pats.join("、") || "無"}</td></tr>
    </table>
    <div class="writes">
      ${lines("古籍（諸星問答論等）", "《全書》〈諸星問答論〉怎麼描述這顆星？")}
      ${lines("慧心齋主觀點", "書中這顆星的性情、系列、喜忌。出處：《談命宮》頁＿＿")}
      ${lines("我的心得", "用三個關鍵詞形容這顆星；它和哪顆星同宮時變化最大？")}
    </div>`);
});

/* ───────── 十二表 ───────── */
const patLine = (k, withQuote) => { const p = PK[k]; return `<li class="${p.cls === "B" ? "b" : ""}"><b>${p.name}</b>${p.cls === "B" ? `<span class="need">還需${p.need}</span>` : ""}<span class="cond">${p.cond}</span>${withQuote && p.quote ? `<q>${p.quote}</q>` : ""}</li>`; };

function tableIntro(t) {
  const P = TABLES[t - 1], empt = [...BR].filter((_, b) => !P[b].length), twinT = (t + 5) % 12 + 1;
  const pl = [];
  for (let m = 0; m < 12; m++) { const c = CELL[id2(t, m)]; c.pats.filter(k => isA(k) || isB(k)).forEach(k => pl.push(`<li class="${PK[k].cls === "B" ? "b" : ""}">命${BR[m]}：<b>${short(PK[k].name)}</b>${PK[k].cls === "B" ? `（待成格，還需${PK[k].need}）` : ""} ${pg(cellPage(c))}</li>`)); }
  return page(`
    <div class="hd"><div><div class="eyebrow">第 ${t} 表　${pg(tableStart(t))}–${testPage(t)}</div><h2>表${t}　紫微在${BR[t - 1]}</h2></div><div class="meta">天府在${BR[Z.mod(4 - (t - 1))]}<br>空宮：${empt.join("、") || "無"}<br>鏡像表：表${twinT} ${pg(tableStart(twinT))}</div></div>
    ${chart(t, { tags: true, center: `<div class="big">表${t}</div><div>紫微在${BR[t - 1]}</div><div class="small">宮內小字是那一格的頁碼</div>` })}
    <div class="two">
      <div><h3>本表格局</h3><ul class="pl">${pl.join("") || "<li>本表以主星判定的古籍格局不多</li>"}</ul></div>
      <div><h3>十二格</h3><ul class="cl">${Array.from({ length: 12 }, (_, m) => { const c = CELL[id2(t, m)]; return `<li>命${BR[m]}　<b>${c.stars.length ? j(c.stars) : "命無正曜"}</b> ${pg(cellPage(c))}</li>`; }).join("")}</ul></div>
    </div>
    <div class="writes">${lines("本表心得", "這張表的整體結構：空宮在哪、哪些星同宮、和鏡像表差在哪？")}</div>`);
}

function cellPageHtml(c) {
  const T = c.tri, twin = Z.twinOf(c), m = c.m;
  const A = c.pats.filter(k => PK[k].cls === "A"), B = c.pats.filter(k => PK[k].cls === "B");
  const sib = CELLS.filter(x => x.id !== c.id && x.id !== twin.id && (c.stars.length ? x.combo === c.combo : (!x.stars.length && j(x.borrow) === j(c.borrow))));
  const br = c.stars.filter(x => PARTNER[x]).map(x => x + "—" + PARTNER[x]);
  const no = (c.t - 1) * 12 + m + 1;
  return page(`
    <div class="hd"><div><div class="eyebrow">表${c.t}　紫微在${BR[c.t - 1]}　第 ${no} 格／144</div><h2>${label(c)}　<span class="h2s">${c.stars.length ? j(c.stars) : "命無正曜"}</span></h2></div>
      <div class="meta">生成碼 <span class="mono">${c.code}</span><br>鏡像格 ${label(twin)} ${pg(cellPage(twin))}</div></div>
    <div class="top">
      ${chart(c.t, { ming: m, center: `<div class="big">${label(c)}</div><div>命宮：${c.stars.length ? j(c.stars) : "無正曜，借 " + j(c.borrow)}</div>` })}
      <div class="info">
        <table class="kv">
          <tr><th>命宮 ${BR[m]}</th><td>${j(T["命"]) || "（空，借 " + j(c.borrow) + "）"}</td></tr>
          <tr><th>財帛 ${BR[(m + 8) % 12]}</th><td>${j(T["財"]) || "（空宮）"}</td></tr>
          <tr><th>事業 ${BR[(m + 4) % 12]}</th><td>${j(T["官"]) || "（空宮）"}</td></tr>
          <tr><th>遷移 ${BR[(m + 6) % 12]}</th><td>${j(T["遷"]) || "（空宮）"}</td></tr>
          <tr><th>暗合 ${BR[c.anhe]}</th><td>${PAL[((m - c.anhe) % 12 + 12) % 12]}・${j(c.anheStars) || "空宮"}${br.length ? `<br><small>永久暗合橋 ${br.join("、")}</small>` : ""}</td></tr>
        </table>
        ${A.length ? `<h3>已成格</h3><ul class="pats">${A.map(k => patLine(k, true)).join("")}</ul>` : `<h3>已成格</h3><p class="none">無</p>`}
        ${B.length ? `<h3>待成格</h3><ul class="pats">${B.map(k => patLine(k, false)).join("")}</ul>` : ""}
        ${sib.length ? `<h3>同組合</h3><p class="sib">${sib.map(x => `${label(x)} ${pg(cellPage(x))}`).join("、")}</p>` : ""}
      </div>
    </div>
    <div class="writes">
      ${lines("古籍摘記", "《紫微斗數全書》哪幾句講到這個命宮組合？抄下原文並註明篇名。")}
      ${lines("慧心齋主觀點", "用自己的話摘要，不整段照抄。出處：《慧心齋主談命宮》頁＿＿")}
      ${lines("我的心得與驗證", "和鏡像格差在哪？古訣你同意嗎？有沒有認識的人可以對照？", 1.3)}
    </div>
    <div class="status"><span>□ 研讀中</span><span>□ 已完成</span><span>日期＿＿＿＿＿＿</span><span class="r">鏡像格 ${label(twin)} ${pg(cellPage(twin))}</span></div>`);
}

function testPageHtml(t) {
  const P = TABLES[t - 1], qs = [], ans = [];
  const pick = (arr, n, seed) => arr.filter((_, i) => (i * 7 + seed) % arr.length < n);   // 固定選題，每次產生都一樣
  const singles = [...Array(12).keys()].filter(b => P[b].length);
  pick(singles, 3, t).forEach(b => { qs.push(`命宮在${BR[b]}，坐什麼主星？`); ans.push(j(P[b])); });
  const pc = CELLS.filter(c => c.t === t && c.pats.some(isA));
  if (pc.length) { const c = pc[t % pc.length], k = c.pats.find(isA); qs.push(`哪一格成「${short(PK[k].name)}」？`); ans.push(`命${BR[c.m]}`); }
  const c2 = CELL[id2(t, (t * 5) % 12)];
  qs.push(`命宮在${BR[c2.m]}時，財帛、事業、遷移各坐什麼星？`); ans.push(`財${j(c2.tri["財"]) || "空"}／事${j(c2.tri["官"]) || "空"}／遷${j(c2.tri["遷"]) || "空"}`);
  qs.push(`本表的空宮在哪幾支？天府在哪一宮？`); ans.push(`空宮${[...BR].filter((_, b) => !P[b].length).join("") || "無"}；天府在${BR[Z.mod(4 - (t - 1))]}`);
  qs.push(`本表命${BR[c2.m]}的鏡像格是哪一格？`); ans.push(label(Z.twinOf(c2)));
  return page(`
    <div class="hd"><div><div class="eyebrow">表${t}　自我測驗</div><h2>表${t}　紫微在${BR[t - 1]}　默寫與測驗</h2></div><div class="meta">先不要翻回前面<br>答案倒印在本頁下方，盤面答案在 ${pg(tableStart(t))}</div></div>
    <h3>一、把十四主星填進盤裡</h3>
    ${chart(t, { blank: true, center: `<div class="big">表${t}</div><div>紫微在${BR[t - 1]}</div><div class="small">提示：紫微系逆行（紫、機、空、陽、武、同、空空、廉），天府系順行</div>` })}
    <h3>二、問答</h3>
    <ol class="qs">${qs.map(q => `<li>${q}<div class="ans"></div></li>`).join("")}</ol>
    <div class="key">答案：${ans.map((a, i) => `${i + 1}. ${a}`).join("　")}</div>`, "test");
}

/* ───────── 格局總表（自然分頁） ───────── */
const patIndex = `<section class="flow">
  <h2 class="ph">格局總表</h2>
  <p class="note">以《紫微斗數全書》通行本為底。A＝只看主星與地支即可判定；B＝主星條件已具，還需輔星、煞星或年干；C＝純輔煞四化，十二表無法判定，請在萬用命盤產生器第 4 圖層確認。</p>
  ${["A", "B", "C"].map(cls => `<h3>${cls === "A" ? "A 主星與地支即可判定" : cls === "B" ? "B 主星條件已具，尚需輔星" : "C 純輔煞四化"}</h3>
  <table class="pidx"><thead><tr><th>格局</th><th>成立條件</th><th>古訣</th><th>出現位置</th></tr></thead><tbody>
  ${PATS.filter(p => p.cls === cls).map(p => `<tr><td class="n">${p.name}<small>${p.kind}</small></td><td>${p.cond}${p.need ? `<br><small>還需：${p.need}</small>` : ""}${p.note ? `<br><small>${p.note}</small>` : ""}</td><td>${p.quote ? `「${p.quote}」` : ""}</td><td>${p.cls === "C" ? "—" : p.occ.length > 24 ? `${p.occ.length} 格，每表皆有` : p.occ.map(id => `${label(CELL[id])} ${pg(cellPage(CELL[id]))}`).join("、")}</td></tr>`).join("")}
  </tbody></table>`).join("")}
  <h3>五永久暗合橋</h3><p>${BRIDGES.map(b => b.join("—")).join("、")}：十二表中恆互在對方暗合宮。</p>
</section>`;

/* ───────── 四化學習 ───────── */
const { HUA, STEMS, HUA_LIST, HUA_TXT, AUX } = Z;
const HC = ["hl", "hq", "hk", "hj"];
const hb = i => `<b class="hb ${HC[i]}">${HUA[i]}</b>`;
const huaShort = g => SIHUA[g].map(Z.starShort).join("");
const REL_S = { "同宮": "同宮", "三合": "三合", "對宮": "對宮", "暗合": "暗合", "暗合・鄰宮": "暗合", "鄰宮": "鄰宮", "其他": "—" };
const REL_C = { "同宮": "r0", "三合": "r1", "對宮": "r2", "暗合": "r3", "暗合・鄰宮": "r3", "鄰宮": "r4" };
const relSum = rels => { const c = {}; rels.forEach(r => { const k = REL_S[r]; c[k] = (c[k] || 0) + 1; }); const ks = Object.keys(c); return ks.length === 1 ? `十二表恆為${ks[0] === "—" ? "其他" : ks[0]}` : ks.map(k => (k === "—" ? "其他" : k) + c[k]).join("・"); };
const stemLine = g => { const L = Z.LUCUN[g], K = Z.KUIYUE[g]; return `祿存${BR[L]}・擎羊${BR[(L + 1) % 12]}・陀羅${BR[(L + 11) % 12]}・天魁${BR[K[0]]}・天鉞${BR[K[1]]}`; };

const huaIntro = page(`
  <div class="hd"><div><div class="eyebrow">四化學習　${pg(P_HUA)}–${P_DIARY - 1}</div><h2>十干四化</h2></div><div class="meta">四化日記 ${pg(P_DIARY)}<br>格局總表 ${pg(P_PATS)}</div></div>
  <table class="hz"><thead><tr><th>天干</th>${[0, 1, 2, 3].map(i => `<th>${hb(i)} 化${HUA[i]}</th>`).join("")}<th>縮寫</th><th>頁</th></tr></thead>
  <tbody>${STEMS.map(g => `<tr><th>${g}</th>${SIHUA[g].map(s => `<td>${s}</td>`).join("")}<td class="ab">${huaShort(g)}</td><td>${pg(huaStemPage(g))}</td></tr>`).join("")}</tbody></table>
  <p class="note">四化表依萬用命盤產生器所用之表（戊：右弼化科；庚：陽武同陰；壬：左輔化科），各派略有出入。縮寫中太陽為「陽」、太陰為「陰」。</p>
  <div class="prose">
  <h3>怎麼背</h3>
  <p>先橫著唸：甲廉破武陽、乙機梁紫陰、丙同機昌廉、丁陰同機巨、戊貪陰右機、己武貪梁曲、庚陽武同陰、辛巨陽曲昌、壬梁紫左武、癸破巨陰貪。再直著背化忌：陽陰廉巨機曲陰昌武貪。</p>
  <h3>為什麼有些關係十二表都一樣</h3>
  <p>紫微星系（紫微、天機、太陽、武曲、天同、廉貞）和天府星系（天府、太陰、貪狼、巨門、天相、天梁、七殺、破軍）各自整組移動。同一星系的兩星<b>距離</b>固定，所以同宮、三合、對宮十二表都一樣；不同星系的兩星位置<b>和</b>固定，所以暗合要嘛十二表都成立、要嘛都不成立。每干一頁的「十二表通觀」就是這個規律的實例。</p>
  <h3>輔星</h3>
  <p>左輔、右弼、文昌、文曲不隨表號移動，位置由出生月、時辰決定，見 ${pg(P_HUA_AUX)}。成對的兩星以丑未為軸對稱，只有在丑、未同宮。</p>
  <h3>三層內容</h3>
  <p>每一化先看「通行說法」（入門提要），再讀《紫微四化星》用自己的話寫要點並註頁碼，最後寫自己的觀察；日常的驗證寫進四化日記。</p>
  </div>`);

const huaStemPages = STEMS.map(g => {
  const pairs = Z.huaPairs(g), star = i => SIHUA[g][i];
  const items = SIHUA[g].map((s, i) => {
    const name = s + "化" + HUA[i], others = HUA_LIST.filter(h => h.star === s && h.g !== g).map(h => `${h.g}化${HUA[h.i]}`).join("、");
    return `<div class="hi"><div class="hn">${hb(i)}<b>${name}</b><span>${STARS[s] ? STARS[s].kw.split("。")[0] : `輔星，與${AUX[s]}成對`}</span></div><p>${HUA_TXT[name]}</p><small>${s}其他四化：${others || "無"}</small></div>`;
  }).join("");
  const mx = `<table class="hm"><thead><tr><th>兩化</th>${TABLES.map((_, k) => `<th>表${k + 1}</th>`).join("")}<th>合計</th></tr></thead><tbody>
    ${pairs.map(x => `<tr><th>${hb(x.i)}${hb(x.j)} ${Z.starShort(star(x.i))}—${Z.starShort(star(x.j))}</th>${x.rels ? x.rels.map(r => `<td class="${REL_C[r] || ""}">${REL_S[r]}</td>`).join("") + `<td class="sum">${relSum(x.rels)}</td>` : `<td colspan="13" class="na">輔星不隨表號移動，看自己的輔星位置</td>`}</tr>`).join("")}
  </tbody></table>`;
  return page(`
    <div class="hd"><div><div class="eyebrow">四化學習　十干 ${STEMS.indexOf(g) + 1}／10</div><h2>${g}干四化　<span class="h2s">${huaShort(g)}</span></h2></div><div class="meta">隨${g}干：${stemLine(g)}<br>${g}日日記範本 ${pg(diaryPage(g))}</div></div>
    <div class="his">${items}</div>
    <h3>十二表通觀：四化兩兩之間</h3>${mx}
    <div class="writes">
      ${lines("《紫微四化星》要點", "用自己的話寫，註明頁碼，不整段照抄。出處：頁＿＿")}
      ${lines("我的星性筆記", `${g}干四化合在一起是什麼樣的氣質？哪一化你最有感？`)}
    </div>`, "hua");
});

const huaAux = page(`
  <div class="hd"><div><div class="eyebrow">四化學習　輔星安星對照</div><h2>輔星・煞星・祿存</h2></div><div class="meta">與四化相關的星<br>火星、鈴星需年支與男女，此處不列</div></div>
  <div class="three">
    <div><h3>隨天干</h3><table class="ax"><thead><tr><th>干</th><th>祿存</th><th>擎羊</th><th>陀羅</th><th>天魁</th><th>天鉞</th></tr></thead>
      <tbody>${STEMS.map(g => { const L = Z.LUCUN[g], K = Z.KUIYUE[g]; return `<tr><th>${g}</th><td>${BR[L]}</td><td>${BR[(L + 1) % 12]}</td><td>${BR[(L + 11) % 12]}</td><td>${BR[K[0]]}</td><td>${BR[K[1]]}</td></tr>`; }).join("")}</tbody></table>
      <p class="note">擎羊在祿存前一宮、陀羅在後一宮，永遠夾著祿存。魁鉞：甲戊庚牛羊，乙己鼠猴鄉，丙丁豬雞位，壬癸兔蛇藏，六辛逢馬虎。</p></div>
    <div><h3>隨時辰</h3><table class="ax"><thead><tr><th>時</th><th>文昌</th><th>文曲</th><th>地劫</th><th>地空</th></tr></thead>
      <tbody>${[...BR].map((b, h) => `<tr><th>${b}</th>${["文昌", "文曲", "地劫", "地空"].map(s => `<td>${BR[Z.HOUR_AT[s](h)]}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p class="note">文昌戌起子時逆行、文曲辰起子時順行；地劫亥起子時順行、地空亥起子時逆行。昌曲與空劫同一時辰，知道一組就知道另一組。</p></div>
    <div><h3>隨生月</h3><table class="ax"><thead><tr><th>月</th><th>左輔</th><th>右弼</th></tr></thead>
      <tbody>${Array.from({ length: 12 }, (_, m) => `<tr><th>${m + 1}</th><td>${BR[(4 + m) % 12]}</td><td>${BR[Z.mod(10 - m)]}</td></tr>`).join("")}</tbody></table>
      <p class="note">左輔辰起正月順行、右弼戌起正月逆行。</p></div>
  </div>
  <div class="prose"><h3>對稱</h3><p>左輔與右弼、文昌與文曲的位置和恆為 2（子=0），以丑未為軸對稱，只有在丑、未同宮；地空與地劫的位置和恆為 10，以巳亥為軸對稱，只有在巳、亥同宮。知道一顆，就知道另一顆。</p></div>
  <div class="writes">${lines("練習", "選一個天干、一個時辰，把四化和這些星排進自己畫的盤，看四化被誰夾、和誰同宮、三方四正會到誰。")}</div>`);

const diaryGuide = page(`
  <div class="hd"><div><div class="eyebrow">四化日記　${pg(P_DIARY)}–${P_PATS - 1}</div><h2>四化日記怎麼寫</h2></div><div class="meta">十個範本：甲日 ${pg(diaryPage("甲"))} …… 癸日 ${pg(diaryPage("癸"))}</div></div>
  <div class="prose">
  <h3>每天一頁</h3>
  <ol>
    <li>查萬年曆，找出今天的日干（例如「甲子日」就是甲日）。</li>
    <li>翻到那一干的範本頁，影印或照著格式寫在筆記本上。範本已經印好當天的四化與提示。</li>
    <li><b>今日事件</b>：只記事實，發生了什麼、和誰、在哪裡。</li>
    <li><b>對應四化</b>：把事件對到祿權科忌。對不上就寫「對不上」，不要硬套。</li>
    <li><b>心得</b>：這一化在你身上通常怎麼表現？和書上說的一樣嗎？</li>
  </ol>
  <h3>提示</h3>
  <ul>
    <li>忙到沒寫，隔天補也可以，日期寫清楚就好。線上研習頁的「四化日記」可以選日期補寫，同一天不會重複建立。</li>
    <li>寫滿一輪十天後，回頭比較同一干的兩篇：同樣的四化，事件有沒有相似之處？</li>
    <li>你的盤就是你的日記：不必先排盤，先記一個月，再對照自己的命盤看看哪些宮位常應驗。</li>
  </ul>
  <h3>四化的觀察方向</h3>
  <table class="kv">
    <tr><th>${hb(0)} 化祿</th><td>今天哪裡順、得到什麼好處、人緣或享受？</td></tr>
    <tr><th>${hb(1)} 化權</th><td>今天哪裡在主導、爭取、掌控，或和人較勁？</td></tr>
    <tr><th>${hb(2)} 化科</th><td>今天哪裡得到肯定、貴人相助，或事情被化解？</td></tr>
    <tr><th>${hb(3)} 化忌</th><td>今天哪裡卡住、在意、放不下，或付出沒有回報？</td></tr>
  </table>
  </div>
  <div class="writes">${lines("我的日記規則", "例如：每晚睡前寫十分鐘、只寫一件事、週日回顧。")}</div>`);

const ASK = ["哪裡順、得到好處？", "哪裡在主導、爭取？", "哪裡得到肯定、化解？", "哪裡卡住、放不下？"];
const diaryPages = STEMS.map(g => page(`
  <div class="hd"><div><div class="eyebrow">四化日記範本　${STEMS.indexOf(g) + 1}／10　可影印重複使用</div><h2>${g}日　<span class="h2s">${huaShort(g)}</span></h2></div>
    <div class="meta dmeta">日期　＿＿＿＿年＿＿月＿＿日<br>干支　${g}＿日　　星性 ${pg(huaStemPage(g))}</div></div>
  <table class="dh"><tbody>${SIHUA[g].map((s, i) => `<tr><th>${hb(i)} ${s}化${HUA[i]}</th><td>${HUA_TXT[s + "化" + HUA[i]]}</td><td class="ask">今天${ASK[i]}</td></tr>`).join("")}</tbody></table>
  <div class="writes">
    ${lines("今日事件", "只記事實：發生了什麼、和誰、在哪裡。", 1.2)}
    <div class="write dmap" style="flex-grow:1.1"><div class="wh"><b>對應四化</b><span>把事件對到祿權科忌，對不上就寫「對不上」。</span></div>
      ${SIHUA[g].map((s, i) => `<div class="dl">${hb(i)}<span>${Z.starShort(s)}</span><i></i></div>`).join("")}</div>
    ${lines("心得", `${g}日的四化在我身上怎麼表現？和書上說的一樣嗎？`)}
  </div>`, "diary"));

/* ───────── 樣式 ───────── */
const CSS = `
@page{size:A4;margin:0 0 9mm 0}
*{box-sizing:border-box}
:root{--ink:#1b2330;--ink2:#5a6474;--rule:#c9d0d0;--cin:#b23a2a;--cins:#f6e3de;--gold:#8a6a1f;--golds:#f3ecd9;--line:#b9c2c4}
body{margin:0;font:10pt/1.55 "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3,.big,.pal .st,.ph{font-family:"Songti TC","Noto Serif TC","PMingLiU",serif}
.page{width:210mm;height:288mm;padding:12mm 14mm 4mm;display:flex;flex-direction:column;overflow:hidden;page-break-after:always;break-after:page}
.flow{padding:12mm 14mm 4mm}
.eyebrow{font-size:8.5pt;letter-spacing:.14em;color:var(--ink2)}
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:10mm;border-bottom:1.5pt solid var(--ink);padding-bottom:2mm;margin-bottom:4mm}
.hd h2{font-size:20pt;font-weight:900;margin:0;line-height:1.25}
.h2s{font-size:15pt;font-weight:700}
.meta{font-size:8.5pt;color:var(--ink2);text-align:right;line-height:1.5}
.mono{font-family:"IBM Plex Mono",Menlo,monospace;color:var(--ink)}
.pg{font-size:.85em;color:var(--cin);white-space:nowrap}
.ph{font-size:20pt;font-weight:900;border-bottom:1.5pt solid var(--ink);padding-bottom:2mm;margin:0 0 4mm}
h3{font-size:10pt;letter-spacing:.1em;color:var(--ink2);font-weight:500;margin:3mm 0 1.5mm}
.note{font-size:9pt;color:var(--ink2);margin:0 0 3mm}
/* 盤 */
.chart{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);border:1.2pt solid var(--ink)}
.pal{border:.5pt solid var(--rule);padding:1.2mm 1.5mm 4.5mm;position:relative;min-width:0}
.pal .st{display:flex;flex-wrap:wrap;gap:0 1.5mm;font-weight:700;font-size:10.5pt;line-height:1.3}
.pal .st i{font-style:normal;font-weight:500;color:var(--ink2);font-size:7.2pt;white-space:nowrap;letter-spacing:-.02em}
.pal .tg{display:flex;flex-wrap:wrap;gap:.6mm;margin-top:.8mm}
.pal .tg u{text-decoration:none;font-size:7pt;border:.5pt solid var(--cin);color:var(--cin);padding:0 .8mm;border-radius:.6mm}
.pal .tg u.b{border-style:dashed;border-color:var(--gold);color:var(--gold)}
.pal .pn{position:absolute;left:1.5mm;bottom:.6mm;font-size:7.5pt;color:var(--ink2)}
.pal .br{position:absolute;right:1.5mm;bottom:.4mm;font-family:"Songti TC","Noto Serif TC",serif;font-size:9pt;color:var(--ink2)}
.pal.ming{background:var(--cins)} .pal.ming .pn{color:var(--cin);font-weight:700}
.pal.tri{background:var(--golds)} .pal.tri .pn{color:var(--gold);font-weight:700}
.cc{grid-column:2/4;grid-row:2/4;border:.5pt solid var(--rule);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:2mm;font-size:8.5pt;color:var(--ink2)}
.cc .big{font-size:15pt;font-weight:900;color:var(--ink)}
.cc .small{font-size:7.5pt;margin-top:1mm}
/* 格頁 */
.top{display:grid;grid-template-columns:96mm 1fr;gap:5mm;margin-bottom:3mm}
.top .chart{height:84mm}
.top .pal .st{font-size:9.5pt}
.info{font-size:8.5pt;min-width:0}
.info h3{margin:2mm 0 1mm;font-size:8.5pt}
table.kv{border-collapse:collapse;width:100%}
table.kv th{text-align:left;font-weight:500;color:var(--ink2);white-space:nowrap;padding:.4mm 2mm .4mm 0;vertical-align:top;font-size:8.5pt}
table.kv td{padding:.4mm 0;font-family:"Songti TC","Noto Serif TC",serif;font-weight:700;font-size:9pt}
table.kv td small{font-family:"PingFang TC","Noto Sans TC",sans-serif;font-weight:400;color:var(--ink2)}
ul.pats{list-style:none;margin:0;padding:0}
ul.pats li{border-left:1.2pt solid var(--cin);padding:0 0 0 2mm;margin:0 0 1.2mm;line-height:1.4}
ul.pats li.b{border-left:1.2pt dashed var(--gold)}
ul.pats b{font-family:"Songti TC","Noto Serif TC",serif;font-size:9.5pt;margin-right:1.5mm}
ul.pats .cond{display:block;font-size:7.8pt}
ul.pats .need{font-size:7.8pt;color:var(--gold)}
ul.pats q{display:block;font-family:"Songti TC","Noto Serif TC",serif;color:var(--cin);quotes:"「" "」";font-size:8.5pt}
.none,.sib{margin:0;font-size:8.5pt}
.writes{flex:1;display:flex;flex-direction:column;gap:2.5mm;min-height:0}
.write{flex:1 1 0;display:flex;flex-direction:column;border:.6pt solid var(--rule);border-radius:1mm;padding:1.5mm 3mm 0;min-height:0}
.wh{display:flex;gap:3mm;align-items:baseline;flex-wrap:wrap}
.wh b{font-family:"Songti TC","Noto Serif TC",serif;font-size:10.5pt}
.wh span{font-size:7.8pt;color:var(--ink2)}
.ln{flex:1;background:repeating-linear-gradient(to bottom,transparent 0,transparent 7.7mm,var(--line) 7.7mm,var(--line) 8mm);margin-top:1mm}
.status{display:flex;gap:6mm;font-size:9pt;margin-top:2mm;color:var(--ink2)}
.status .r{margin-left:auto}
/* 表首頁 */
.page > .chart{height:118mm;margin-bottom:3mm}
.two{display:grid;grid-template-columns:1.3fr 1fr;gap:6mm;font-size:8.8pt}
.two ul{margin:0;padding-left:4mm}
.two li{margin:.3mm 0}
.two li.b{color:var(--gold)}
.two h3{margin-top:0}
.page .writes:last-child{margin-top:3mm}
/* 測驗頁 */
.test > .chart{height:105mm}
ol.qs{margin:0;padding-left:5mm;font-size:9.5pt;flex:1}
ol.qs li{margin-bottom:1mm}
ol.qs .ans{height:9mm;border-bottom:.5pt solid var(--line)}
.key{transform:rotate(180deg);font-size:8pt;color:var(--ink2);border-top:.5pt dashed var(--rule);padding-top:2mm;margin-top:2mm}
/* 主星 */
.kw{font-size:11pt;margin:0 0 3mm}
.nw{display:inline-block}
.page > table.kv{margin-bottom:3mm}
.page > table.kv th{width:28mm}
/* 封面 */
.cv{justify-content:center}
.cover{border:2pt solid var(--ink);padding:24mm 18mm;height:100%;display:flex;flex-direction:column;justify-content:center}
.cover h1{font-size:40pt;font-weight:900;line-height:1.25;margin:4mm 0 6mm;letter-spacing:.06em}
.cover .sub{font-size:11pt;color:var(--ink2);margin:0 0 30mm}
.cover .me div{font-size:12pt;display:flex;gap:4mm;align-items:flex-end;margin:7mm 0}
.cover .me span{flex:1;max-width:90mm;border-bottom:.8pt solid var(--ink)}
.cover .foot{margin-top:auto;font-size:8.5pt;color:var(--ink2)}
/* 說明 */
.prose{font-size:10pt;max-width:170mm}
.prose h3{font-size:11pt;color:var(--ink);font-weight:700;letter-spacing:.04em;margin:4mm 0 1.5mm;font-family:"Songti TC","Noto Serif TC",serif}
.prose ul,.prose ol{margin:0;padding-left:5mm}
.prose li{margin:.6mm 0}
.prose p{margin:0 0 2mm}
.legend{display:flex;flex-wrap:wrap;gap:5mm;font-size:9pt;margin-bottom:2mm}
.legend i{display:inline-block;width:3.5mm;height:3.5mm;vertical-align:-.6mm;margin-right:1mm;border:.5pt solid var(--rule)}
.legend .lm{background:var(--cins)} .legend .lt{background:var(--golds)}
.legend u{text-decoration:none;font-size:7.5pt;border:.5pt solid var(--cin);color:var(--cin);padding:0 .8mm;margin-right:1mm}
.legend u.b{border-style:dashed;border-color:var(--gold);color:var(--gold)}
/* 進度表 */
table.prog{border-collapse:collapse;width:100%;table-layout:fixed}
table.prog th,table.prog td{border:.6pt solid var(--rule);text-align:center;padding:0}
table.prog thead th{font-family:"Songti TC","Noto Serif TC",serif;font-size:9pt;padding:1.2mm 0}
table.prog tbody th{font-size:8.5pt;width:14mm;font-weight:700}
table.prog tbody th small{display:block;font-weight:400;color:var(--ink2);font-size:7pt}
table.prog td{height:17.5mm;vertical-align:middle}
table.prog td b{display:block;font-family:"Songti TC","Noto Serif TC",serif;font-size:9pt}
table.prog td small{font-size:6.5pt;color:var(--ink2)}
.tally{display:flex;gap:10mm;margin-top:5mm;font-size:10pt}
.tally div{display:flex;gap:2mm;align-items:flex-end}
.tally span{display:inline-block;width:22mm;border-bottom:.6pt solid var(--ink)}
/* 四化 */
.hb{display:inline-block;font-style:normal;font-family:"PingFang TC","Noto Sans TC",sans-serif;font-size:7pt;font-weight:700;color:#fff;padding:0 .9mm;border-radius:.6mm;margin-right:.8mm;vertical-align:.3mm}
.hb.hl{background:#2f6f5a}.hb.hq{background:#8a6a1f}.hb.hk{background:#2c4a86}.hb.hj{background:#b23a2a}
table.hz{border-collapse:collapse;width:100%;margin-bottom:2mm}
table.hz th,table.hz td{border:.6pt solid var(--rule);padding:1.6mm 2mm;text-align:center}
table.hz td{font-family:"Songti TC","Noto Serif TC",serif;font-weight:700;font-size:11pt}
table.hz tbody th{font-family:"Songti TC","Noto Serif TC",serif;font-size:12pt}
table.hz thead th{font-weight:500;font-size:9pt;color:var(--ink2)}
table.hz td.ab{color:var(--cin);letter-spacing:.08em}
.his{display:grid;grid-template-columns:1fr 1fr;gap:2mm 5mm;margin-bottom:1mm}
.hi{border-left:1.2pt solid var(--rule);padding-left:2.5mm}
.hn{display:flex;align-items:baseline;gap:1mm;flex-wrap:wrap}
.hn b{font-family:"Songti TC","Noto Serif TC",serif;font-size:11pt}
.hn span{font-size:7.5pt;color:var(--ink2);margin-left:1mm}
.hi p{margin:.6mm 0 .3mm;font-size:9pt;line-height:1.45}
.hi small{font-size:7.5pt;color:var(--ink2)}
table.hm{border-collapse:collapse;width:100%;font-size:7.5pt;margin-bottom:3mm;table-layout:fixed}
table.hm th,table.hm td{border:.5pt solid var(--rule);padding:.8mm .3mm;text-align:center}
table.hm thead th{font-weight:500;color:var(--ink2)}
table.hm tbody th{width:22mm;text-align:left;padding-left:1mm;font-family:"Songti TC","Noto Serif TC",serif;white-space:nowrap}
table.hm td.sum{width:30mm;font-size:7pt;text-align:left;padding-left:1mm}
table.hm td.na{color:var(--ink2)}
table.hm thead th:last-child{width:30mm}
table.hm .r0{background:#f6e3de}.hm .r1{background:#dcece5}.hm .r2{background:#dfe6f3}.hm .r3{background:#f3ecd9}.hm .r4{color:var(--ink2)}
.three{display:grid;grid-template-columns:1.25fr 1fr .8fr;gap:5mm}
.three h3{margin-top:0}
table.ax{border-collapse:collapse;width:100%;font-size:9pt}
table.ax th,table.ax td{border:.5pt solid var(--rule);padding:.9mm 1mm;text-align:center}
table.ax td{font-family:"Songti TC","Noto Serif TC",serif;font-weight:700}
table.ax thead th{font-weight:500;color:var(--ink2);font-size:8pt}
.three .note{margin-top:1.5mm;font-size:8pt}
.dmeta{font-size:10pt;color:var(--ink);line-height:1.9}
table.dh{border-collapse:collapse;width:100%;margin-bottom:3mm;font-size:8.5pt}
table.dh th{text-align:left;white-space:nowrap;font-family:"Songti TC","Noto Serif TC",serif;font-size:10pt;padding:1mm 3mm 1mm 0;border-bottom:.5pt solid var(--rule)}
table.dh td{padding:1mm 2mm 1mm 0;border-bottom:.5pt solid var(--rule);vertical-align:middle}
table.dh td.ask{color:var(--cin);white-space:nowrap;font-family:"Songti TC","Noto Serif TC",serif;font-weight:700}
.dmap{padding-bottom:1mm}
.dl{flex:1;display:flex;align-items:flex-end;gap:1.5mm;border-bottom:.5pt solid var(--line);padding-bottom:.6mm;font-family:"Songti TC","Noto Serif TC",serif;font-weight:700;font-size:10pt}
.dl span{width:6mm}
/* 格局總表 */
table.pidx{border-collapse:collapse;width:100%;font-size:8pt;margin-bottom:3mm}
table.pidx th,table.pidx td{border-bottom:.5pt solid var(--rule);padding:1.2mm 1.5mm;vertical-align:top;text-align:left}
table.pidx thead th{color:var(--ink2);font-weight:500;font-size:7.5pt}
table.pidx tr{break-inside:avoid}
table.pidx td.n{font-family:"Songti TC","Noto Serif TC",serif;font-weight:700;font-size:9pt;width:30mm}
table.pidx td.n small{display:block;font-family:"PingFang TC","Noto Sans TC",sans-serif;font-weight:400;color:var(--ink2);font-size:7pt}
table.pidx small{color:var(--ink2)}
table.pidx td:nth-child(3){width:34mm;font-family:"Songti TC","Noto Serif TC",serif;color:var(--cin)}
table.pidx td:nth-child(4){width:46mm}
`;

const pages = [cover, guide, progress, ...starPages];
for (let t = 1; t <= 12; t++) { pages.push(tableIntro(t)); for (let m = 0; m < 12; m++) pages.push(cellPageHtml(CELL[id2(t, m)])); pages.push(testPageHtml(t)); }
if (pages.length + 1 !== P_HUA) throw new Error("四化章頁碼不符");
pages.push(huaIntro, ...huaStemPages, huaAux, diaryGuide, ...diaryPages);
if (pages.length + 1 !== P_PATS) throw new Error("格局總表頁碼不符");
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>紫微一百四十四格練習簿</title>
<style>${CSS}</style></head><body>${pages.join("\n")}${patIndex}</body></html>`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "workbook.html"), html);

const { default: puppeteer } = await import("puppeteer-core");
const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
const p = await b.newPage();
await p.goto("file://" + path.join(OUT, "workbook.html"), { waitUntil: "networkidle0", timeout: 120000 });
await p.evaluate(() => document.fonts.ready);
const over = await p.evaluate(() => [...document.querySelectorAll(".page")].map((el, i) => el.scrollHeight > el.clientHeight + 1 || [...el.querySelectorAll(".info,.pal,.write")].some(x => x.scrollHeight > x.clientHeight + 1) ? i + 1 : 0).filter(Boolean));
if (over.length) console.warn("版面溢出的頁：", over.join(", "));
await p.pdf({ path: PDF, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font-size:7pt;color:#8a929e;padding:0 14mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>紫微一百四十四格練習簿</span><span class="pageNumber"></span></div>` });
await b.close();
fs.copyFileSync(PDF, path.join(ROOT, ".workbook.pdf"));
console.log(`練習簿 ${pages.length} 頁固定版面＋格局總表 → ${path.relative(ROOT, PDF)}（${(fs.statSync(PDF).size / 1048576).toFixed(1)} MB），預期格局總表從 p.${P_PATS} 開始`);
