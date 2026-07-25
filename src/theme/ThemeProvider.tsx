import { createContext, useContext, type PropsWithChildren } from 'react';
import { colors, radii, spacing, fontSizes } from './tokens';

const theme = { colors, radii, spacing, fontSizes } as const;
export type Theme = typeof theme;

const ThemeContext = createContext<Theme>(theme);

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
