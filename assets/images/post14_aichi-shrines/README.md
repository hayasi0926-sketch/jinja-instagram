# 投稿⑭で使用する画像（実際のアプリ画面）

すべて実際の公開アプリ（https://shrine-map-zeta.vercel.app）から取得。
検索は実際に「名古屋東照宮」（愛知県名古屋市、徳川家康公を祀る神社）で検索した結果をそのまま使用しています。

| ファイル名 | 使用スライド | 内容 |
|---|---|---|
| `slide2-map.jpg` | 2枚目 | 地図画面（全国表示、投稿④と共通） |
| `slide3-search.jpg` | 3枚目 | 「名古屋東照宮」の検索結果カード |
| `slide4-detail.jpg` | 4枚目 | 名古屋東照宮の神社詳細画面 |

再取得: `node scripts/fetch-region-screenshot.js --name "名古屋東照宮" --url "https://shrine-map-zeta.vercel.app/shrines/bd145b02-9ff3-4f3e-8bb1-6d5b20f80ff9" --folder post14_aichi-shrines --mapFrom post4_tokyo-shrines`
