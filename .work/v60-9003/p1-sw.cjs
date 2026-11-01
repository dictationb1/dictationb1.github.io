/* P1 step 2 — fault-tolerant, network-first sw.js */
var p = require("./patchlib.cjs").open("sw.js", ["self.addEventListener"]);

p.rep("header-version", "(v60 / 9.0.0.1)", "(v60 / 9.0.0.3)", 1);

p.rep("version-vars",
  "var VERSION = 'sdp-v60';\nvar APP_VERSION = '9.0.0.1';",
  "var VERSION = 'sdp-v60-9.0.0.3';\nvar APP_VERSION = '9.0.0.3';\nvar SW_VERSION = 'sdp-v60-9.0.0.3';\nvar MEDIA_MAX_ENTRIES = 160;",
  1);

/* isFreshAsset helper next to isMedia */
p.rep("fresh-helper",
  "function isMedia(url) {",
  "function isFreshAsset(url) {\n  return /\\.(html|js|json)(\\?|$)/i.test(url) || /\\/$/.test(url);\n}\nfunction isMedia(url) {",
  1);

/* fault-tolerant install */
var installOld = [
  "self.addEventListener('install', function (event) {",
  "  event.waitUntil(",
  "    caches.open(CACHE)",
  "      .then(function (cache) { return cache.addAll(SHELL); })",
  "      .then(function () { return self.skipWaiting(); })",
  "      .catch(function () { return self.skipWaiting(); })",
  "  );",
  "});"
].join("\n");
var installNew = [
  "self.addEventListener('install', function (event) {",
  "  event.waitUntil(",
  "    caches.open(CACHE).then(function (cache) {",
  "      return Promise.all(SHELL.map(function (u) {",
  "        return fetch(u, { cache: 'reload' }).then(function (r) {",
  "          return r && r.ok ? cache.put(u, r) : null;",
  "        })['catch'](function () { return null; });",
  "      }));",
  "    }).then(function () { return self.skipWaiting(); })['catch'](function () { return self.skipWaiting(); })",
  "  );",
  "});"
].join("\n");
p.rep("install", installOld, installNew, 1);

/* cache eviction on activate */
p.rep("activate-filter",
  "        return k !== CACHE && k !== MEDIA_CACHE && k !== 'sdp-youdao-v1';",
  "        if (k === 'sdp-youdao-v1') return false;\n        return k.indexOf('9.0.0.3') === -1;",
  1);
p.rep("activate-prune", "pruneMediaCache(cache, 40);", "pruneMediaCache(cache, MEDIA_MAX_ENTRIES);", 1);

/* network-first for navigation + html/js/json */
var netFirst = [
  "  if (req.mode === 'navigate' || isFreshAsset(url.pathname + url.search)) {",
  "    event.respondWith(",
  "      safeFetch(req, { cache: 'no-cache' }).then(function (resp) {",
  "        if (resp && resp.status === 200) {",
  "          try {",
  "            var copy = resp.clone();",
  "            caches.open(CACHE).then(function (cache) { return cache.put(req, copy); })['catch'](function () { return null; });",
  "          } catch (err) {}",
  "        }",
  "        return resp;",
  "      })['catch'](function () {",
  "        return caches.match(req).then(function (hit) {",
  "          if (hit) return hit;",
  "          return caches.match('./index.html').then(function (shell) { return shell || Response.error(); });",
  "        });",
  "      })",
  "    );",
  "    return;",
  "  }",
  "",
  "  if (isMedia(req.url)) {"
].join("\n");
p.rep("fetch-network-first", "  if (isMedia(req.url)) {", netFirst, 1);

p.save(20000);
