import { useCallback, useState } from "react";

const KEY = "vrpharma_theme";

export function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#ffffff" : "#090c10");
  try { localStorage.setItem(KEY, JSON.stringify(theme)); } catch { /* Storage disabled: theme lasts for this visit. */ }
}

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);
  const toggle = useCallback(() => {
    const next = currentTheme() === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  }, []);
  return [theme, toggle];
}
