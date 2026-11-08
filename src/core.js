/* 紫微研習核心：十二表主星、格局判定、筆記範本、段落合併、zip。
   不碰 DOM，瀏覽器與 Node（建置腳本）共用。由 gen2.py／gen_notes.py 移植。 */
(function (root) {
"use strict";
const BR = "子丑寅卯辰巳午未申酉戌亥";
const PAL = ["命宮","兄弟","夫妻","子女","財帛","疾厄","遷移","交友","事業","田宅","福德","父母"];
const ORDER = ["紫微","天機","太陽","武曲","天同","廉貞","天府","太陰","貪狼","巨門","天相","天梁","七殺","破軍"];
const SHORT = Object.fromEntries(ORDER.map((s, i) => [s, "紫機日武同廉府月貪巨相梁殺破"[i]]));
const SUN_DOWN = new Set([8,10,11,0,1]), MOON_DOWN = new Set([3,5,6]);   // 太陽／太陰落陷地支
const mod = (a, n = 12) => ((a % n) + n) % n;
const pad = n => String(n).padStart(2, "0");

function major(t) {
  const z = (t - 1) % 12, p = Array.from({ length: 12 }, () => []);
  for (const [s, o] of [["紫微",0],["天機",-1],["太陽",-3],["武曲",-4],["天同",-5],["廉貞",-8]]) p[mod(z + o)].push(s);
  const f = mod(4 - z);
  for (const [s, o] of [["天府",0],["太陰",1],["貪狼",2],["巨門",3],["天相",4],["天梁",5],["七殺",6],["破軍",10]]) p[mod(f + o)].push(s);
  for (const x of p) x.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return p;
}
const TABLES = Array.from({ length: 12 }, (_, i) => major(i + 1));

// 永久暗合橋：十二表中位置和恆 ≡ 1（地支六合）
const BRIDGES = (() => {
  const pos = TABLES.map(T => { const o = {}; T.forEach((a, b) => a.forEach(s => o[s] = b)); return o; });
  const out = [];
  ORDER.forEach((a, i) => ORDER.slice(i + 1).forEach(b => { if (pos.every(p => mod(p[a] + p[b]) === 1)) out.push([a, b]); }));
  return out;
})();

class Ctx {
  constructor(P, m) { this.P = P; this.m = m; }
  at(k) { return this.P[mod(this.m + k)]; }                 // 相對命宮位移 k（順時針支序）
  has(b, ...st) { return st.every(x => this.P[mod(b)].includes(x)); }
  ming(...st) { return this.has(this.m, ...st); }
  only(...st) { return [...this.P[this.m]].sort().join() === [...st].sort().join(); }   // 命宮恰為這些主星
  get empty() { return !this.P[this.m].length; }
  get sf() { return [...this.P[this.m], ...this.at(4), ...this.at(8), ...this.at(6)]; }   // 三方四正
  get cai() { return this.at(8); }    // 財帛 = 命-4
  get guan() { return this.at(4); }   // 事業 = 命-8
  get qian() { return this.at(6); }
  jia(a, b) { const L = this.P[mod(this.m - 1)], R = this.P[mod(this.m + 1)]; return (L.includes(a) && R.includes(b)) || (L.includes(b) && R.includes(a)); }
}
const inn = (m, ...a) => a.includes(m);

// A = 主星與地支即可判定；B = 主星條件已具，尚需輔星／煞星／年干；C = 純輔煞四化，與主星表無關
const DEFS = [
 ["zifutonggong","紫府同宮","A","富貴","紫微、天府同守命，只在寅申","紫府同宮，終身福厚","","","", c => c.ming("紫微","天府")],
 ["zifuchaoyuan","紫府朝垣","A","富貴","紫微、天府分居三方照命。四式：武相寅申；廉貞寅申；廉相子午；天相丑未而對宮紫微","紫府朝垣，食祿萬鍾","","","", c => {
   const m = c.m, S = [...c.at(4), ...c.at(8), ...c.at(6)];
   if (!(S.includes("紫微") || S.includes("天府"))) return false;
   return (inn(m,2,8) && c.only("武曲","天相")) || (inn(m,2,8) && c.only("廉貞")) || (inn(m,0,6) && c.only("廉貞","天相")) || (inn(m,1,7) && c.only("天相") && c.qian.includes("紫微")); }],
 ["fuxiangchaoyuan","府相朝垣","A","富貴","天府、天相分居財帛、事業照命。三式：命無正曜（丑未卯酉）；天府坐命於丑卯巳未酉亥；廉貞坐寅申","府相朝垣，千鍾食祿","通行解釋寬嚴不一，嚴格說法要求命無正曜","","", c => {
   const S = [...c.cai, ...c.guan], m = c.m, both = S.includes("天府") && S.includes("天相");
   if (c.empty && inn(m,1,7,3,9)) return both;
   if (c.only("天府") && inn(m,1,3,5,7,9,11)) return S.includes("天相");
   if (c.only("廉貞") && inn(m,2,8)) return both;
   return false; }],
 ["jiyuetongliang","機月同梁","A","富貴","命在寅申，天機、太陰、天同、天梁全入三方四正","機月同梁作吏人","寅申最喜同梁會；見煞則為一般公職、幕僚之格","","", c => inn(c.m,2,8) && ["天機","太陰","天同","天梁"].every(x => c.sf.includes(x))],
 ["tanhua","探花格（俗稱）","A","富貴","天機、太陰同守命於寅申，左右兩鄰為紫微、天府","","機月同梁之一式，兼紫府夾命；《全書》未見此名，屬後世通稱，出處待查","機陰寅申","", c => inn(c.m,2,8) && c.ming("天機","太陰")],
 ["jiliang","機梁加會（善蔭朝綱）","A","富貴","天機、天梁同守命於辰戌","機梁會合善談兵","吉少見煞者偏向宗教、哲學","善蔭朝綱","", c => c.ming("天機","天梁")],
 ["jutong","巨日同宮","A","富貴","巨門、太陽同守命於寅申，寅宮為上","巨日同宮，官封三代","","","", c => c.ming("巨門","太陽")],
 ["jincan","金燦光輝（日麗中天）","A","富貴","太陽獨守命於午","太陽居午，謂之日麗中天","庚辛年生最佳","日麗中天","", c => c.m === 6 && c.ming("太陽")],
 ["rizhao","日照雷門（日出扶桑）","A","富貴","太陽、天梁同守命於卯；酉宮為日落西山，不入格","日照雷門，富貴榮華","宜白天生人","日出扶桑","", c => c.m === 3 && c.ming("太陽","天梁")],
 ["mingzhu","明珠出海","A","富貴","命在未無正曜，卯宮太陽天梁、亥宮太陰三合照命，對宮同巨","日卯月亥，安命未，蟾宮折桂之榮","","","", c => c.m === 7 && c.empty && c.has(3,"太陽") && c.has(11,"太陰")],
 ["yuelang","月朗天門（月落亥宮）","A","富貴","太陰獨守命於亥","月朗天門，晉爵封侯","宜夜生人","月落亥宮","", c => c.m === 11 && c.ming("太陰")],
 ["riyuebingming","日月並明","A","富貴","二式：命丑天梁，巳宮太陽、酉宮太陰照命；命午無正曜，寅宮巨日、子宮同陰照命","日月並明，佐九重於堯殿","","","", c => (c.m === 1 && c.ming("天梁") && c.has(5,"太陽") && c.has(9,"太陰")) || (c.m === 6 && c.empty && c.has(2,"太陽") && c.has(0,"太陰"))],
 ["danchi","丹墀桂墀","A","富貴","命宮三方四正見太陽於辰巳、太陰於酉戌，二星皆旺","丹墀桂墀，早遂青雲之志","會照範圍各家說法不一，此處取三方四正","","", c => {
   const s = [c.m, mod(c.m+4), mod(c.m+8), mod(c.m+6)];
   return s.some(b => c.has(b,"太陽") && inn(b,4,5)) && s.some(b => c.has(b,"太陰") && inn(b,9,10)); }],
 ["yuesheng","月生滄海（水澄桂萼）","A","富貴","天同、太陰同守命於子","太陰居子，丙丁生人，富貴忠良","《全書》另有同陰子宮守田宅之說","水澄桂萼","", c => c.m === 0 && c.ming("天同","太陰")],
 ["erjie","二曜同臨","A","富貴","命丑而日月在未，或命未而日月在丑（命無正曜，借日月）","日月科祿丑未中，定是方伯公","","","", c => c.empty && inn(c.m,1,7) && c.has(c.m+6,"太陽","太陰")],
 ["shouxing","壽星入廟","A","富貴","天梁守命於午","","丁年生為上格","","", c => c.m === 6 && c.ming("天梁")],
 ["yingxing","英星入廟","A","富貴","破軍守命於子午","子午破軍，加官進爵","甲癸年生為上格","","", c => inn(c.m,0,6) && c.ming("破軍")],
 ["shizhong","石中隱玉","A","富貴","巨門守命於子午","子午巨門，石中隱玉","辛癸年生入格","","", c => inn(c.m,0,6) && c.ming("巨門")],
 ["qisha","七殺朝斗／仰斗","A","富貴","七殺守命於寅申子午；申午為朝斗，寅子為仰斗","七殺朝斗，爵祿榮昌","","","", c => inn(c.m,0,2,6,8) && c.ming("七殺")],
 ["jijutonglin","巨機同臨","A","富貴","巨門、天機同守命於卯；酉宮不入此格","巨機居卯，乙辛己丙至公卿","","","", c => c.m === 3 && c.ming("巨門","天機")],
 ["wutan","貪武同行","A","富貴","武曲、貪狼同守命於丑未","貪武同行，威鎮邊夷","多三十歲後發達，俗稱「武貪不發少年人」","","", c => c.ming("武曲","貪狼")],
 ["zifujia","紫府夾命","A","富貴","命在寅申，紫微、天府分居兩鄰","夾月夾日誰能遇","貴星夾命之一式；寅申宮或為機陰（探花格）或為空宮","","", c => inn(c.m,2,8) && c.jia("紫微","天府")],
 ["riyuejia","日月夾命","A","富貴","命在丑未，太陽、太陰分居兩鄰","夾月夾日誰能遇","貴星夾命之一式；命宮須廟旺有吉","","", c => inn(c.m,1,7) && c.jia("太陽","太陰")],
 ["xiongsu","雄宿朝垣（權星朝垣）","A","富貴","廉貞獨守命於寅申，無煞","","古本有「未申」之說，未宮為廉殺同宮，各家爭議；此處取寅申","權星朝垣","", c => inn(c.m,2,8) && c.only("廉貞")],
 ["jixiang","極向離明","A","富貴","紫微守命於午，三方四正無煞","紫微居午無煞湊，位至公卿","紫微居子則威勢遠遜","","", c => c.m === 6 && c.ming("紫微")],
 ["riyuezhaobi","日月照壁","A","富貴","太陽、太陰同在丑未之田宅宮（此時命宮為辰戌破軍）","","主多不動產","","", c => c.at(-9).length > 0 && c.has(c.m-9,"太陽","太陰")],
 ["jiangxing","將星得地（武曲守垣）","A","富貴","武曲守命於辰戌丑未廟地","武曲廟垣，威名赫奕","廟地依通行廟旺表","武曲守垣","", c => inn(c.m,1,4,7,10) && c.ming("武曲")],
 ["zixiangpo","紫相遇破軍","A","雜","紫微、天相守命於辰戌，對宮破軍","紫微辰戌遇破軍，富而不貴有虛名","","","", c => inn(c.m,4,10) && c.ming("紫微") && c.qian.includes("破軍")],
 ["jiju","極居卯酉","A","雜","紫微、貪狼同守命於卯酉","","古稱桃花犯主，多出世之想","","", c => inn(c.m,3,9) && c.ming("紫微","貪狼")],
 ["liangtong","梁同巳亥","A","雜","天同、天梁一守命一在對宮，於巳亥","梁同巳亥，男多浪蕩女多淫","古訣警語，需配合煞化再論，不宜直斷","","", c => inn(c.m,5,11) && ((c.ming("天梁") && c.qian.includes("天同")) || (c.ming("天同") && c.qian.includes("天梁")))],
 ["fanshui","泛水桃花","A","雜","貪狼守命於子（亥宮廉貪同度亦屬之）","","古訣警語，需配合煞化再論","","", c => inn(c.m,0,11) && c.ming("貪狼")],
 ["riyuefanbei","日月反背","A","凶","命宮三方四正見太陽落陷、太陰落陷","","古稱最嫌；廟陷依通行日月廟陷表","","", c => {
   const s = [c.m, mod(c.m+4), mod(c.m+8), mod(c.m+6)];
   return s.some(b => c.has(b,"太陽") && SUN_DOWN.has(b)) && s.some(b => c.has(b,"太陰") && MOON_DOWN.has(b)); }],
 ["shapolang","殺破狼","A","結構","命宮坐七殺、破軍、貪狼之一，三方必會齊","","三合恆定的鐵三角之一","","", c => ["七殺","破軍","貪狼"].some(x => c.P[c.m].includes(x))],
 ["kong","命無正曜","A","結構","命宮無主星，借對宮主星入命","","","","", c => c.empty],
 // B：主星條件已具，尚需輔星／煞星／年干
 ["yangliang","陽梁昌祿","B","富貴","太陽、天梁會於命宮三方四正，再得文昌、祿存","天梁太陽昌祿會，臚傳第一名","嚴格版為陽梁卯、乙年祿存同守。俗稱狀元格","狀元格","文昌、祿存", c => c.sf.includes("太陽") && c.sf.includes("天梁")],
 ["matou","馬頭帶箭","B","富貴","命在午，同陰或貪狼守命，擎羊同宮","馬頭帶箭，鎮禦邊疆","丙戊年生","","擎羊同宮（丙戊年）", c => c.m === 6 && (c.ming("天同","太陰") || c.ming("貪狼"))],
 ["xingqiu","刑囚夾印","B","凶","廉貞、天相守命，擎羊同宮或夾","","刑忌夾印同類；古稱多官非","","擎羊（或天刑）", c => c.ming("廉貞","天相")],
 ["huotan","火貪／鈴貪","B","富貴","貪狼守命，火星或鈴星同宮或三方拱照","火星拱會誠為貴","辰戌丑未尤美","","火星或鈴星", c => c.ming("貪狼")],
 ["huaxing","化星返貴","B","富貴","天同守命於戌逢丁年，或巨門守命於辰逢辛年","天同戌宮為反背，丁人化吉主大貴","巨門辰戌為陷地，辛人化吉祿崢嶸","","丁年（天同戌）或辛年（巨門辰）", c => (c.m === 10 && c.ming("天同")) || (c.m === 4 && c.ming("巨門"))],
 ["junchen","君臣慶會","B","富貴","紫微守命，三方四正會府相、左右、昌曲，無煞","君臣慶會，才學經邦","","","左輔右弼、文昌文曲", c => c.ming("紫微")],
 ["tianfuchao","天府朝垣","B","富貴","廉貞、天府同守命於戌，會祿存科權祿，不見煞","","甲己年最佳","","祿存或化祿等吉曜，無煞", c => c.m === 10 && c.ming("廉貞","天府")],
 ["wenliang","文梁振紀","B","富貴","天梁旺地守命，文昌或文曲同宮","天梁廟旺，左右昌曲加會，出將入相","","","文昌或文曲同宮", c => c.ming("天梁")],
 ["lianzhenwenwu","廉貞文武","B","富貴","廉貞入廟守命於寅申，昌曲拱照","廉貞遇文昌，好禮樂","","","文昌、文曲拱照", c => inn(c.m,2,8) && c.ming("廉貞")],
 ["lingchang","鈴昌陀武","B","凶","武曲守命，鈴星、文昌、陀羅會合","","古稱惡格","","鈴星、文昌、陀羅", c => c.ming("武曲")],
 ["shengbu","生不逢時","B","凶","廉貞守命，逢地空或地劫","","","","地空或地劫同宮", c => c.ming("廉貞")],
 ["liangma","梁馬飄蕩","B","凶","天梁守命於寅申巳亥，天馬同宮","","古訣負面，不宜照字面直斷","","天馬同宮", c => inn(c.m,2,5,8,11) && c.ming("天梁")],
 ["lumapeiyin","祿馬佩印","B","富貴","天相守命，祿存或化祿與天馬同宮","","","","祿存或化祿、天馬同宮", c => c.ming("天相")],
 ["cailujiama","財祿夾馬","B","富貴","太陽或天同守命於巳亥，天馬同宮，武曲與破軍化祿夾命","","癸年生","","癸年、天馬同宮", c => inn(c.m,5,11) && (c.only("太陽") || c.only("天同")) && c.jia("武曲","破軍")],
];
// C：純輔煞四化（主星表無法判定，總表列名供查）
const C_LIST = [
 ["左右同宮","命身在丑未，左輔右弼同宮","左右同宮，披羅衣紫"],
 ["文桂文華","命身在丑未，文昌文曲同宮或照","文桂文華，佐九重於堯殿"],
 ["左右夾命","命在丑未，左輔右弼分居兩鄰",""],
 ["昌曲夾命（文星暗拱）","命在丑未，文昌文曲分居兩鄰","夾昌夾曲主貴兮"],
 ["天乙拱命（坐貴向貴）","天魁天鉞一在命、一在身或遷移","魁鉞同行，位居台輔"],
 ["輔拱文星","文昌守命，左輔拱照",""],
 ["祿文拱命","祿存守命，昌曲拱照，不見煞",""],
 ["祿合鴛鴦","祿存與化祿同守命","雙祿重逢，終身富貴"],
 ["雙祿朝垣","祿存與化祿會於命宮三方四正","雙祿重逢，終身富貴"],
 ["祿馬交馳","祿存或化祿與天馬同宮或會照",""],
 ["三奇加會","化祿、化權、化科會於命宮三方四正","科權祿拱，定為折桂之高人"],
 ["權祿巡逢","化祿、化權守命或會照","權祿重逢，財官雙美"],
 ["科權祿夾","三化中兩化在命宮兩鄰夾命","科權祿夾為貴格"],
 ["雙祿夾命","祿存與化祿分居命宮兩鄰","化祿及祿存夾身命，主富貴"],
 ["明祿暗祿","命宮化祿（或祿存），暗合宮有祿存（或化祿）","明祿暗祿，錦上添花"],
 ["科明祿暗","命宮化科，暗合宮有祿存","科明祿暗，位列三台"],
 ["甲第登庸","化科守命，化權三方朝照","科命權朝，登庸甲第"],
 ["科名會祿","化科守命，化祿三方來朝","科祿命逢兼合吉"],
 ["權煞化祿","羊陀火鈴入廟守命，三方有吉","擎羊入廟加吉，富貴聲揚"],
 ["羊陀夾忌","化忌守命，擎羊陀羅分居兩鄰",""],
];

const PATS = DEFS.map(([key, name, cls, kind, cond, quote, note, alias, need, f]) => ({ key, name, cls, kind, cond, quote, note, alias, need, f, occ: [] }));
const CELLS = [];
for (let t = 1; t <= 12; t++) {
  const P = TABLES[t - 1];
  for (let m = 0; m < 12; m++) {
    const c = new Ctx(P, m), id = pad(t) + pad(m), own = P[m];
    const ks = PATS.filter(p => p.f(c)).map(p => p.key);
    PATS.forEach(p => { if (ks.includes(p.key)) p.occ.push(id); });
    CELLS.push({ id, t, m, stars: own, borrow: own.length ? [] : P[mod(m + 6)],
      combo: own.length ? own.map(s => SHORT[s]).join("") : "空",
      tri: { 命: P[m], 財: P[mod(m + 8)], 官: P[mod(m + 4)], 遷: P[mod(m + 6)] },
      pats: ks, anhe: mod(1 - m), anheStars: P[mod(1 - m)], code: `${pad(t)}00${pad(m + 1)}0000003` });
  }
}
PATS.forEach(p => delete p.f);
C_LIST.forEach(([name, cond, quote], i) => PATS.push({ key: "c" + i, name, cls: "C", kind: name === "羊陀夾忌" ? "凶" : "富貴", cond, quote, note: "", alias: "", need: "", occ: [] }));

const PK = Object.fromEntries(PATS.map(p => [p.key, p]));
const CELL = Object.fromEntries(CELLS.map(c => [c.id, c]));
const PARTNER = {}; BRIDGES.forEach(([a, b]) => { PARTNER[a] = b; PARTNER[b] = a; });
const QUIET = new Set(["shapolang", "kong"]);
const cellId = (t, m) => pad(t) + pad(m);
const twinOf = c => CELL[cellId((c.t + 5) % 12 + 1, (c.m + 6) % 12)];

const SIHUA = {"甲":["廉貞","破軍","武曲","太陽"],"乙":["天機","天梁","紫微","太陰"],"丙":["天同","天機","文昌","廉貞"],"丁":["太陰","天同","天機","巨門"],"戊":["貪狼","太陰","右弼","天機"],"己":["武曲","貪狼","天梁","文曲"],"庚":["太陽","武曲","天同","太陰"],"辛":["巨門","太陽","文曲","文昌"],"壬":["天梁","紫微","左輔","武曲"],"癸":["破軍","巨門","太陰","貪狼"]};
const STARS = {
 "紫微":{dou:"北斗主星（帝座）",wx:"陰土",hua:"化氣為尊",grp:1,kw:"尊貴、主導、自我要求高。喜百官朝拱（左右昌曲魁鉞），忌孤君無輔。"},
 "天機":{dou:"南斗",wx:"陰木",hua:"化氣為善",grp:2,kw:"機智、思慮、變動、企劃。善謀而多慮，與巨門、天梁、太陰組合各異。"},
 "太陽":{dou:"中天",wx:"陽火",hua:"化氣為貴",grp:2,kw:"光明、付出、名聲。最重日夜廟陷：寅至午旺廟，未平，申至丑多陷（酉為地）。"},
 "武曲":{dou:"北斗",wx:"陰金",hua:"化氣為財",grp:1,kw:"財星、果決、執行、剛直。與貪、殺、破、相、府同宮各成一格。"},
 "天同":{dou:"南斗",wx:"陽水",hua:"化氣為福",grp:2,kw:"福星、享受、情緒、赤子之心。多需經歷激發。"},
 "廉貞":{dou:"北斗",wx:"陰火",hua:"化氣為囚",grp:1,kw:"次桃花、規範、才藝、官非，邪正兩面，最受同宮星曜與四化左右。"},
 "天府":{dou:"南斗主星",wx:"陽土",hua:"令星・財庫",grp:1,kw:"保守、包容、守成、庫藏。逢空劫為空庫，喜祿存化祿入庫。"},
 "太陰":{dou:"中天",wx:"陰水",hua:"化氣為富",grp:2,kw:"田宅、母性、細膩、積蓄。重廟陷：亥子丑廟、酉戌旺，卯巳午陷。"},
 "貪狼":{dou:"北斗",wx:"陽木（體屬水）",hua:"化氣為桃花",grp:1,kw:"欲望、交際、多才多藝、玄學宗教。遇火鈴另成橫發之格。"},
 "巨門":{dou:"北斗",wx:"陰水",hua:"化氣為暗",grp:2,kw:"口才、是非、研究、疑慮。十二支唯未宮陷，喜太陽照耀解其暗。"},
 "天相":{dou:"南斗",wx:"陽水",hua:"化氣為印",grp:1,kw:"印綬、輔佐、公正、服務。極受夾宮影響：財蔭夾印吉，刑忌夾印凶。"},
 "天梁":{dou:"南斗",wx:"陽土",hua:"化氣為蔭",grp:2,kw:"庇蔭、長者、清高、逢凶化吉。先有難而後有解。"},
 "七殺":{dou:"南斗",wx:"陰金（屬火金）",hua:"將星",grp:1,kw:"衝鋒、權威、獨立、成敗起伏。寅申子午與紫府相對成格。"},
 "破軍":{dou:"北斗",wx:"陰水",hua:"化氣為耗",grp:1,kw:"破舊立新、開創、消耗、變動。子午稱英星入廟。"},
};
const STRUCT_NOTE = {
 zifutonggong: "紫微與天府的位置和恆為 4（mod 12），寅申是這個對稱的不動點，所以紫府只能在寅申同宮。",
 fuxiangchaoyuan: "天府與天相在十二表中恆成三合，這條邊永遠存在。",
 shapolang: "貪狼、七殺、破軍在十二表中恆成三合，是固定的鐵三角。",
 jutong: "太陽、巨門彼此沒有固定的三合或對宮關係，只在特定表號相遇。",
};
const BOOKS = [
 ["慧心齋主談命宮","大塊文化・生命之旅","2025","9786267594322","144 格命宮筆記主軸。甲級星分第一至第三系列，另論六吉、六煞、四化、乙級星與盤性。"],
 ["慧心齋主談星際關係","大塊文化・生命之旅","2025","9786267594315","十二宮與星曜彼此關係，第四章論戀愛婚姻。書末附基礎命盤表一至表十二，與本研習的表號對照。"],
 ["紫微斗數新詮 四十周年增訂版","大塊文化・生命之旅","2021","9789865549411","附修練指引手冊。名詞、十二宮、各星系分析，星性基礎。"],
 ["紫微四化星","大塊文化・生命之旅","2021","9789865549428","副題「如何改變一生的祕笈」，附奇妙修練日記簿。甲至癸十干四化逐章、四化與大運流年、十個命例。"],
 ["紫微斗數全書","明刊本","—","—","〈太微賦〉〈骨髓賦〉〈形性賦〉〈女命骨髓賦〉〈諸星問答論〉及定富局、定貴局。格局總表的古訣底本，各刊本文字略異。"],
];

/* ───────── 名稱與路徑（相對於「筆記」資料夾） ───────── */
const tname = t => `表${pad(t)}-紫微在${BR[t - 1]}`;
const cname = c => `表${pad(c.t)}-命${BR[c.m]}`;
const pfile = p => p.name.replace(/（.*?）/g, "").replace(/／/g, "");
const shortName = n => n.replace(/（.*?）/g, "");
const label = c => `表${c.t}・命${BR[c.m]}`;
const PATH = {
  cell: c => `144格/${tname(c.t)}/${cname(c)}.md`,
  table: t => `144格/${tname(t)}/${tname(t)}.md`,
  pat: p => `格局/${pfile(p)}.md`,
  star: s => `十四主星/${s}.md`,
  book: n => `書目/${n}.md`,
};

/* ───────── 可編輯段落與寫作引導 ───────── */
const EDIT = {
  "格": [
    ["古籍摘記", "《紫微斗數全書》哪幾句講到這個命宮組合？抄下原文並註明出處，例如〈諸星問答論〉。"],
    ["慧心齋主觀點", "用自己的話摘要書中的說法，註明頁碼，不要整段照抄。"],
    ["我的心得與驗證", "這格和鏡像格差在哪？古訣你同意嗎？認識的人裡有沒有這個命宮可以對照？還有什麼疑問？"],
  ],
  "格局": [
    ["古籍原文摘記", "古訣出自哪一篇？前後文怎麼說？各刊本文字有沒有出入？"],
    ["慧心齋主觀點", "書中怎麼看這個格局？成格條件寬或嚴？"],
    ["我的心得", "這個格局出現在哪幾格？為什麼是這幾格？有沒有破格的條件？"],
  ],
  "主星": [
    ["古籍（諸星問答論等）", "《全書》〈諸星問答論〉怎麼描述這顆星？"],
    ["慧心齋主觀點", "書中這顆星的性情、系列、喜忌。"],
    ["我的心得", "用三個關鍵詞形容這顆星；它和哪顆星同宮時變化最大？"],
  ],
};
const DEFAULT_KIND_SECTIONS = [["我的心得", "寫下你的想法。"]];
const STATUS = ["未讀", "研讀中", "已完成"];

/* ───────── 範本 ───────── */
const L = (n, alias) => alias ? `[[${n}|${alias}]]` : `[[${n}]]`;
const starsLinks = a => a.length ? a.map(s => L(s)).join("・") : "（空宮）";
const yl = a => "[" + a.join(", ") + "]";
const clean = s => s.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

function anheLine(c) {
  const b = c.anhe, pi = mod(c.m - b);
  const br = c.stars.filter(x => PARTNER[x]).map(x => `${x}—${PARTNER[x]}`);
  return `${BR[b]}宮（${PAL[pi]}）${starsLinks(c.anheStars)}` + (br.length ? `；永久暗合橋 ${br.join("、")}` : "") + "，見 [[暗合]]";
}

function cellNote(c) {
  const { t, m } = c, twin = twinOf(c), T = c.tri;
  const A = c.pats.filter(k => PK[k].cls === "A"), B = c.pats.filter(k => PK[k].cls === "B");
  const sib = CELLS.filter(x => x.id !== c.id && x.id !== twin.id &&
    ((c.stars.length && x.combo === c.combo) || (!c.stars.length && !x.stars.length && x.borrow.join() === c.borrow.join())));
  const no = (t - 1) * 12 + m + 1;
  const ming = c.stars.length ? starsLinks(c.stars) : `無正曜，借遷移 ${starsLinks(c.borrow)}`;
  const aLines = A.map(k => `- ${L(pfile(PK[k]))}：${PK[k].cond}` + (PK[k].quote ? `　「${PK[k].quote}」` : "")).join("\n") || "- 無";
  const bLines = B.map(k => `- ${L(pfile(PK[k]))}：還需${PK[k].need}`).join("\n") || "- 無";
  return clean(`---
title: ${cname(c)}
類型: 格
表號: ${t}
紫微: ${BR[t - 1]}
命宮: ${BR[m]}
格號: ${no}
主星: ${yl(c.stars)}
組合: ${c.combo}
財帛: ${yl(T["財"])}
事業: ${yl(T["官"])}
遷移: ${yl(T["遷"])}
格局: ${yl(A.map(k => pfile(PK[k])))}
待成格: ${yl(B.map(k => pfile(PK[k])))}
鏡像格: "[[${cname(twin)}]]"
暗合宮: ${BR[c.anhe]}
暗合星: ${yl(c.anheStars)}
生成碼: "${c.code}"
狀態: 未讀
tags: [紫微144格]
---

# 表${t}・命${BR[m]}　${c.stars.join("・") || "命無正曜"}

> [!info] 盤面（第 ${no} 格／144）
> 紫微在${BR[t - 1]}，命宮${BR[m]}：${ming}
> 財帛${BR[mod(m + 8)]} ${starsLinks(T["財"])}｜事業${BR[mod(m + 4)]} ${starsLinks(T["官"])}｜遷移${BR[mod(m + 6)]} ${starsLinks(T["遷"])}
> 生成碼 \`${c.code}\`（貼到萬用命盤產生器，可疊加四化與吉煞）

## 格局
已成格（主星即可判定）：
${aLines}

待成格（主星條件已具）：
${bLines}

## 對照
- 鏡像格：[[${cname(twin)}]]（主星佈局相同、地支差 6）
- 暗合宮：${anheLine(c)}
- 同組合：${sib.map(x => `[[${cname(x)}]]`).join("、") || "無"}
- 本表：[[${tname(t)}]]

## 古籍摘記


## 慧心齋主觀點
出處：[[慧心齋主談命宮]] 頁


## 我的心得與驗證

`);
}

const DIV = [[5,6,7,8],[4,null,null,9],[3,null,null,10],[2,1,0,11]];
function tableNote(t) {
  const P = TABLES[t - 1];
  const rows = DIV.map((r, ri) => "| " + r.map((b, k) => {
    if (b === null) return ri === 1 && k === 1 ? `表${t}` : " ";
    const c = CELL[cellId(t, b)];
    const st = P[b].length ? P[b].join("・") : `（${P[mod(b + 6)].join("・")}）`;
    return `[[${cname(c)}\\|${BR[b]}]] ${st}`;
  }).join(" | ") + " |");
  const grid = "| 　 | 　 | 　 | 　 |\n|---|---|---|---|\n" + rows.join("\n");
  const patLines = [];
  for (let m = 0; m < 12; m++) {
    const c = CELL[cellId(t, m)];
    for (const k of c.pats) {
      const p = PK[k];
      if (QUIET.has(k)) continue;
      if (p.cls === "A" || (p.cls === "B" && p.occ.length <= 4))
        patLines.push(`- 命${BR[m]}：${L(pfile(p))}${p.cls === "B" ? "（待成格，還需" + p.need + "）" : ""}`);
    }
  }
  const lst = Array.from({ length: 12 }, (_, m) => { const c = CELL[cellId(t, m)]; return `- [[${cname(c)}]]　${c.combo}`; }).join("\n");
  const empt = [...BR].filter((_, b) => !P[b].length);
  return clean(`---
title: ${tname(t)}
類型: 表
表號: ${t}
紫微: ${BR[t - 1]}
天府: ${BR[mod(4 - (t - 1))]}
空宮: ${yl(empt)}
tags: [紫微144格]
---
# 表${t}　紫微在${BR[t - 1]}

天府在${BR[mod(4 - (t - 1))]}。空宮：${empt.join("、") || "無"}。鏡像表：[[${tname((t + 5) % 12 + 1)}]]。

${grid}

## 本表格局
${patLines.join("\n") || "- 本表以主星判定的古籍格局不多"}

## 十二格
${lst}

## 本表進度
（需 Obsidian 的 Dataview 外掛；沒裝也沒關係，研習頁的「144 格總覽」也看得到進度）
\`\`\`dataview
TABLE WITHOUT ID file.link AS 格, 組合, 格局, 狀態
FROM #紫微144格
WHERE 類型 = "格" AND 表號 = ${t}
SORT 格號 ASC
\`\`\`

## 我的心得

`);
}

function patNote(p) {
  const occ = p.occ;
  let where;
  if (p.cls === "C") where = "純輔煞四化格局，十二表無法判定，請在萬用命盤產生器第 4 圖層確認。";
  else {
    const by = {};
    occ.forEach(i => (by[+i.slice(0, 2)] ||= []).push(`[[${cname(CELL[i])}]]`));
    where = Object.keys(by).sort((a, b) => a - b).map(t => `- [[${tname(+t)}]]：${by[t].join("、")}`).join("\n") || "- 無";
  }
  const st = STRUCT_NOTE[p.key] ? `\n## 結構觀察\n- ${STRUCT_NOTE[p.key]}\n` : "";
  const lvl = { A: "A 主星與地支即可判定", B: "B 主星條件已具，尚需輔星／煞星／年干", C: "C 純輔煞四化" }[p.cls];
  return clean(`---
title: ${pfile(p)}
類型: 格局
層級: ${p.cls}
類別: ${p.kind}
別名: ${yl(p.alias ? [p.alias] : [])}
出現格數: ${occ.length}
tags: [紫微格局]
---
# ${p.name}

- 層級：${lvl}
- 類別：${p.kind}
- 成立條件：${p.cond}
${p.need ? "- 還需：" + p.need : ""}
${p.quote ? "- 古訣：「" + p.quote + "」" : ""}
${p.note ? "- 備註：" + p.note : ""}

## 出現位置（${occ.length} 格）
${where}
${st}
## 古籍原文摘記


## 慧心齋主觀點


## 我的心得

`).replace(/\n- \n/g, "\n");
}

function patIndexNote(date) {
  const rows = [];
  for (const cls of "ABC") {
    rows.push(`\n## ${cls === "A" ? "A 主星與地支即可判定" : cls === "B" ? "B 主星條件已具，尚需輔星" : "C 純輔煞四化"}\n\n| 格局 | 類別 | 成立條件 | 古訣 | 格數 |\n|---|---|---|---|---|`);
    for (const p of PATS) {
      if (p.cls !== cls) continue;
      const cond = p.cond + (p.need ? `；還需${p.need}` : "");
      rows.push(`| [[${pfile(p)}]] | ${p.kind} | ${cond} | ${p.quote ? "「" + p.quote + "」" : ""} | ${cls !== "C" ? p.occ.length : "—"} |`);
    }
  }
  return clean(`---
title: 格局總表
類型: 索引
tags: [紫微格局]
---
# 格局總表

以《紫微斗數全書》通行本為底，把格局寫成十二表上的判定式，由程式窮舉 144 格（${date}）。廟陷依通行日月廟陷表。
` + rows.join("\n"));
}

function starNote(s) {
  const S = STARS[s];
  const seats = CELLS.filter(c => c.stars.includes(s));
  const hl = Object.entries(SIHUA).flatMap(([g, a]) => a.map((x, i) => x === s ? `${g}化${"祿權科忌"[i]}` : null)).filter(Boolean).join("、") || "不參與生年四化";
  const combos = {};
  seats.forEach(c => (combos[c.combo] ||= []).push(`[[${cname(c)}]]`));
  const pats = [...new Set(seats.flatMap(c => c.pats.filter(k => PK[k].cls === "A" && !QUIET.has(k)).map(k => pfile(PK[k]))))].sort();
  return clean(`---
title: ${s}
類型: 主星
系列: ${S.grp === 1 ? "第一系列" : "第二／三系列（分組待依《談命宮》確認）"}
斗分: ${S.dou}
五行: ${S.wx}
化氣: ${S.hua}
tags: [紫微主星]
---
# ${s}

${S.dou}・${S.wx}・${S.hua}

${S.kw}

- 生年四化：${hl}
- 永久暗合夥伴：${PARTNER[s] ? "[[" + PARTNER[s] + "]]（十二表中恆在本星的暗合宮）" : "無（見 [[暗合]]）"}
- 坐命 ${seats.length} 格
${Object.entries(combos).map(([k, v]) => `  - ${k}：` + v.join("、")).join("\n")}
- 坐命可成之格：${pats.map(x => `[[${x}]]`).join("、") || "無"}

## 古籍（諸星問答論等）


## 慧心齋主觀點
出處：[[慧心齋主談命宮]]、[[紫微斗數新詮 四十周年增訂版]]


## 我的心得

`);
}

function bookNote([n, pub, y, isbn, use]) {
  return clean(`---
title: ${n}
類型: 書目
出版: ${pub}
年份: ${y}
ISBN: "${isbn}"
tags: [紫微書目]
---
# ${n}

- 出版：${pub}（${y}）
- ISBN：${isbn}
- 用途：${use}

## 讀書進度


## 引用此書的筆記
\`\`\`dataview
LIST FROM [[${n}]] WHERE 類型 = "格" OR 類型 = "格局" OR 類型 = "主星"
\`\`\`

## 我的心得

`);
}

function readmeNote() {
  return clean(`---
title: 紫微斗數研習
tags: [紫微144格]
---
# 紫微斗數研習

以古籍與慧心齋主著作為本，按十二表 × 十二命宮共 144 格逐格研讀，並對照古籍格局。

這個資料夾是「紫微研習包」的筆記本體。平常用研習頁（\`紫微研習.html\`）讀和寫就好；想要雙向連結，可以用 Obsidian 開啟這個資料夾。操作說明見 [[使用說明]]。

## 結構
- \`144格/\`：十二表各一資料夾，內含表索引（4×4 盤面、本表格局）與 12 則格筆記
- \`格局/\`：每個格局一則，列出現位置；總覽見 [[格局總表]]
- [[暗合]]：暗合宮概念、五永久暗合橋
- \`十四主星/\`：每顆主星一則
- \`書目/\`：慧心齋主著作與古籍

## 學習路徑
1. 十四主星本性：[[紫微]] 起，對照《全書》諸星問答論與 [[紫微斗數新詮 四十周年增訂版]]。
2. 十二表結構：表號＝紫微所在地支，對照 [[慧心齋主談星際關係]] 書末基礎命盤表。
3. 逐表逐格：先看表索引的「本表格局」，再從命子讀到命亥；命宮以 [[慧心齋主談命宮]] 為主。
4. 鏡像對讀：表1↔表7、表2↔表8……，比較地支型格局的差異。
5. 每讀完一表，回 [[格局總表]] 核對古訣；B 類格局到萬用命盤產生器第 4 圖層疊加輔星確認。
6. 疊加四化與宮位：[[紫微四化星]]、[[慧心齋主談星際關係]]。

## 十二表
${Array.from({ length: 12 }, (_, i) => `- [[${tname(i + 1)}]]`).join("\n")}

## 進度
（需 Obsidian 的 Dataview 外掛）
\`\`\`dataview
TABLE WITHOUT ID 表號 AS 表, length(rows) AS 格數, length(filter(rows.狀態, (s) => s = "研讀中")) AS 研讀中, length(filter(rows.狀態, (s) => s = "已完成")) AS 已完成
FROM #紫微144格
WHERE 類型 = "格"
GROUP BY 表號
SORT 表號 ASC
\`\`\`
`);
}

function anheNote() {
  const pairs = [0,2,3,4,5,6].map(i => `${BR[i]}${BR[mod(1 - i)]}`).join("、");
  const bridges = BRIDGES.map(([a, b]) => `- [[${a}]]—[[${b}]]`).join("\n");
  const lonely = ORDER.filter(s => !PARTNER[s]).map(s => `[[${s}]]`).join("、");
  const dist = Array.from({ length: 12 }, (_, m) => `| ${BR[m]} | ${BR[mod(1 - m)]} | ${PAL[mod(2 * m - 1)]} |`).join("\n");
  return clean(`---
title: 暗合
類型: 概念
tags: [紫微概念]
---
# 暗合

## 定義
暗合宮即地支六合：把命盤左右對摺，相對的兩宮互為暗合，共六對：${pairs}。換成支序就是 p＋q ≡ 1 (mod 12)。

## 實務用法
- 論一宮時，除了對宮，也參考它的暗合宮，看「暗中的牽動、想法或助力」。
- 祿、科在暗合宮與本宮之間成立的格局：[[明祿暗祿]]、[[科明祿暗]]。

## 命宮的暗合宮落在哪一宮
暗合依地支，不依宮名，所以命宮的暗合宮會隨命宮地支改變：

| 命宮 | 暗合宮 | 是命盤的哪一宮 |
|---|---|---|
${dist}

命宮的暗合宮只會是兄弟、子女、疾厄、交友、田宅、父母這六宮（宮序差恆為奇數），永遠不是夫妻、財帛、遷移、事業、福德。

## 五永久暗合橋
十二表中位置和恆 ≡ 1、永遠互在對方暗合宮的星對（程式窮舉驗證）：
${bridges}

沒有永久暗合夥伴的星：${lonely}。

## 我的心得

`);
}

function guideNote() {
  return clean(`---
title: 使用說明
類型: 說明
tags: [紫微144格]
---
# 使用說明

## 最簡單的用法
1. 雙擊資料夾裡的 \`紫微研習.html\`，用瀏覽器打開（建議 Chrome 或 Edge）。
2. 第一次使用，到「筆記與備份」按「選擇筆記資料夾」，選這個 \`筆記\` 資料夾。之後寫的筆記會直接存進來。
3. 在「逐格研讀」選表號與命宮，看盤面、格局，在下方寫筆記。打字會自動存檔。
4. 讀完一格，把狀態改成「研讀中」或「已完成」，「開始」頁會顯示進度和下一格。

用 Safari 或 Firefox 的話，筆記會存在瀏覽器裡。請記得常按「匯出備份」，換電腦時再「匯入」。

## 每一格怎麼讀
- **古籍摘記**：《紫微斗數全書》賦文、諸星問答論相關句，註明篇名。
- **慧心齋主觀點**：以《慧心齋主談命宮》為主，用自己的話摘要並註頁碼，不整段抄錄。
- **我的心得與驗證**：疑問、實例、和鏡像格的比較。

## 建議順序
十四主星 → 表一逐格（命子到命亥）→ 鏡像表七 → 表二↔表八 …… 共六對。每讀完一表，回 [[格局總表]] 核對古訣，再讀 [[暗合]]。研習頁的「今日一格」會照這個順序帶你走。

## 練習
研習頁的「練習」分頁會出題：某格命宮坐什麼星、成什麼格、鏡像格是哪一格。答錯的題目之後會再出現。

## 搬家與備份
- 整個「紫微研習包」資料夾複製或壓縮帶走即可，筆記就在 \`筆記\` 裡。
- 到新電腦打開後，重新「選擇筆記資料夾」一次。

## 進階：用 Obsidian
用 Obsidian「開啟資料夾作為 vault」選這個 \`筆記\` 資料夾，就能用雙向連結瀏覽。表索引和 README 的進度表需要 Dataview 外掛（可不裝）。Obsidian 和研習頁改的是同一批檔案，不要兩邊同時改同一則筆記。

## 注意
- 古訣各刊本文字略異，格局寬嚴各家不同，已在各格局筆記的備註說明。
- 「探花格」「狀元格」等屬後世通稱，《全書》未見。
`);
}

/** 產生整個筆記資料夾：[{path, text}] */
function allNotes(date) {
  const out = [];
  CELLS.forEach(c => out.push({ path: PATH.cell(c), text: cellNote(c) }));
  for (let t = 1; t <= 12; t++) out.push({ path: PATH.table(t), text: tableNote(t) });
  PATS.forEach(p => out.push({ path: PATH.pat(p), text: patNote(p) }));
  out.push({ path: "格局總表.md", text: patIndexNote(date) });
  ORDER.forEach(s => out.push({ path: PATH.star(s), text: starNote(s) }));
  BOOKS.forEach(b => out.push({ path: PATH.book(b[0]), text: bookNote(b) }));
  out.push({ path: "README.md", text: readmeNote() });
  out.push({ path: "暗合.md", text: anheNote() });
  out.push({ path: "使用說明.md", text: guideNote() });
  return out;
}

/* ───────── frontmatter 與段落 ───────── */
function getFront(md, key) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md || "");
  if (!fm) return "";
  const r = new RegExp("^" + key + ":[ \\t]*(.*)$", "m").exec(fm[1]);
  return r ? r[1].trim().replace(/^"(.*)"$/, "$1") : "";
}
function setFront(md, key, val) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!fm) return `---\n${key}: ${val}\n---\n` + md;
  const re = new RegExp("^" + key + ":.*$", "m");
  const body = re.test(fm[1]) ? fm[1].replace(re, `${key}: ${val}`) : fm[1] + `\n${key}: ${val}`;
  return "---\n" + body + "\n---" + md.slice(fm[0].length);
}
function sectionRange(md, name) {
  const lines = md.split("\n");
  const start = lines.findIndex(l => l.trim() === "## " + name);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^#{1,2} /.test(lines[i])) { end = i; break; }
  return { lines, start, end };
}
function getSection(md, name) {
  const r = sectionRange(md || "", name);
  return r ? r.lines.slice(r.start + 1, r.end).join("\n").trim() : "";
}
function setSection(md, name, body) {
  const r = sectionRange(md, name);
  const block = ["", ...(body.trim() ? [body.trim(), ""] : [""])];
  if (!r) return md.trimEnd() + `\n\n## ${name}\n` + block.join("\n") + "\n";
  const out = [...r.lines.slice(0, r.start + 1), ...block, ...r.lines.slice(r.end)];
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
function sectionsOf(md) {
  return EDIT[getFront(md, "類型")] || DEFAULT_KIND_SECTIONS.filter(([n]) => sectionRange(md, n));
}
/** 把 incoming 併進 base：空的段落直接補上；兩邊都有且不同時，附在後面，不覆蓋任何文字 */
function mergeNote(base, incoming, tag) {
  let out = base, changed = false;
  for (const [n] of sectionsOf(base)) {
    const cur = getSection(base, n), inc = getSection(incoming, n);
    if (!inc || inc === cur || cur.includes(inc)) continue;
    const curEmpty = !cur || /^出處：[^\n]*$/.test(cur);
    out = setSection(out, n, curEmpty && (!cur || inc.startsWith("出處")) ? inc : cur + `\n\n---\n（${tag}）\n` + inc);
    changed = true;
  }
  const sa = getFront(base, "狀態"), sb = getFront(incoming, "狀態");
  if (sa && sb && STATUS.indexOf(sb) > STATUS.indexOf(sa)) { out = setFront(out, "狀態", sb); changed = true; }
  return { text: out, changed };
}

/* ───────── zip（只存不壓縮；讀取支援 deflate） ───────── */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files, when = new Date()) {   // files: [{path, data: string|Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = [];
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.path), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(e.buffer)], out = new Uint8Array(off + cdSize + 22);
  let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
