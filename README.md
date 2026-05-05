# 台灣熱區圖小工具

純前端 CSV → 台灣 choropleth 工具（React + Vite）。

## 功能

- 支援貼上或上傳 CSV。
- 顆粒度：
  - 2 欄：縣市 + 數值
  - 3 欄：縣市 + 鄉鎮市區 + 數值
  - >3 欄：預設第 1 欄地理欄位 + 最後 1 欄數值（可手動調整）
- 依資料上下界自動上色（sequential scale）。
- 無資料列會以 no-data 色顯示並靜默略過不合法列。

## 本機開發

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
npm run preview
```

## GitHub Pages

專案已包含 `.github/workflows/deploy-pages.yml`，push 到 GitHub 後會自動部署。
