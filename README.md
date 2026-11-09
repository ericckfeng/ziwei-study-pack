# 紫微研習包（ziwei-study-pack）

給學員用的紫微斗數 144 格研習工具：一個雙擊就能開的 HTML，加上一個 Markdown 筆記資料夾。
不用安裝、可離線、整包可搬走；筆記用 Obsidian、Typora 也能讀寫。

## 建置
```
npm run build      # 先驗證，再輸出 dist/紫微研習包/ 與 dist/紫微研習包.zip
npm run verify     # 只跑驗證
npm run workbook   # 產生 PDF 練習簿（需要 Chrome），之後的 build 會把它放進研習包與網站
npm run deploy     # build 並複製網站版到 ../ericckfeng.github.io/ziwei-study-pack
```
發給學員的是 `dist/紫微研習包.zip`。

## 結構
- `src/core.js`：十二表主星、格局判定（由 `_程式/gen2.py` 移植）、筆記範本（由 `gen_notes.py` 移植）、段落合併、zip。瀏覽器與 Node 共用。
- `src/app.js`：介面（開始、逐格研讀、總覽、格局、主星、開發潛能、四化學習、生辰排盤、四化日記、練習、書目、筆記與備份）。
- `src/data/`：書中內容，和程式分開，增修內容只要改這裡（建置時依序併進 HTML）：
  - `解說.js`：慧心齋主兩本書的研讀重點（四化本質與四層次、各星四化總評與細解、十二宮顯像、輔煞、天羅地網、重疊看盤；開發潛能的星曜檔案、調和工具與步驟）。
  - `命例.js`：書中命例，一筆一個；檔頭說明每個欄位。表號、命宮照筆記抄，標錯也照抄，程式會核對。動態命例（大限、流年、流月、流日流時）也在這裡。
  - `十干四化.js`：《紫微斗數十干四化全輯》，每干四化各一句，四化日記與 PDF 日記範本用。
- `src/style.css`、`src/shell.html`：樣式與外殼，建置時把 CSS、core、app 內嵌成單一 HTML。
- `src/config.js`：學員可手改的設定（筆記資料夾名稱、命盤產生器位置），會原樣複製到研習包。
- `tools/verify.mjs`：和原研習頁的資料（`tools/reference-data.json`，由 gen2.py 產生）逐格比對，並測段落合併與 zip。
- `tools/build.mjs`：輸出研習包；萬用命盤產生器取自 `../ziwei-astrology-tool/index.html`。
- `tools/workbook.mjs`：PDF 練習簿（A4，213 頁）：封面、說明、進度表、十四主星、每表 14 頁（總覽、12 格、默寫測驗）、四化學習（十干四化表、十干各一頁、輔星安星對照）、四化日記（寫法說明與甲日到癸日十個範本）、格局總表。頁面都固定一頁，所以鏡像格、格局位置能標頁碼；字型用 macOS 的蘋方與宋體。

## 筆記怎麼存
- Chrome／Edge：學員選一次「筆記」資料夾，之後直接讀寫 .md 檔（File System Access API）。資料夾授權存在 IndexedDB，每次重開瀏覽器按一次「繼續」。
- Safari／Firefox：存在瀏覽器（IndexedDB），靠「匯出備份 zip」搬家。
- 寫入時只改「古籍摘記／慧心齋主觀點／我的心得」等段落與 frontmatter 的「狀態」，其他內容（含在 Obsidian 的修改）保留。
- 匯入與合併不覆蓋文字：空段落補上，兩邊都寫過的接在後面並標註來源。

## 四化
- `core.js` 的 `SIHUA`（四化表）、`HUA_TXT`（39 則通行說法，非原書文字）、`HUA_BOOK`（《紫微四化星》要點，待補）。
- 四化入表：`huaPlaces`、`huaPairs`、`relOf`。輔星、煞星：`stemStars` 依天干安祿存、羊陀、魁鉞；`auxPositions` 依學員指定安左右（支序和 ≡ 2）；昌曲、空劫共用時辰，由 `HOUR_AT`／`HOUR_OF` 互推；`jiaAt` 判斷夾宮。火鈴需年支與男女，和四化無關，不安。
- 筆記：`四化/十干四化.md`、`四化/我的四化星性.md`（每化一段），日記存在 `四化日記/YYYY-MM-DD.md`，一天一篇，天干依日期自動帶出（`dayGanzhi`，以 1949-10-01 甲子日為基準），學員可改選；改日期時，自動帶出的天干會跟著換。

## 生辰排盤與命例核對
- 陽曆轉農曆：`solarToLunar`／`solarBirth` 用內建的 `Intl` 中國曆（ICU），不帶萬年曆表；支援 1900–2100 年。晚子時預設算隔天、閏月預設依本月（可在介面切換）。`npm run verify` 會逐日檢查 1900–2100 年的換算連續性。
- `core.js` 的 `birthChart`：農曆月日時 → 命宮、身宮（寅起正月、子時逆／順數）、五行局（五虎遁＋納音）、紫微（`ziweiAt`）、大限；`auxOf` 依年月時安左右昌曲、空劫、祿存羊陀、魁鉞、天馬、火鈴。不處理閏月與晚子時。
- 書中命例三方核對（`resolveCase`）：筆記標的表號與命宮、生辰排盤、命宮主星。以命宮主星為準；生辰排出的命宮主星相同就依生辰定格（連命宮地支一起更正），否則依主星定表號並標「生辰待查」。命宮輔煞只依年月時安星，用來檢驗這三項。
- 目前結果：40 例中 33 例生辰與主星一致，命宮輔煞 50 顆全部相符；其餘 7 例（孫、褚、施、陶、戚、謝、柏）生辰的日或局與主星不合，待查原書。

## 增修書中內容
1. 改 `src/data/` 裡的檔案。新增命例：在 `命例.js` 照抄一筆，改稱呼、表號、命宮、配置、生辰（格式「甲子年8月15日亥時」）、說明。
2. `npm run verify`：會檢查命例欄位與生辰格式、十干四化的星名是否和四化表一致，並列出命例核對結果。
3. `npm run build`（要更新 PDF 再跑 `npm run workbook`）。

## 修改格局定義
改 `src/core.js` 的 `DEFS`，跑 `npm run verify`（判定結果改變時，比對會失敗，確認無誤後重新產生 `tools/reference-data.json`），再 `npm run build`。

## 授權
Apache License 2.0，見 `LICENSE`。
