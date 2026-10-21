// If the app's modules fail to load (a failed import stops app.js before it runs), the page would
// otherwise sit empty with no explanation. A plain script, so it runs even when modules do not.
// It also re-fetches the files the app needs and lists how each one answered, so the cause shows
// on the page without opening the browser console.
(function () {
  var CHECKS = ["/app.js", "/js/dom.js", "/js/net.js", "/js/forms.js", "/shared/json-schema.js", "/shared/schemas.js", "/shared/retry.js", "/agent-driver.js", "/api/status"];

  function describe(url) {
    return fetch(url, { cache: "no-store", credentials: "same-origin" }).then(
      function (res) {
        var type = res.headers.get("content-type") || "no content type";
        return res.text().then(function (text) {
          var ok = res.ok && (url.indexOf("/api/") === 0 ? /json/.test(type) : /javascript/.test(type));
          return { url: url, ok: ok, text: url + ": " + res.status + " " + type + (ok ? "" : " — " + text.slice(0, 120).replace(/\s+/g, " ")) };
        });
      },
      function (err) {
        return { url: url, ok: false, text: url + ": network error (" + err.message + ")" };
      },
    );
  }

  window.setTimeout(function () {
    if (window.__maoStarted) return;
    var box = document.getElementById("notices");
    if (!box) return;
    var note = document.createElement("div");
    note.className = "notice notice-error";
    note.setAttribute("role", "alert");
    var title = document.createElement("p");
    title.textContent = "The app's scripts did not load, so no data can be shown. Checking each file…";
    var list = document.createElement("ul");
    note.appendChild(title);
    note.appendChild(list);
    box.appendChild(note);
    var status = document.getElementById("agent-status");
    if (status) {
      status.dataset.agentStatus = "error";
      status.textContent = title.textContent;
    }
    Promise.all(CHECKS.map(describe)).then(function (results) {
      var failed = results.filter(function (r) { return !r.ok; });
      title.textContent = failed.length
        ? "The app's scripts did not load, so no data can be shown. These files answered unexpectedly:"
        : "The app's scripts did not load, although every file answered normally. Reload the page; if it persists, the browser console (F12) has the error.";
      failed.forEach(function (r) {
        var item = document.createElement("li");
        item.textContent = r.text;
        list.appendChild(item);
      });
      if (status) status.textContent = title.textContent + " " + failed.map(function (r) { return r.text; }).join(" | ");
    });
  }, 8000);
})();
