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
- `src/app.js`：介面（開始、逐格研讀、總覽、格局、主星、四化學習、四化日記、練習、書目、筆記與備份）。
- `src/style.css`、`src/shell.html`：樣式與外殼，建置時把 CSS、core、app 內嵌成單一 HTML。
- `src/config.js`：學員可手改的設定（筆記資料夾名稱、命盤產生器位置），會原樣複製到研習包。
- `tools/verify.mjs`：和原研習頁的資料（`tools/reference-data.json`，由 gen2.py 產生）逐格比對，並測段落合併與 zip。
- `tools/build.mjs`：輸出研習包；萬用命盤產生器取自 `../ziwei-astrology-tool/index.html`。
- `tools/workbook.mjs`：PDF 練習簿（A4，190 頁）：封面、說明、進度表、十四主星、每表 14 頁（總覽、12 格、默寫測驗）、格局總表。頁面都固定一頁，所以鏡像格、格局位置能標頁碼；字型用 macOS 的蘋方與宋體。

## 筆記怎麼存
- Chrome／Edge：學員選一次「筆記」資料夾，之後直接讀寫 .md 檔（File System Access API）。資料夾授權存在 IndexedDB，每次重開瀏覽器按一次「繼續」。
- Safari／Firefox：存在瀏覽器（IndexedDB），靠「匯出備份 zip」搬家。
- 寫入時只改「古籍摘記／慧心齋主觀點／我的心得」等段落與 frontmatter 的「狀態」，其他內容（含在 Obsidian 的修改）保留。
- 匯入與合併不覆蓋文字：空段落補上，兩邊都寫過的接在後面並標註來源。

## 四化
- `core.js` 的 `SIHUA`（四化表）、`HUA_TXT`（39 則通行說法，非原書文字）、`HUA_BOOK`（《紫微四化星》要點，待補）。
- 四化入表：`huaPlaces`、`huaPairs`、`relOf`。輔星由學員指定一顆，`auxPartnerAt` 安另一顆（左右、昌曲支序和恆 ≡ 2）。
- 筆記：`四化/十干四化.md`、`四化/我的四化星性.md`（每化一段），日記存在 `四化日記/YYYY-MM-DD.md`，一天一篇，天干由學員查萬年曆自選。

## 修改格局定義
改 `src/core.js` 的 `DEFS`，跑 `npm run verify`（判定結果改變時，比對會失敗，確認無誤後重新產生 `tools/reference-data.json`），再 `npm run build`。

## 授權
Apache License 2.0，見 `LICENSE`。
