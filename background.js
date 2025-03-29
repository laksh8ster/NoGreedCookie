browser.webNavigation.onCommitted.addListener(
  function(details) {
    if (details.frameId !== 0) return;

    browser.storage.local.clear();
    let logDump = ["CC: Navigated to: " + details.url];

    browser.cookies.getAll({url: details.url}).then(cookies => {
      if (!cookies || cookies.length === 0) {
        logDump.push("CC: No cookies found for " + details.url);
        browser.storage.local.set({kept: [], blocked: [], cookies: [], logs: logDump});
        return;
      }

      logDump.push("CC: Found " + cookies.length + " cookies");
      let kept = [], blocked = [], allowed = [];

      cookies.forEach(cookie => {
        let cookieInfo =
        "CC: Cookie: " + cookie.name +
        ", Session: " + (cookie.session || "false") +
        ", Expires: " + (cookie.expirationDate || "none") +
        ", Value: " + (cookie.value ? "set" : "unset");
        logDump.push(cookieInfo);

        // Tracker check first
        const trackerPatterns = [
          "_ga", "_fbp", "ad", "_utm", "_gid", "guest_id", "personalization_id", "twid",
          "__cf_bm", "gt", "ct0", "_gcl", "_parsely", "pbjs", "_tt", "_ttp",
          "fr", "nid", "dpr", "wd", "ubid", "blaize", "lr", "vm", "csm", "datr",
          "track", "analytics"
        ];
        if (trackerPatterns.some(pattern => cookie.name.toLowerCase().includes(pattern))) {
          let removed = browser.cookies.remove({url: details.url, name: cookie.name});
          removed.then(
            () => {
              logDump.push("CC: Blocked: " + cookie.name + " (Tracker)");
              blocked.push(cookie.name);
            },
            error => {
              logDump.push("CC: Failed to block " + cookie.name + ": " + error);
            }
          );
          return;
        }

        // Session check
        const sessionHints = ["session", "token", "sb", "auth", "id_pk", "csrf"];
        if (!cookie.expirationDate || cookie.session ||
          sessionHints.some(hint => cookie.name.toLowerCase().includes(hint))) {
          logDump.push("CC: Kept: " + cookie.name + " (Session-like)");
        kept.push(cookie.name);
        return;
          }

          // Whitelist override
          if (WHITELIST.cookies.includes(cookie.name)) {
            logDump.push("CC: Kept: " + cookie.name + " (Whitelisted)");
            kept.push(cookie.name);
            return;
          }

          // Anything else is allowed
          logDump.push("CC: Allowed: " + cookie.name + " (Functional?)");
          allowed.push(cookie.name);
      });

      // Wait briefly for async removes to finish
      setTimeout(() => {
        browser.storage.local.set({
          kept,
          blocked,
          cookies: allowed,
          logs: logDump
        }).then(
          () => logDump.push("CC: Stored: Kept=" + kept.length + ", Blocked=" + blocked.length + ", Allowed=" + allowed.length),
                error => logDump.push("CC: Storage error: " + error)
        );
      }, 100); // 100ms delay
    }, error => {
      logDump.push("CC: Cookie fetch error for " + details.url + ": " + error);
      browser.storage.local.set({kept: [], blocked: [], cookies: [], logs: logDump});
    });
  },
  {url: [{schemes: ["http", "https"]}]}
);
