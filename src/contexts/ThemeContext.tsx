import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
export type ColorPalette = 'corporate' | 'midnight' | 'forest' | 'ocean' | 'sunset';

export const paletteOptions: { id: ColorPalette; label: string; description: string; previewColors: string[] }[] = [
  { id: 'corporate', label: 'Vishful Brand', description: 'Purple & amber brand tones', previewColors: ['#5B2D8E', '#E8872D', '#1c2333'] },
  { id: 'midnight', label: 'Modern Midnight', description: 'Warm cream & violet', previewColors: ['#7c3aed', '#f5f0ea', '#1a1425'] },
  { id: 'forest', label: 'Forest Professional', description: 'Natural green tones', previewColors: ['#1d8348', '#eef4f0', '#0f2318'] },
  { id: 'ocean', label: 'Ocean Breeze', description: 'Cool blue & teal tones', previewColors: ['#1976D2', '#e8f4f8', '#0d1b2a'] },
  { id: 'sunset', label: 'Warm Sunset', description: 'Amber & coral warmth', previewColors: ['#e65100', '#fff3e0', '#1a0e05'] },
];

interface ThemeContextType {
  theme: Theme;
  palette: ColorPalette;
  toggleTheme: () => void;
  setPalette: (p: ColorPalette) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark', palette: 'corporate', toggleTheme: () => {}, setPalette: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('vishful-theme');
    return (saved as Theme) || 'dark';
  });
  const [palette, setPaletteState] = useState<ColorPalette>(() => {
    const saved = localStorage.getItem('vishful-palette');
    return (saved as ColorPalette) || 'corporate';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('vishful-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('vishful-palette', palette);
  }, [palette]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const setPalette = (p: ColorPalette) => setPaletteState(p);

  return (
    <ThemeContext.Provider value={{ theme, palette, toggleTheme, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
};
