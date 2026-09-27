// ==UserScript==
// @name        Github Stargazers
// @namespace   https://github.com/igugyj
// @match       *://github.com/*/*
// @grant       none
// @version     1.0.0
// @author      Pfolg, DeepSeek
// @description 在仓库头部 Star 按钮旁加一个 Stargazers 按钮，点击进入 Stargazers 页面
// @license     MIT
// @icon        https://github.githubassets.com/favicons/favicon.svg
// @run-at      document-idle
// @repo        https://github.com/PfolgCodeDump/GithubStargazers
// ==/UserScript==

console.info(
  `%cRunning: ${GM_info.script.name} v${GM_info.script.version}`,
  "color: DodgerBlue",
);

const BTN_ID = "github-stargazers-btn";
const LABEL = "Stargazers";

const PEOPLE_SVG =
  '<svg data-component="Octicon" aria-hidden="true" focusable="false" ' +
  'class="octicon octicon-people" viewBox="0 0 16 16" width="16" height="16" ' +
  'fill="currentColor" display="inline-block" overflow="visible" ' +
  'style="vertical-align: text-bottom;">' +
  '<path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 ' +
  "0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 " +
  "3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 " +
  "5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 " +
  "3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 " +
  ".416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 " +
  '3.999A2 2 0 0 0 5.5 3.5Z"></path></svg>';

function getUsername(url) {
  const segs = new URL(url).pathname.split("/");
  return segs.length >= 3 ? segs[1] : null;
}
function getRepositoryname(url) {
  const segs = new URL(url).pathname.split("/");
  return segs.length >= 3 ? segs[2] : null;
}

function injectButton() {
  // 已经注入且仍在 DOM 里 → 无事可做
  if (document.getElementById(BTN_ID)) return true;

  const ul = document.querySelector('ul[data-testid="repo-header-actions"]');
  if (!ul) return false; // 不在仓库页 / 还没渲染

  const sample =
    ul.querySelector('a[data-testid="fork-button"]') ||
    ul.querySelector('a[data-component="Button"]');
  if (!sample) return false;

  const username = getUsername(location.href);
  const repo = getRepositoryname(location.href);
  if (!username || !repo) return false;

  const a = sample.cloneNode(true);
  a.id = BTN_ID;
  a.href = `/${username}/${repo}/stargazers`;
  a.removeAttribute("aria-describedby");
  a.setAttribute("data-testid", "stargazers-button");
  a.setAttribute("aria-label", `View stargazers of ${username}/${repo}`);
  a.removeAttribute("target");
  a.removeAttribute("rel");

  const oldSvg = a.querySelector("svg");
  if (oldSvg) {
    const tmp = document.createElement("div");
    tmp.innerHTML = PEOPLE_SVG;
    oldSvg.replaceWith(tmp.firstElementChild);
  }

  const label =
    a.querySelector('[data-component="text"]') ||
    a.querySelector(".prc-Button-Label-FWkx3") ||
    a.querySelector('span[data-component="buttonContent"] span:last-child');
  if (label) {
    while (label.firstChild) label.removeChild(label.firstChild);
    label.textContent = LABEL;
  }

  const li = document.createElement("li");
  li.appendChild(a);
  ul.appendChild(li);
  console.info("[Github Stargazers] button injected");
  return true;
}

/* ---------- 三层保险，防止被 SPA 换 DOM 后失效 ---------- */

// 用 rAF 节流，避免 MutationObserver 高频回调里反复 querySelector
let scheduled = false;
function scheduleInject() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    injectButton();
  });
}

// ① 立即尝试一次
injectButton();

// ② 监听 GitHub 所有可能的软导航事件 + 浏览器前进后退
[
  "turbo:load",
  "turbo:render",
  "turbo:frame-load",
  "turbo:before-render",
  "pjax:end",
  "soft-nav:end",
  "soft-nav:render",
].forEach((ev) => document.addEventListener(ev, scheduleInject));
window.addEventListener("popstate", scheduleInject);
window.addEventListener("hashchange", scheduleInject);

// ③ MutationObserver 永久挂载（不再 disconnect）
const observer = new MutationObserver(scheduleInject);
observer.observe(document.documentElement, { childList: true, subtree: true });

// ④ 轮询兜底（防止某些 React 渲染路径不触发上面的任何东西）
setInterval(scheduleInject, 1000);

// ⑤ 兜住 pushState/replaceState（Turbo 内部有时用）
["pushState", "replaceState"].forEach((fn) => {
  const orig = history[fn];
  history[fn] = function () {
    const r = orig.apply(this, arguments);
    scheduleInject();
    return r;
  };
});
