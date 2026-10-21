// Applies the saved colour theme before first paint (loaded synchronously in <head>).
try {
  const theme = localStorage.getItem("mao-theme");
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
} catch {
  // storage unavailable (private mode): follow the system theme
}
