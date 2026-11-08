/**
 * 投稿の在庫（manifest.json の status:"ready"）が減ったら、次の投稿を自動で作るスクリプト。
 * GitHub Actions（.github/workflows/auto-create-posts.yml）から毎日呼ばれる。
 *
 * 1組 = 3県の地域紹介 ＋ その3県の神社様募集 ＝ 4投稿（これまでの ㉖〜㉙ と同じ形）。
 * 作る順番と、検索に使う神社名の候補は scripts/auto-plan.json に書いてある。
 *
 * 素材の原則（README の「素材の原則」と同じ）:
 *  - 画面はすべて、実際の公開アプリ（https://shrine-map-zeta.vercel.app）で撮影した本物
 *  - 神社は実際にアプリで検索して見つかり、その県のもので、写真が表示されるものだけを使う
 *  - 見つからない・写真が出ない県は飛ばして次の組へ（推測で埋めない）
 *  - 文章は既存投稿と同じ雛形。数字や由緒など、アプリで確認できない情報は書かない
 *
 * 使い方:
 *   node scripts/auto-create-posts.js            在庫が MIN_STOCK 未満なら作る（既定 8）
 *   MIN_STOCK=12 node scripts/auto-create-posts.js
 *   node scripts/auto-create-posts.js --force    在庫に関係なく1組作る
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://shrine-map-zeta.vercel.app';
const MANIFEST_PATH = path.join(ROOT, 'posts', 'manifest.json');
const PLAN_PATH = path.join(__dirname, 'auto-plan.json');
const TEMPLATES = path.join(ROOT, 'templates');
const MAP_SOURCE = path.join(ROOT, 'assets', 'images', 'post4_tokyo-shrines', 'slide2-map.jpg');

// ---------------------------------------------------------------
// 文章（既存の投稿㉖〜㉙と同じ雛形）
// ---------------------------------------------------------------

function circled(n) {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21);
  if (n >= 36 && n <= 50) return String.fromCodePoint(0x32b1 + n - 36);
  return String(n);
}

function hashtagWord(s) {
  return s.replace(/[\s#・、。,.()（）「」『』]/g, '');
}

function regionContentJs(id, entry, shrine) {
  return `/**
 * 投稿${circled(id)} 「${entry.pref}の神社、何社知っていますか？」
 * 目的：神社アプリそのものを知ってもらう（地域紹介シリーズ・${entry.short}編）
 *
 * 2〜4枚目の画像は、すべて実際のアプリ
 * （https://shrine-map-zeta.vercel.app）のスクリーンショットです。
 * 検索は実際に「${shrine.query}」で検索した結果をそのまま使用しています。
 * （scripts/auto-create-posts.js で自動作成）
 */
const CONTENT = {
  series: '${entry.short} 神社めぐり',

  slide1: {
    title: '${entry.pref}の神社、\\n何社知っていますか？',
    subtitle: '地図を開くと、\\nまだ知らない神社に\\n出会えるかもしれません。',
    swipe_hint: 'スワイプしてチェック',
  },

  slide2: {
    heading: '行きたい神社、\\nまだ知らないだけかもしれません。',
    screenshot_note: '実際のアプリ画面（地図）',
  },

  slide3: {
    heading: '名前から探す。\\n地図から探す。\\n気になる神社を見つける。',
    screenshot_note: '実際のアプリ画面（検索結果）',
    coverage_note: '掲載社寺は順次追加中です',
  },

  slide4: {
    heading: '神社を見つける。\\n参拝する。\\n記録する。',
    closing: '神社めぐりを、もっと身近に。',
    screenshot_note: '実際のアプリ画面（神社詳細）',
  },
};
`;
}

function regionManifest(id, folder, entry, shrine) {
  return {
    id,
    exportFolder: `post${id}`,
    folder,
    type: 'region',
    topic: `${entry.pref}の神社、何社知っていますか？`,
    status: 'ready',
    caption:
      `${entry.pref}には、まだ知らない神社があるかもしれません。\n\n` +
      '地図を開いて、気になる神社を探してみませんか。\n' +
      '名前からでも、地図からでも、気になる神社を見つけられます。\n\n' +
      `今回の画面は、実際に「${shrine.query}」で検索した様子です。\n` +
      '気になる神社と出会えたら、保存しておいてくださいね。',
    hashtags: [
      '#神社', '#神社めぐり', '#神社巡り', '#御朱印', '#御朱印巡り', '#御朱印帳',
      `#${entry.short}神社`, `#${hashtagWord(shrine.query)}`, `#${entry.short}観光`, `#${entry.short}お出かけ`,
      `#${entry.short}神社めぐり`, '#パワースポット', '#国内旅行', '#お出かけスポット',
      '#神社アプリ', '#JinjaApp', '#shrine', '#japan', `#${entry.tag}`,
    ].join(' '),
    queueHint: { prefecture: entry.pref, prefectureTag: entry.tag },
    autoCreated: true,
    shrineUrl: shrine.url,
  };
}

