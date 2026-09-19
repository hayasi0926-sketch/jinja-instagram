/**
 * 実際に公開されている神社アプリ (https://shrine-map-zeta.vercel.app) から、
 * Instagram投稿で使う「本物の画面」をスクリーンショットとして取得し、
 * assets/images/ 配下に保存するスクリプト。
 *
 * 架空の画面は一切作らず、実際にブラウザで表示された内容だけを保存する。
 *
 * 使い方: node scripts/fetch-app-screenshots.js
 */
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = 'https://shrine-map-zeta.vercel.app';
const HOKKAIDO_JINGU_URL = `${BASE}/shrines/c3553337-fae1-40b8-b4e0-845989adf181`; // 北海道神宮（実在のID / 検索結果から取得）

const OUT = (...p) => path.join(__dirname, '..', 'assets', 'images', ...p);

async function main() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });

  // ---------------------------------------------------------------
  // 1. 地図画面（/map）— 北海道が画面内に入るまで実際にドラッグ操作でパン
  // ---------------------------------------------------------------
  await page.goto(`${BASE}/map`, { waitUntil: 'networkidle0' });
  await sleep(1500);

  const japanMapShot = await page.screenshot({ clip: { x: 0, y: 0, width: 430, height: 760 } });
  await save(japanMapShot, 'post3_boshu', 'slide3-map.jpg');

  await page.mouse.move(215, 300);
  await page.mouse.down();
  await page.mouse.move(215, 620, { steps: 15 });
  await page.mouse.up();
  await sleep(1200);
  const hokkaidoMapShot = await page.screenshot({ clip: { x: 0, y: 90, width: 430, height: 760 } });
  await save(hokkaidoMapShot, 'post1_hokkaido-shrines', 'slide2-map.jpg');

  // ---------------------------------------------------------------
  // 2. 検索画面（/search）で「北海道」と検索した実際の結果
  // ---------------------------------------------------------------
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle0' });
  const inputs = await page.$$('input');
  await inputs[1].click();
  await inputs[1].type('北海道', { delay: 40 });
  await sleep(1200);

  // 参考用：検索画面全体（ヘッダー・件数表示を含む、資料用）
  const searchShot = await page.screenshot({ clip: { x: 0, y: 0, width: 430, height: 660 } });
  await save(searchShot, 'post1_hokkaido-shrines', 'slide3-search-full.jpg');

  // 投稿で使用する分：件数表示（「2件を表示」）を含めず、検索結果カードのみをトリミング
  const cardsShot = await page.screenshot({ clip: { x: 0, y: 206, width: 430, height: 258 } });
  await save(cardsShot, 'post1_hokkaido-shrines', 'slide3-search.jpg');

  // ---------------------------------------------------------------
  // 3. 神社詳細画面（北海道神宮）— 写真・名称・参拝する・電子御朱印案内
  // ---------------------------------------------------------------
  await page.goto(HOKKAIDO_JINGU_URL, { waitUntil: 'networkidle0' });
  await sleep(1000);

  const detailShot = await page.screenshot({ clip: { x: 0, y: 0, width: 430, height: 580 } });
  await save(detailShot, 'post1_hokkaido-shrines', 'slide4-detail.jpg');
  await save(detailShot, 'post3_boshu', 'slide2-detail.jpg');
  await save(detailShot, 'post3_boshu', 'slide3-detail.jpg');

  // 電子御朱印の案内ボックスだけを拡大トリミング
  const goshuinShot = await page.screenshot({ clip: { x: 0, y: 436, width: 430, height: 128 } });
  await save(goshuinShot, 'post2_goshuin', 'slide2-goshuin-box.jpg');

  // ---------------------------------------------------------------
  // 4. 「参拝する」→ ログインモーダル（実際の導線）
  // ---------------------------------------------------------------
  const visitBtn = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('参拝する'))
  );
  await visitBtn.asElement().click();
  await sleep(1000);
  // 「参拝する」ボタン〜ログインのボトムシートまでを1枚で見せる
  const modalShot = await page.screenshot({ clip: { x: 0, y: 350, width: 430, height: 582 } });
  await save(modalShot, 'post2_goshuin', 'slide3-login-modal.jpg');

  await browser.close();
  console.log('\n完了しました。assets/images/ 配下を確認してください。');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const fs = require('fs');
async function save(buffer, ...destParts) {
  const outPath = OUT(...destParts);
  fs.writeFileSync(outPath, buffer);
  console.log('保存:', path.relative(process.cwd(), outPath));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
