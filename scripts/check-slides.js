/**
 * posts/ 配下の全スライドを機械的にチェックするQAスクリプト。
 * - 文章がフッター（ロゴ・ページ番号）にかぶっていないか
 * - 画像が壊れていないか（読み込みに失敗していないか）
 * を自動で確認する。content.js の文章を長く書き換えた後などに実行すると安心。
 *
 * 使い方: node scripts/check-slides.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const POSTS_DIR = path.join(__dirname, '..', 'posts');

async function main() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

  const postDirs = fs.readdirSync(POSTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name).sort();

  let problems = 0;
  for (const postDir of postDirs) {
    const postPath = path.join(POSTS_DIR, postDir);
    const slideFiles = fs.readdirSync(postPath).filter(f => /^slide\d+\.html$/.test(f)).sort();
    for (const file of slideFiles) {
      const htmlPath = path.join(postPath, file);
      const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
      await page.goto(fileUrl, { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.evaluate(() => Promise.all(Array.from(document.images).map(img => img.complete ? null : new Promise(res => { img.onload = img.onerror = res; setTimeout(res, 3000); }))));

      const result = await page.evaluate(() => {
        const footer = document.querySelector('.footer-brand');
        const pageIndicator = document.querySelector('.page-indicator');
        const footerTop = footer ? footer.getBoundingClientRect().top : 1350;
        const indicatorTop = pageIndicator ? pageIndicator.getBoundingClientRect().top : 1350;
        const limit = Math.min(footerTop, indicatorTop) - 4;

        const overlaps = [];
        document.querySelectorAll('[data-text]').forEach(el => {
          if (el.closest('.footer-brand') || el.closest('.page-indicator')) return;
          const r = el.getBoundingClientRect();
          if (r.height === 0) return;
          if (r.bottom > limit) {
            overlaps.push({ text: el.textContent.trim().slice(0, 30), bottom: Math.round(r.bottom), limit: Math.round(limit) });
          }
        });

        const brokenImages = Array.from(document.images)
          .filter(img => !img.complete || img.naturalWidth === 0)
          .map(img => img.getAttribute('src'));

        return { overlaps, brokenImages };
      });

      const rel = `${postDir}/${file}`;
      if (result.overlaps.length > 0) {
        problems++;
        console.log(`[OVERLAP] ${rel}:`, JSON.stringify(result.overlaps));
      }
      if (result.brokenImages.length > 0) {
        problems++;
        console.log(`[BROKEN IMG] ${rel}:`, result.brokenImages.join(', '));
      }
    }
  }

  await browser.close();
  console.log(problems === 0 ? '\n問題は見つかりませんでした。' : `\n${problems}件の問題が見つかりました。`);
}

main().catch(e => { console.error(e); process.exit(1); });