function boshuContentJs(id, group, regionIds, shrines) {
  const names = group.map((e) => e.short).join('・');
  // 表紙は1行10文字ほどで折り返すので、長いときは県名の途中で切れないよう先に改行する
  const titleNames =
    names.length + 1 > 10 ? group.slice(0, -1).map((e) => e.short).join('・') + '・\\n' + group[group.length - 1].short : names;
  return `/**
 * 投稿${circled(id)} 「${names}の神社様へ。」
 * 目的：神社様からDMで問い合わせをいただくこと
 *
 * 2・3枚目の画像は、すべて実際のアプリ
 * （https://shrine-map-zeta.vercel.app）のスクリーンショットです。
 * 画像は投稿${circled(regionIds[0])}（${shrines[0].name}）・${circled(regionIds[2])}（${shrines[2].name}）の神社詳細と、投稿④の地図を再利用します。
 * （scripts/auto-create-posts.js で自動作成）
 */
const CONTENT = {
  series: '電子御朱印 パートナー募集',

  slide1: {
    title: '${titleNames}の\\n神社様へ。',
    subtitle: '一緒に、新しい電子御朱印の形を\\n作りませんか？',
    swipe_hint: 'スワイプしてチェック',
  },

  slide2: {
    heading: '神社の情報を、\\n参拝者にもっと届ける。',
    screenshot_note: '実際のアプリ画面（神社詳細）',
    growth_note: '掲載後の情報は、神社様と一緒に育てていきます。',
  },

  slide3: {
    heading: '見つけてもらう。\\n訪れてもらう。\\nそして、参拝の記録を残してもらう。',
    caption_left: '地図で見つける',
    caption_right: '神社の情報を届ける',
  },

  slide4: {
    heading: 'まずは、\\nお話だけでも大歓迎です。',
    item1: '電子御朱印に興味がある',
    item2: 'アプリへの掲載について聞きたい',
    item3: '新しい参拝者との接点を作りたい',
    dm_line: 'そんな神社様は、\\nお気軽にDMください。',
    dm_button: 'DMください',
    closing: '神社様と一緒に、\\n新しい神社めぐりの形を作りたい。',
  },
};
`;
}

function boshuManifest(id, folder, group, regionIds) {
  const names = group.map((e) => e.short).join('・');
  return {
    id,
    exportFolder: `post${id}`,
    folder,
    type: 'boshu',
    topic: `${names}の神社様へ。`,
    status: 'ready',
    caption:
      `${names}の神社様へ。\n\n` +
      '神社の情報を、参拝者にもっと届けませんか。\n' +
      '地図で見つけてもらい、訪れてもらい、参拝の記録を残してもらう。\n' +
      '掲載後の情報は、神社様と一緒に育てていきます。\n\n' +
      '・電子御朱印に興味がある\n・アプリへの掲載について聞きたい\n・新しい参拝者との接点を作りたい\n\n' +
      'そんな神社様は、お気軽にDMください。\n' +
      '新しい神社めぐりの形を、一緒に作っていけたら嬉しいです。',
    hashtags: [
      '#神社', '#神社様', ...group.map((e) => `#${e.short}神社`),
      '#電子御朱印', '#御朱印', '#神社関係者', '#神社アプリ', '#JinjaApp', '#神社DX', '#パートナー募集', '#社務所', '#神社めぐり',
    ].join(' '),
    queueHint: { regions: group.map((e) => e.short), referencePosts: regionIds },
    autoCreated: true,
  };
}

// ---------------------------------------------------------------
// ファイルの組み立て
// ---------------------------------------------------------------

