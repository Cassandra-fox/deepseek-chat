"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "system" | "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: "system", setTheme: () => {} });
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : theme;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setPreference] = useState<Theme>("system");
  useEffect(() => {
    let preference: Theme = "system";
    try {
      const stored = localStorage.getItem("deepseek-theme");
      if (stored === "light" || stored === "dark") preference = stored;
    } catch {}
    setPreference(preference);
    applyTheme(preference);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (theme === "system") applyTheme("system"); };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
  const setTheme = (value: Theme) => {
    setPreference(value);
    applyTheme(value);
    try { localStorage.setItem("deepseek-theme", value); } catch {}
  };
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
