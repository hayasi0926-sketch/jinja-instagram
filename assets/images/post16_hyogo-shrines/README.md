# 投稿⑯で使用する画像（実際のアプリ画面）

すべて実際の公開アプリ（https://shrine-map-zeta.vercel.app）から取得する。**まだ未取得。**

| ファイル名 | 使用スライド | 内容 |
|---|---|---|
| `slide2-map.jpg` | 2枚目 | 地図画面（全国表示、投稿④と共通） |
| `slide3-search.jpg` | 3枚目 | 「生田神社」の検索結果カード |
| `slide4-detail.jpg` | 4枚目 | 生田神社の神社詳細画面 |

手順:
1. `node scripts/find-shrine-candidates.js --pref 兵庫 --names "生田神社,湊川神社,西宮神社,長田神社"`
   → 写真ありでヒットしたものを使う（生田神社が無ければ別の神社に変え、content.js・slide3/4.html の alt・manifest の caption/hashtags も合わせて直す）
2. `node scripts/fetch-region-screenshot.js --name "生田神社" --url "<1で出たURL>" --folder post16_hyogo-shrines --mapFrom post4_tokyo-shrines`