function fillTemplate(kind, vars) {
  const dir = path.join(TEMPLATES, kind);
  const out = {};
  for (const file of fs.readdirSync(dir).filter((f) => /^slide\d+\.html$/.test(f))) {
    out[file] = fs
      .readFileSync(path.join(dir, file), 'utf8')
      .replace(/\{\{FOLDER\}\}/g, vars.folder)
      .replace(/\{\{NUM\}\}/g, circled(vars.id))
      .replace(/\{\{SHRINE\}\}/g, vars.shrine);
  }
  return out;
}

function writePost(folder, slides, contentJs) {
  const dir = path.join(ROOT, 'posts', folder);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, html] of Object.entries(slides)) fs.writeFileSync(path.join(dir, file), html);
  fs.writeFileSync(path.join(dir, 'content.js'), contentJs);
}

function buildRegionPost(id, entry, shrine) {
  const folder = `post${id}_${entry.tag}-shrines`;
  writePost(folder, fillTemplate('region', { folder, id, shrine: shrine.name }), regionContentJs(id, entry, shrine));
  const img = path.join(ROOT, 'assets', 'images', folder);
  fs.mkdirSync(img, { recursive: true });
  fs.copyFileSync(MAP_SOURCE, path.join(img, 'slide2-map.jpg'));
  fs.writeFileSync(path.join(img, 'slide3-search.jpg'), shrine.searchShot);
  fs.writeFileSync(path.join(img, 'slide4-detail.jpg'), shrine.detailShot);
  fs.writeFileSync(
    path.join(img, 'README.md'),
    `# 投稿${circled(id)}で使用する画像（実際のアプリ画面）\n\n` +
      'すべて実際の公開アプリ（https://shrine-map-zeta.vercel.app）から取得した画面（scripts/auto-create-posts.js で自動取得）。\n\n' +
      '| ファイル名 | 使用スライド | 内容 |\n|---|---|---|\n' +
      '| `slide2-map.jpg` | 2枚目 | 地図画面（全国表示、投稿④と共通） |\n' +
      `| \`slide3-search.jpg\` | 3枚目 | 「${shrine.query}」の検索結果カード |\n` +
      `| \`slide4-detail.jpg\` | 4枚目 | ${shrine.name}の神社詳細画面（${shrine.url}） |\n`
  );
  return folder;
}

function buildBoshuPost(id, group, regionIds, regionFolders, shrines) {
  const folder = `post${id}_${group.map((e) => e.tag).join('-')}-boshu`;
  writePost(folder, fillTemplate('boshu', { folder, id, shrine: shrines[0].name }), boshuContentJs(id, group, regionIds, shrines));
  const img = path.join(ROOT, 'assets', 'images', folder);
  const src = (f) => path.join(ROOT, 'assets', 'images', f, 'slide4-detail.jpg');
  fs.mkdirSync(img, { recursive: true });
  fs.copyFileSync(src(regionFolders[0]), path.join(img, 'slide2-detail.jpg'));
  fs.copyFileSync(MAP_SOURCE, path.join(img, 'slide3-map.jpg'));
  fs.copyFileSync(src(regionFolders[2]), path.join(img, 'slide3-detail.jpg'));
  fs.writeFileSync(
    path.join(img, 'README.md'),
    `# 投稿${circled(id)}で使用する画像（実際のアプリ画面）\n\n` +
      `投稿${circled(regionIds[0])}・${circled(regionIds[2])}・④の画像を再利用する。\n\n` +
      '| ファイル名 | 使用スライド | 内容 | コピー元 |\n|---|---|---|---|\n' +
      `| \`slide2-detail.jpg\` | 2枚目 | ${shrines[0].name}の神社詳細画面 | ${regionFolders[0]}/slide4-detail.jpg |\n` +
      '| `slide3-map.jpg` | 3枚目（左） | 地図画面（全国表示） | post4_tokyo-shrines/slide2-map.jpg |\n' +
      `| \`slide3-detail.jpg\` | 3枚目（右） | ${shrines[2].name}の神社詳細画面 | ${regionFolders[2]}/slide4-detail.jpg |\n`
  );
  return folder;
}

// ---------------------------------------------------------------
// 実際のアプリで神社を探して撮影する
// ---------------------------------------------------------------

