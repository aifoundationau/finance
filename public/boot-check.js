// If the app's modules fail to load (a failed import stops app.js before it runs), the page would
// otherwise sit empty with no explanation. A plain script, so it runs even when modules do not.
window.setTimeout(function () {
  if (window.__maoStarted) return;
  var box = document.getElementById("notices");
  if (!box) return;
  var note = document.createElement("div");
  note.className = "notice notice-error";
  note.setAttribute("role", "alert");
  note.textContent =
    "The app's scripts did not load, so no data can be shown. Reload the page. If it keeps happening, the browser console (F12) names the file that failed.";
  box.appendChild(note);
  var status = document.getElementById("agent-status");
  if (status) {
    status.dataset.agentStatus = "error";
    status.textContent = note.textContent;
  }
}, 8000);
