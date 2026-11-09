// 建置：src/ → dist/紫微研習包/（單頁 HTML、config.js、筆記、萬用命盤產生器）＋ dist/紫微研習包.zip
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const Z = require(path.join(ROOT, "src/core.js"));
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const read = f => fs.readFileSync(path.join(ROOT, "src", f), "utf8");
const PACK = "紫微研習包", OUT = path.join(ROOT, "dist", PACK);
const CHART = path.resolve(ROOT, "../ziwei-astrology-tool/index.html");

if (fs.existsSync(path.join(ROOT, "dist", "紫微144格練習簿.pdf"))) fs.copyFileSync(path.join(ROOT, "dist", "紫微144格練習簿.pdf"), path.join(ROOT, ".workbook.pdf"));
fs.rmSync(path.join(ROOT, "dist"), { recursive: true, force: true });
const files = [];
const put = (rel, data) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); files.push({ path: PACK + "/" + rel, data: typeof data === "string" ? data : new Uint8Array(data) }); };

const html = read("shell.html")
  .replace("/*STYLE*/", () => read("style.css"))
  .replace("/*VERSION*/", VERSION)
  .replace("/*BOOK*/", () => Z.DATA_FILES.map(f => read(`data/${f}.js`)).join("\n"))
  .replace("/*CORE*/", () => read("core.js"))
  .replace("/*APP*/", () => read("app.js"));
put("紫微研習.html", html);
put("config.js", read("config.js"));
if (fs.existsSync(CHART)) put("萬用命盤產生器.html", fs.readFileSync(CHART));
else console.warn("找不到萬用命盤產生器：", CHART);
const WB_KEEP = path.join(ROOT, ".workbook.pdf");   // 由 tools/workbook.mjs 產生，dist 清掉前已先複製出來
if (fs.existsSync(WB_KEEP)) put("紫微144格練習簿.pdf", fs.readFileSync(WB_KEEP));
else console.warn("還沒有 PDF 練習簿，先跑 npm run workbook");
put("先讀我.txt", `紫微研習包 v${VERSION}（${today}）

1. 雙擊「紫微研習.html」，用瀏覽器打開（建議 Chrome 或 Edge）。
2. 到「筆記與備份」按「選擇筆記資料夾」，選這裡的「筆記」資料夾。
3. 開始逐格研讀，筆記寫在盤面下方，會自動存檔。

搬家：整個「紫微研習包」資料夾複製或壓縮帶走即可。
用 Safari、Firefox：筆記存在瀏覽器裡，請常按「匯出備份」。
喜歡手寫：列印「紫微144格練習簿.pdf」（A4，213 頁），每格一頁；含四化學習章與十個四化日記範本。
詳細說明：筆記/使用說明.md
`);
for (const n of Z.allNotes(today)) put("筆記/" + n.path, n.text);
fs.writeFileSync(path.join(ROOT, "dist", PACK + ".zip"), Z.makeZip(files));
console.log(`${files.length} 個檔案，HTML ${(html.length / 1024).toFixed(0)} KB → dist/${PACK}/ 與 dist/${PACK}.zip`);

// 網站版：dist/site/ → 部署到 GitHub Pages 的 ziwei-study-pack/（index.html＋設定＋命盤產生器＋離線版 zip）
const SITE = path.join(ROOT, "dist", "site");
fs.mkdirSync(SITE, { recursive: true });
fs.copyFileSync(path.join(OUT, "紫微研習.html"), path.join(SITE, "index.html"));
for (const f of ["config.js", "萬用命盤產生器.html", "紫微144格練習簿.pdf"]) if (fs.existsSync(path.join(OUT, f))) fs.copyFileSync(path.join(OUT, f), path.join(SITE, f));
fs.copyFileSync(path.join(ROOT, "dist", PACK + ".zip"), path.join(SITE, PACK + ".zip"));
const DEPLOY = process.env.DEPLOY_DIR;   // 例：../ericckfeng.github.io/ziwei-study-pack
if (DEPLOY) { fs.rmSync(DEPLOY, { recursive: true, force: true }); fs.cpSync(SITE, DEPLOY, { recursive: true }); console.log("已複製網站版到", DEPLOY); }