async function findAndShoot(page, entry) {
  for (const query of entry.candidates) {
    await page.goto(`${BASE}/search`, { waitUntil: 'networkidle0' });
    await sleep(400);
    const inputs = await page.$$('input');
    const searchInput = inputs[inputs.length - 1];
    await searchInput.click();
    await searchInput.type(query, { delay: 30 });
    await sleep(1500);
    await waitForImages(page);

    // その県の、写真つきの検索結果カードを探す
    const match = await page.evaluate((q, pref, tag) => {
      const h3s = Array.from(document.querySelectorAll('h3')).filter((el) => el.textContent.includes(q.slice(0, 3)));
      for (const h3 of h3s) {
        let card = h3;
        for (let i = 0; i < 6 && card && card.parentElement; i++) {
          card = card.parentElement;
          if (card.tagName === 'A') break;
        }
        if (!card || card.tagName !== 'A') continue;
        const text = card.textContent;
        const img = card.querySelector('img');
        const inPref = text.includes(pref) || new RegExp('\\b' + tag + '\\b', 'i').test(text);
        if (!inPref || !img || !img.naturalWidth) continue;
        const r = card.getBoundingClientRect();
        return { name: h3.textContent.trim(), href: card.getAttribute('href'), top: r.top, bottom: r.bottom };
      }
      return null;
    }, query, entry.pref, entry.tag);

    if (!match || !match.href) {
      console.log(`  - 「${query}」: ${entry.pref}の写真つきの結果なし`);
      continue;
    }

    const top = Math.max(0, match.top - 8);
    const height = Math.min(300, match.bottom - match.top + 16);
    const searchShot = await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: 0, y: top, width: 430, height } });

    const url = new URL(match.href, BASE).toString();
    await page.goto(url, { waitUntil: 'networkidle0' });
    await sleep(800);
    await waitForImages(page);
    const detail = await page.evaluate((pref, short, tag) => {
      const imgs = Array.from(document.images).filter((img) => img.getBoundingClientRect().top < 580);
      const broken = imgs.filter((img) => !img.naturalWidth).length;
      const photo = imgs.some((img) => img.naturalWidth && img.getBoundingClientRect().width >= 200);
      const text = document.body.innerText;
      const inPref = text.includes(pref) || text.includes(short) || new RegExp('\\b' + tag + '\\b', 'i').test(text);
      return { broken, photo, inPref };
    }, entry.pref, entry.short, entry.tag);
    if (detail.broken || !detail.photo || !detail.inPref) {
      console.log(`  - 「${query}」: 詳細画面が使えない（壊れた画像 ${detail.broken} / 写真 ${detail.photo} / 県名 ${detail.inPref}）`);
      continue;
    }
    const detailShot = await page.screenshot({ type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 430, height: 580 } });
    console.log(`  ✓ ${entry.pref}: 「${query}」→ ${match.name}（${url}）`);
    return { query, name: match.name, url, searchShot, detailShot };
  }
  return null;
}

// ---------------------------------------------------------------
// 書き出し・チェック（export-to-png.js / check-slides.js と同じ処理を、新しい投稿だけに）
// ---------------------------------------------------------------

