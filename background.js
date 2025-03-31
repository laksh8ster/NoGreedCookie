const VERSION = "1.3";

browser.webRequest.onBeforeRequest.addListener(
  details => {
    const thirdPartyTrackers = [
      "doubleclick.net", "google-analytics.com", "adservice.google.com",
      "chartbeat.com", "facebook.com/tr", "twitter.com/i/jot"
    ];
    const url = new URL(details.url);
    if (thirdPartyTrackers.some(domain => url.hostname.includes(domain))) {
      return {cancel: true};
    }
  },
  {urls: ["<all_urls>"], types: ["script", "image"]},
  ["blocking"]
);

browser.webNavigation.onCommitted.addListener(
  function(details) {
    if (details.frameId !== 0) return;

    browser.storage.local.clear();
    let logDump = [`CC: v${VERSION} Navigated to: ${details.url}`];

    browser.cookies.getAll({url: details.url}).then(cookies => {
      if (!cookies || cookies.length === 0) {
        logDump.push("CC: No cookies found for " + details.url);
        browser.storage.local.set({kept: [], blocked: [], cookies: [], logs: logDump});
        return;
      }

      logDump.push(`CC: Found ${cookies.length} cookies`);
      let kept = [], blocked = [], allowed = [];

      const isFBLogin = details.url.includes("facebook.com") &&
      !details.url.match(/facebook\.com\/(home|profile|friends|groups)/);
      const fbLoginCookies = ["c_user", "xs", "sb", "presence", "datr"];

      cookies.forEach(cookie => {
        let cookieInfo =
        `CC: Cookie: ${cookie.name}, Session: ${cookie.session || "false"}, ` +
        `Expires: ${cookie.expirationDate || "none"}, Value: ${cookie.value ? "set" : "unset"}`;
        logDump.push(cookieInfo);

        const trackerPatterns = [
          "_ga", "_fbp", "ad", "_utm", "_gid", "guest_id", "personalization_id", "twid",
          "__cf_bm", "gt", "ct0", "_gcl", "_parsely", "pbjs", "_tt", "_ttp",
          "fr", "nid", "dpr", "wd", "ubid", "blaize", "lr", "vm", "csm", "datr",
          "track", "analytics", "chartbeat", "gads", "gpi", "eoi", "mvt", "_octo" // Added
        ];
        if (trackerPatterns.some(pattern => cookie.name.toLowerCase().includes(pattern)) &&
          !(isFBLogin && fbLoginCookies.includes(cookie.name))) {
          let removed = browser.cookies.remove({url: details.url, name: cookie.name});
        removed.then(
          () => {
            logDump.push(`CC: Blocked: ${cookie.name} (Tracker)`);
            blocked.push(cookie.name);
          },
          error => logDump.push(`CC: Failed to block ${cookie.name}: ${error}`)
        );
        return;
          }

          const sessionHints = ["session", "token", "sb", "auth", "id_pk", "csrf", "presence"];
          if (!cookie.expirationDate || cookie.session ||
            sessionHints.some(hint => cookie.name.toLowerCase().includes(hint)) ||
            (isFBLogin && fbLoginCookies.includes(cookie.name))) {
            logDump.push(`CC: Kept: ${cookie.name} (Session-like)`);
          kept.push(cookie.name);
          return;
            }

            if (WHITELIST.cookies.includes(cookie.name)) {
              logDump.push(`CC: Kept: ${cookie.name} (Whitelisted)`);
              kept.push(cookie.name);
              return;
            }

            logDump.push(`CC: Allowed: ${cookie.name} (Functional?)`);
            allowed.push(cookie.name);
      });

      setTimeout(() => {
        browser.storage.local.set({
          kept,
          blocked,
          cookies: allowed,
          logs: logDump
        }).then(
          () => logDump.push(`CC: Stored: Kept=${kept.length}, Blocked=${blocked.length}, Allowed=${allowed.length}`),
                error => logDump.push(`CC: Storage error: ${error}`)
        );
      }, 100);
    }, error => {
      logDump.push(`CC: Cookie fetch error for ${details.url}: ${error}`);
      browser.storage.local.set({kept: [], blocked: [], cookies: [], logs: logDump});
    });
  },
  {url: [{schemes: ["http", "https"]}]}
);

browser.tabs.onRemoved.addListener(tabId => {
  browser.storage.local.clear();
});

browser.runtime.onSuspend.addListener(() => {
  browser.storage.local.clear();
});
