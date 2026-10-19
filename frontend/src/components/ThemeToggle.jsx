import { Icon } from "./ui";
import { useTheme } from "../lib/theme";

export function ThemeToggle({ className = "top-icon" }) {
  const [theme, toggle] = useTheme();
  const light = theme === "light";
  const label = `Switch to ${light ? "dark" : "light"} theme`;
  return <button className={`${className} theme-toggle`} onClick={toggle} aria-label={label} title={label}><Icon name={light ? "moon" : "sun"} /></button>;
}