async function exportAndCheck(browser, folders) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  const problems = [];
  for (const folder of folders) {
    const postPath = path.join(ROOT, 'posts', folder);
    const outDir = path.join(ROOT, 'export', folder.match(/^post\d+/)[0]);
    fs.mkdirSync(outDir, { recursive: true });
    for (const file of fs.readdirSync(postPath).filter((f) => /^slide\d+\.html$/.test(f)).sort()) {
      await page.goto('file://' + path.join(postPath, file), { waitUntil: 'networkidle0' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await waitForImages(page);
      const result = await page.evaluate(() => {
        const footer = document.querySelector('.footer-brand');
        const indicator = document.querySelector('.page-indicator');
        const limit = Math.min(footer ? footer.getBoundingClientRect().top : 1350, indicator ? indicator.getBoundingClientRect().top : 1350) - 4;
        const overlaps = [];
        document.querySelectorAll('[data-text]').forEach((el) => {
          if (el.closest('.footer-brand') || el.closest('.page-indicator')) return;
          const r = el.getBoundingClientRect();
          if (r.height > 0 && r.bottom > limit) overlaps.push(el.textContent.trim().slice(0, 30));
        });
        const empty = Array.from(document.querySelectorAll('[data-text]')).filter((el) => !el.textContent.trim()).length;
        const broken = Array.from(document.images).filter((img) => !img.complete || !img.naturalWidth).map((img) => img.getAttribute('src'));
        return { overlaps, empty, broken };
      });
      if (result.overlaps.length) problems.push(`${folder}/${file} 文字がフッターにかぶっている: ${result.overlaps.join(' / ')}`);
      if (result.empty) problems.push(`${folder}/${file} 文章が入っていない欄が ${result.empty} 個`);
      if (result.broken.length) problems.push(`${folder}/${file} 画像が壊れている: ${result.broken.join(', ')}`);
      const slideEl = await page.$('.slide');
      if (!slideEl) {
        problems.push(`${folder}/${file} .slide が見つからない`);
        continue;
      }
      await slideEl.screenshot({ path: path.join(outDir, file.replace('.html', '.png')) });
    }
  }
  await page.close();
  return problems;
}

function removeCreated(folders) {
  for (const folder of folders) {
    for (const dir of [
      path.join(ROOT, 'posts', folder),
      path.join(ROOT, 'assets', 'images', folder),
      path.join(ROOT, 'export', folder.match(/^post\d+/)[0]),
    ]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------

async function main() {
  const force = process.argv.includes('--force');
  const minStock = Number(process.env.MIN_STOCK || 8);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));

  let ready = manifest.posts.filter((p) => p.status === 'ready').length;
  console.log(`ready の在庫: ${ready} 件（目標 ${minStock} 件以上）`);
  if (!force && ready >= minStock) {
    console.log('在庫は足りているので、何もしません。');
    return;
  }

  const usedPrefs = new Set(manifest.posts.map((p) => p.queueHint && p.queueHint.prefecture).filter(Boolean));
  const groups = plan.groups.filter((g) => g.every((e) => !usedPrefs.has(e.pref)));
  if (groups.length === 0) {
    console.error('auto-plan.json の地域をすべて使い切りました。scripts/auto-plan.json に次の地域を追加してください。');
    process.exit(2);
  }

  const puppeteer = require('puppeteer');
  // GitHub Actions の Ubuntu では Chrome のサンドボックスが使えないので外す
  const browser = await puppeteer.launch({ args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [] });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 });

  const created = [];
  const skipped = [];
  let nextId = Math.max(...manifest.posts.map((p) => p.id)) + 1;

  for (const group of groups) {
    if (!force && ready >= minStock) break;
    if (force && created.length > 0) break;
    console.log(`\n組: ${group.map((e) => e.pref).join('・')}`);

    const shrines = [];
    for (const entry of group) {
      const shrine = await findAndShoot(page, entry);
      if (!shrine) break;
      shrines.push(shrine);
    }
    if (shrines.length < group.length) {
      const missing = group[shrines.length].pref;
      console.log(`  → ${missing}で使える神社が見つからなかったので、この組は飛ばします`);
      skipped.push(`${group.map((e) => e.short).join('・')}（${missing}で、写真つきの神社がアプリで見つからなかった）`);
      continue;
    }

    const regionIds = group.map((_, i) => nextId + i);
    const regionFolders = group.map((entry, i) => buildRegionPost(regionIds[i], entry, shrines[i]));
    const boshuId = nextId + 3;
    const boshuFolder = buildBoshuPost(boshuId, group, regionIds, regionFolders, shrines);
    const folders = [...regionFolders, boshuFolder];

    const problems = await exportAndCheck(browser, folders);
    if (problems.length) {
      removeCreated(folders);
      await browser.close();
      console.error('\n自動チェックで問題が見つかったので、この組は作りませんでした:\n' + problems.join('\n'));
      process.exit(1);
    }

    group.forEach((entry, i) => manifest.posts.push(regionManifest(regionIds[i], regionFolders[i], entry, shrines[i])));
    manifest.posts.push(boshuManifest(boshuId, boshuFolder, group, regionIds));
    created.push(...folders);
    nextId += 4;
    ready += 4;
  }

  await browser.close();

  if (created.length) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  }

  const summary = [
    `作成した投稿: ${created.length} 件${created.length ? '（' + created.join(', ') + '）' : ''}`,
    `ready の在庫: ${ready} 件`,
    ...(skipped.length ? ['飛ばした組:', ...skipped.map((s) => '- ' + s)] : []),
  ].join('\n');
  console.log('\n' + summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `created=${created.length}\nskipped=${skipped.length}\n`);
  }
  if (!created.length && !force && ready < minStock) {
    console.error('\n在庫が足りないのに、新しい投稿を作れませんでした。');
    process.exit(3);
  }
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

module.exports = { circled, regionContentJs, boshuContentJs, regionManifest, boshuManifest, buildRegionPost, buildBoshuPost, exportAndCheck };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
