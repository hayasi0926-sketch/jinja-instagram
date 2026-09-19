/**
 * 投稿④〜⑬（10投稿分の追加コンテンツ）で使う「本物の画面」を、
 * 実際に公開されている神社アプリ (https://shrine-map-zeta.vercel.app) から
 * スクリーンショットとして取得し、assets/images/ 配下に保存するスクリプト。
 *
 * 架空の画面・架空の神社情報は一切作らない。
 * 検索は実際に「その神社名」で検索した結果をそのまま使う
 * （都道府県名で検索すると実装上ヒットしないことがあるため、
 *   各投稿で紹介する神社の正式名称で検索している）。
 *
 * 使い方: node scripts/fetch-more-screenshots.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = 'https://shrine-map-zeta.vercel.app';
const OUT = (...p) => path.join(__dirname, '..', 'assets', 'images', ...p);

// 実際に検索・確認済みの神社（都道府県タグ・写真の有無を確認済み）
const SHRINES = {
  meiji: { name: '明治神宮', url: `${BASE}/shrines/234ec602-54d0-4f93-ae79-94e9cee11ad9`, folder: 'post4_tokyo-shrines' },
  shimogamo: { name: '下鴨神社', url: `${BASE}/shrines/974e7ccb-3238-4186-a76a-20058d00c720`, folder: 'post5_kyoto-shrines' },
  sumiyoshi: { name: '住吉大社', url: `${BASE}/shrines/ed55690b-a46b-4655-8cd4-fa607f8af305`, folder: 'post6_osaka-shrines' },
  dazaifu: { name: '太宰府天満宮', url: `${BASE}/shrines/fc0417fd-ffc4-43ee-a97f-e5339550e705`, folder: 'post7_fukuoka-shrines' },
};

async function main() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });

  // ---------------------------------------------------------------
  // 地域紹介4投稿：検索結果カード（神社名で検索） + 神社詳細
  // ---------------------------------------------------------------
  for (const key of Object.keys(SHRINES)) {
    const { name, url, folder } = SHRINES[key];

    // 検索結果カード（件数表示は含めない）
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle0' });
    await sleep(400);
    const inputs = await page.$$('input');
    await inputs[1].click();
    await inputs[1].type(name, { delay: 30 });
    await sleep(1200);
    await waitForImages(page);
    const cardRect = await page.evaluate((shrineName) => {
      const nameEl = Array.from(document.querySelectorAll('*')).find(
        (el) => el.children.length === 0 && el.textContent.includes(shrineName.slice(0, 4))
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
  }

  // ---------------------------------------------------------------
  // 募集3投稿：地域紹介の詳細画像を再利用（コラージュ用に地図も保存）
  // ---------------------------------------------------------------
  await page.goto(`${BASE}/map`, { waitUntil: 'networkidle0' });
  await sleep(1500);
  await waitForImages(page);
  const japanMapShot = await page.screenshot({ clip: { x: 0, y: 0, width: 430, height: 760 } });
  await save(japanMapShot, 'post11_tokyo-boshu', 'slide3-map.jpg');
  await save(japanMapShot, 'post12_kansai-boshu', 'slide3-map.jpg');
  await save(japanMapShot, 'post13_nationwide-boshu', 'slide3-map.jpg');

  await copyAsset('post4_tokyo-shrines', 'slide4-detail.jpg', 'post11_tokyo-boshu', 'slide2-detail.jpg');
  await copyAsset('post4_tokyo-shrines', 'slide4-detail.jpg', 'post11_tokyo-boshu', 'slide3-detail.jpg');
  await copyAsset('post6_osaka-shrines', 'slide4-detail.jpg', 'post12_kansai-boshu', 'slide2-detail.jpg');
  await copyAsset('post5_kyoto-shrines', 'slide4-detail.jpg', 'post12_kansai-boshu', 'slide3-detail.jpg');
  await copyAsset('post1_hokkaido-shrines', 'slide4-detail.jpg', 'post13_nationwide-boshu', 'slide2-detail.jpg');
  await copyAsset('post7_fukuoka-shrines', 'slide4-detail.jpg', 'post13_nationwide-boshu', 'slide3-detail.jpg');

  // ---------------------------------------------------------------
  // お気に入り機能：ハートアイコン（神社詳細ページ右上）+ マイページの「記録」欄
  // ---------------------------------------------------------------
  await page.goto(SHRINES.meiji.url, { waitUntil: 'networkidle0' });
  await sleep(800);
  await waitForImages(page);
  const heartShot = await page.screenshot({ clip: { x: 270, y: 0, width: 160, height: 160 } });
  await save(heartShot, 'post8_favorites', 'slide2-heart.jpg');

  // おみくじボックス（同じページ、参拝する＋電子御朱印の下）
  const omikujiShot = await page.screenshot({ clip: { x: 0, y: 558, width: 430, height: 182 } });
  await save(omikujiShot, 'post9_omikuji', 'slide2-omikuji.jpg');

  // マイページ（未ログイン状態の「記録」メニュー：御朱印帳・参拝履歴・お気に入り一覧）
  await page.goto(`${BASE}/mypage`, { waitUntil: 'networkidle0' });
  await sleep(800);
  const mypageRecordShot = await page.screenshot({ clip: { x: 0, y: 240, width: 430, height: 215 } });
  await save(mypageRecordShot, 'post8_favorites', 'slide3-mypage.jpg');
  await save(mypageRecordShot, 'post10_mypage', 'slide2-mypage.jpg');

  // マイページ全体（表紙的に使う場合の参考用）
  const mypageFullShot = await page.screenshot({ clip: { x: 0, y: 0, width: 430, height: 500 } });
  await save(mypageFullShot, 'post10_mypage', 'slide3-mypage-full.jpg');

  await browser.close();
  console.log('\n完了しました。assets/images/ 配下を確認してください。');
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

async function copyAsset(fromFolder, fromFile, toFolder, toFile) {
  const src = OUT(fromFolder, fromFile);
  const dest = OUT(toFolder, toFile);
  fs.copyFileSync(src, dest);
  console.log('複製:', path.relative(process.cwd(), src), '->', path.relative(process.cwd(), dest));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
