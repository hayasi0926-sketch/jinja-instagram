/**
 * 共通テキスト適用スクリプト。
 * 各投稿フォルダの content.js が定義する CONTENT オブジェクトから、
 * <body data-slide="slide1"> の値を読み取り、
 * data-text="slide1.title" のような属性を持つ要素へ流し込む。
 *
 * 文章を変えたいときはこのファイルではなく、
 * 各投稿フォルダ内の content.js を編集する。
 */
(function () {
  function getPath(obj, path) {
    return path.split('.').reduce(function (acc, key) {
      return acc == null ? undefined : acc[key];
    }, obj);
  }

  function applyContent() {
    if (typeof CONTENT === 'undefined') return;

    var slideKey = document.body.getAttribute('data-slide');
    var slideData = CONTENT[slideKey] || {};

    document.querySelectorAll('[data-text]').forEach(function (el) {
      var path = el.getAttribute('data-text');
      // まずそのスライド専用のデータを探し、無ければ CONTENT 直下
      // （例：series のようにスライド共通の値）を探す。
      var value = getPath(slideData, path);
      if (value === undefined) value = getPath(CONTENT, path);
      if (value !== undefined && value !== null) {
        el.textContent = value;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyContent);
  } else {
    applyContent();
  }
})();
