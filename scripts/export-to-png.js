/**
 * posts/ 配下の各 slideN.html を 1080x1350px の PNG として export/ に書き出す。
 *
 * 使い方:
 *   1. npm install        （初回のみ。puppeteer をダウンロードする）
 *   2. npm run export
 *
 * 出力先: export/post1/slideN.png, export/post2/slideN.png, export/post3/slideN.png
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const EXPORT_DIR = path.join(__dirname, '..', 'export');

async function main() {
  const postDirs = fs
    .readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  if (postDirs.length === 0) {
    console.log('posts/ 配下に投稿フォルダが見つかりませんでした。');
    return;
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

  for (const postDir of postDirs) {
    const postPath = path.join(POSTS_DIR, postDir);
    const slideFiles = fs
      .readdirSync(postPath)
      .filter((f) => /^slide\d+\.html$/.test(f))
      .sort();

    if (slideFiles.length === 0) continue;

    // export/ 配下は post1 / post2 / post3 のような短い名前にする
    const shortName = (postDir.match(/^post\d+/) || [postDir])[0];
    const outDir = path.join(EXPORT_DIR, shortName);
    fs.mkdirSync(outDir, { recursive: true });

    for (const file of slideFiles) {
      const htmlPath = path.join(postPath, file);
      const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');

      await page.goto(fileUrl, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.evaluate(() =>
        Promise.all(
          Array.from(document.images).map((img) =>
            img.complete ? null : new Promise((res) => { img.onload = img.onerror = res; })
          )
        )
      );

      const slideEl = await page.$('.slide');
      if (!slideEl) {
        console.warn(`  [skip] .slide 要素が見つかりません: ${file}`);
        continue;
      }

      const outFile = path.join(outDir, file.replace('.html', '.png'));
      await slideEl.screenshot({ path: outFile });
      console.log(`  [ok] ${shortName}/${file} -> ${path.relative(process.cwd(), outFile)}`);
    }
  }

  await browser.close();
  console.log('\n完了しました。export/ フォルダを確認してください。');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
