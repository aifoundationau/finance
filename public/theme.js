// Applies the saved colour theme before first paint (loaded synchronously in <head>).
// Defaults to Terminal Obsidian dark aesthetic.
try {
  const theme = localStorage.getItem("mao-theme");
  if (theme === "dark" || theme === "light") {
    document.documentElement.dataset.theme = theme;
  } else {
    document.documentElement.dataset.theme = "dark";
  }
} catch {
  document.documentElement.dataset.theme = "dark";
}
