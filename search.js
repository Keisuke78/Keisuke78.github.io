// サイト内簡易検索
// トップバーの「検索」をクリックすると入力欄が開き、
// 全ページを取得してテキスト一致を探し、結果一覧から該当ページへ飛ぶ。
// 遷移先では ?q= パラメータを見て一致箇所をハイライトする。

(function () {
  var EN = document.documentElement.lang === "en";
  var PAGES = [
    { url: "index.html", title: "Home" },
    { url: "research.html", title: EN ? "Research" : "研究" },
    { url: "presentations.html", title: EN ? "Presentations" : "発表" },
    { url: "cv.html", title: EN ? "CV" : "経歴" },
    { url: "music.html", title: EN ? "Music" : "音楽" },
    { url: "books.html", title: EN ? "Books" : "本" }
  ];
  var MSG = {
    toggle: EN ? "🔍 Search" : "🔍 検索",
    placeholder: EN ? "Search this site…" : "サイト内検索…",
    notFound: EN ? "No results for " : "「",
    notFoundEnd: EN ? "" : "」は見つかりませんでした",
    needsHttp: EN
      ? "Search only works when the site is served over http"
      : "検索はサーバー経由(http)で開いたときのみ使えます"
  };

  document.addEventListener("DOMContentLoaded", function () {
    setupSearchUI();
    highlightFromQuery();
  });

  function setupSearchUI() {
    var topbar = document.querySelector(".topbar");
    if (!topbar) return;

    topbar.innerHTML =
      '<button type="button" class="search-toggle">' + MSG.toggle + "</button>" +
      '<form class="search-form" hidden>' +
      '<input type="search" class="search-input" placeholder="' + MSG.placeholder + '" aria-label="' + MSG.placeholder + '">' +
      "</form>" +
      '<ul class="search-results" hidden></ul>';

    var toggle = topbar.querySelector(".search-toggle");
    var form = topbar.querySelector(".search-form");
    var input = topbar.querySelector(".search-input");
    var results = topbar.querySelector(".search-results");

    toggle.addEventListener("click", function () {
      form.hidden = !form.hidden;
      if (!form.hidden) {
        input.focus();
      } else {
        results.hidden = true;
      }
    });

    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        runSearch(input.value.trim(), results);
      }, 300);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearTimeout(timer);
      runSearch(input.value.trim(), results);
    });
  }

  function runSearch(query, results) {
    if (!query) {
      results.hidden = true;
      results.innerHTML = "";
      return;
    }

    if (location.protocol === "file:") {
      results.innerHTML =
        '<li class="search-note">' + MSG.needsHttp + "</li>";
      results.hidden = false;
      return;
    }

    Promise.all(
      PAGES.map(function (page) {
        return fetch(page.url)
          .then(function (res) { return res.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, "text/html");
            var parts = doc.querySelectorAll("main, .hero-caption, .hero-text");
            var text = Array.prototype.map
              .call(parts, function (el) { return el.textContent; })
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            var idx = text.toLowerCase().indexOf(query.toLowerCase());
            if (idx === -1) return null;
            var start = Math.max(0, idx - 30);
            var snippet =
              (start > 0 ? "…" : "") +
              text.slice(start, idx + query.length + 40) +
              "…";
            return { page: page, snippet: snippet };
          })
          .catch(function () { return null; });
      })
    ).then(function (hits) {
      hits = hits.filter(Boolean);
      if (hits.length === 0) {
        results.innerHTML =
          '<li class="search-note">' + MSG.notFound + escapeHtml(query) + MSG.notFoundEnd + "</li>";
      } else {
        results.innerHTML = hits
          .map(function (hit) {
            return (
              '<li><a href="' + hit.page.url + "?q=" + encodeURIComponent(query) + '">' +
              "<strong>" + escapeHtml(hit.page.title) + "</strong> — " +
              escapeHtml(hit.snippet) +
              "</a></li>"
            );
          })
          .join("");
      }
      results.hidden = false;
    });
  }

  // ?q= 付きで開かれたら本文中の一致箇所を <mark> でハイライト
  function highlightFromQuery() {
    var query = new URLSearchParams(location.search).get("q");
    if (!query) return;
    var roots = document.querySelectorAll("main, .hero-caption");
    var nodes = [];
    Array.prototype.forEach.call(roots, function (root) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode);
    });

    var lower = query.toLowerCase();
    var first = null;
    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var idx = text.toLowerCase().indexOf(lower);
      if (idx === -1) return;
      var mark = document.createElement("mark");
      var after = node.splitText(idx);
      after.splitText(query.length);
      mark.textContent = after.nodeValue;
      after.parentNode.replaceChild(mark, after);
      if (!first) first = mark;
    });
    if (first) first.scrollIntoView({ block: "center" });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
