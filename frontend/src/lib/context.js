import { createContext, useContext } from "react";

// { auth, model, api, reload, toast, view, theme, toggleTheme, logout }
export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}