async function readZip(buf) {   // → [{path, text}]，只取 .md
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), dec = new TextDecoder();
  let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("不是 zip 檔");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const out = [];
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const path = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!path.endsWith(".md") || path.includes("__MACOSX") || /(^|\/)\./.test(path)) continue;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    let data = u8.subarray(ds, ds + csize);
    if (method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else if (method !== 0) continue;
    out.push({ path, text: dec.decode(data) });
  }
  return out;
}
/** 把匯入檔案的路徑對齊到「筆記」資料夾的相對路徑 */
function normalizeImportPath(p) {
  p = p.replace(/\\/g, "/");
  const i = p.indexOf("筆記/");
  if (i >= 0) return p.slice(i + 3);
  for (const top of ["144格/", "格局/", "十四主星/", "書目/"]) { const j = p.indexOf(top); if (j >= 0) return p.slice(j); }
  return p.split("/").pop();
}

const api = { BR, PAL, ORDER, SHORT, TABLES, CELLS, CELL, PATS, PK, BRIDGES, PARTNER, QUIET, SIHUA, STARS, BOOKS, DIV, EDIT, STATUS,
  mod, pad, cellId, twinOf, tname, cname, pfile, shortName, label, PATH,
  cellNote, tableNote, patNote, starNote, allNotes,
  getFront, setFront, getSection, setSection, sectionsOf, mergeNote, makeZip, readZip, normalizeImportPath };
if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ZW = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
