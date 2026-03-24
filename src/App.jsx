import React, { useState, useEffect } from 'react';
import './App.css';
import ParivartaCalendar from './components/ParivartaCalendar';

const THEME_STORAGE_KEY = 'theme';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }

      return getSystemTheme();
    }

    return 'light';
  });
  const [hasStoredPreference, setHasStoredPreference] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || hasStoredPreference) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (event) => {
      setTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, [hasStoredPreference]);

  useEffect(() => {
    const root = document.documentElement;
    const { body } = document;

    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');

    root.classList.add(theme);
    body.classList.add(theme);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((previousTheme) => {
      const nextTheme = previousTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
    setHasStoredPreference(true);
  };

  return (
    <main className="app-shell">
      <ParivartaCalendar theme={theme} onToggleTheme={toggleTheme} />
    </main>
  );
}

export default App;
