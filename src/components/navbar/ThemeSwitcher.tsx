import { useEffect, useState } from "react";
import { SunIcon, SunIconCheckbox } from "./SunIcon";
import { MoonIcon, MoonIconCheckbox } from "./MoonIcon";

// Accessible theme switch (light/dark)
type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "theme";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  // daisyUI listens to data-theme (and also its own system). We enforce explicit theme for persistence.
  document.documentElement.setAttribute("data-theme", theme);
}

interface ThemeSwitcherProps {
  compact?: boolean;
  onChange?: (t: Theme) => void;
}

const ThemeSwitcher = ({ compact = false, onChange }: ThemeSwitcherProps) => {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    onChange?.(theme);
  }, [theme, onChange]);

  const toggle = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  if (compact) {
    // Icon button variant (used in horizontal navbar)
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        aria-pressed={theme === "dark"}
        className="btn btn-ghost btn-sm gap-2"
      >
        {theme === "light" ? (
          <span className="flex items-center gap-1">
            <SunIcon /> Light Mode
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <MoonIcon /> Dark Mode
          </span>
        )}
      </button>
    );
  }

  // Labeled variant (used in drawer / vertical menu)
  return (
    <label className="toggle text-base-content p-0 toggle-lg">
      <input type="checkbox" value="light" className="theme-controller" />
      {SunIconCheckbox()}
      {MoonIconCheckbox()}
    </label>
  );
};

export default ThemeSwitcher;
