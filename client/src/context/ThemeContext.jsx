/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

/**
 * ThemeProvider
 * Manages dark/light theme with localStorage persistence and OS preference detection.
 * Sets data-theme attribute on <html> element for CSS variable switching.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('nexmeet-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    // Legacy key support
    const legacy = localStorage.getItem('nexmeet_theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Also keep body class in sync for legacy CSS selectors
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('nexmeet-theme', theme);
    localStorage.setItem('nexmeet_theme', theme); // Legacy key
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
