/**
 * 新しい地域紹介投稿（⑭以降）用に、実際のアプリから
 * 「検索結果カード」と「神社詳細画面」のスクリーンショットを取得する汎用スクリプト。
 *
 * fetch-more-screenshots.js と同じ撮影ロジックを、任意の神社1件に対して実行できるようにしたもの。
 * 架空の画面・架空の神社情報は一切使用しない（実際に検索・取得した本物の画面のみ）。
 *
 * 使い方:
 *   node scripts/fetch-region-screenshot.js --name "真清田神社" \
 *     --url "https://shrine-map-zeta.vercel.app/shrines/xxxx" \
 *     --folder post14_aichi-shrines \
 *     [--mapFrom post4_tokyo-shrines]   （地図画像を既存フォルダからコピーする場合）
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = 'https://shrine-map-zeta.vercel.app';
const OUT = (...p) => path.join(__dirname, '..', 'assets', 'images', ...p);

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const { name, url, folder, mapFrom } = parseArgs();
  if (!name || !url || !folder) {
    console.error('使い方: node scripts/fetch-region-screenshot.js --name "神社名" --url "詳細URL" --folder postN_xxxx [--mapFrom post4_tokyo-shrines]');
    process.exit(1);
  }

  fs.mkdirSync(OUT(folder), { recursive: true });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });

  // 検索結果カード（件数表示は含めない）
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle0' });
  await sleep(400);
  const inputs = await page.$$('input');
  const searchInput = inputs[inputs.length - 1];
  await searchInput.click();
  await searchInput.type(name, { delay: 30 });
  await sleep(1200);
  await waitForImages(page);
  const cardRect = await page.evaluate((shrineName) => {
    const nameEl = Array.from(document.querySelectorAll('h3')).find((el) =>
      el.textContent.includes(shrineName.slice(0, 4))
    );
    let card = nameEl;
    for (let i = 0; i < 6 && card && card.parentElement; i++) {
      card = card.parentElement;
      if (card.querySelector('img')) break;
    }
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  }, name);
  if (cardRect) {
    const top = Math.max(0, cardRect.top - 8);
    const height = Math.min(300, cardRect.bottom - cardRect.top + 16);
    const cardShot = await page.screenshot({ clip: { x: 0, y: top, width: 430, height } });
    await save(cardShot, folder, 'slide3-search.jpg');
  } else {
    console.warn(`  [警告] ${name} の検索結果カード位置が取得できませんでした`);
  }

  // 神社詳細（写真・名称・参拝する・電子御朱印案内）
  await page.goto(url, { waitUntil: 'networkidle0' });
  await sleep(800);
  await waitForImages(page);
  const detailShot = await page.screenshot({ clip: { x: 0, y: 0, width: 430, height: 580 } });
  await save(detailShot, folder, 'slide4-detail.jpg');

  await browser.close();

  if (mapFrom) {
    const src = OUT(mapFrom, 'slide2-map.jpg');
    const dest = OUT(folder, 'slide2-map.jpg');
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log('複製:', path.relative(process.cwd(), src), '->', path.relative(process.cwd(), dest));
    } else {
      console.warn(`  [警告] コピー元の地図画像が見つかりません: ${src}`);
    }
  }

  console.log('\n完了しました。assets/images/' + folder + '/ を確認してください。');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForImages(page) {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((img) =>
        img.complete && img.naturalWidth > 0
          ? null
          : new Promise((res) => {
              img.onload = res;
              img.onerror = res;
              setTimeout(res, 4000);
            })
      )
    )
  );
}

async function save(buffer, ...destParts) {
  const outPath = OUT(...destParts);
  fs.writeFileSync(outPath, buffer);
  console.log('保存:', path.relative(process.cwd(), outPath));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
