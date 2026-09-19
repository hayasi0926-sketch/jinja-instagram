/**
 * 新しい地域紹介投稿を作る際、その都道府県の中で「実際に写真が登録されている」
 * 神社の候補を探すための調査スクリプト。
 *
 * 神社アプリの検索は神社名の部分一致でしか絞り込めないため、
 * 有名神社の名前をいくつか渡して、実際にヒットするか・写真があるかを確認する。
 * 写真の中身（本当に社殿の写真か、御朱印や紋章の画像か）はここでは判定しないので、
 * 見つかった候補は fetch-region-screenshot.js で撮影したうえで、
 * 実際の見た目を確認してから使うこと。
 *
 * 使い方:
 *   node scripts/find-shrine-candidates.js --pref kanagawa --names "鶴岡八幡宮,寒川神社,箱根神社"
 */
const puppeteer = require('puppeteer');

const BASE = 'https://shrine-map-zeta.vercel.app';

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
  const { pref, names } = parseArgs();
  if (!pref || !names) {
    console.error('使い方: node scripts/find-shrine-candidates.js --pref kanagawa --names "鶴岡八幡宮,寒川神社"');
    process.exit(1);
  }
  const nameList = names.split(',').map((s) => s.trim()).filter(Boolean);

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });

  const results = [];
  for (const name of nameList) {
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle0' });
    await sleep(300);
    const inputs = await page.$$('input');
    const searchInput = inputs[inputs.length - 1];
    await searchInput.click();
    await searchInput.type(name, { delay: 15 });
    await sleep(1200);

    const matches = await page.evaluate((n, targetPref) => {
      const h3s = Array.from(document.querySelectorAll('h3')).filter((el) => el.textContent.includes(n.slice(0, 3)));
      return h3s
        .map((h3) => {
          let card = h3;
          for (let i = 0; i < 4 && card && card.parentElement; i++) {
            card = card.parentElement;
            if (card.tagName === 'A') break;
          }
          const img = card ? card.querySelector('img') : null;
          const href = card && card.tagName === 'A' ? card.getAttribute('href') : null;
          const text = card ? card.textContent : '';
          return {
            name: h3.textContent,
            hasPhoto: !!img,
            imgSrc: img ? img.src : null,
            href,
            matchesPref: text.includes(targetPref),
          };
        })
        .filter((m) => m.matchesPref && m.hasPhoto);
    }, name, pref);

    for (const m of matches) {
      results.push({
        query: name,
        name: m.name,
        url: m.href ? `${BASE}${m.href}` : null,
        imgSrc: m.imgSrc,
      });
    }
  }

  await browser.close();

  if (results.length === 0) {
    console.log(`候補が見つかりませんでした（pref=${pref}）。別の神社名を試してください。`);
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
