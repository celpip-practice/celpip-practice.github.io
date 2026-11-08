"use client";
/** The site language comes from the URL (/zh/..., /en/...); this context hands it to client components. */
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { LANG_STORAGE_KEY, localePath, translate, type Key, type Lang, type T } from "./dict";

export { localePath, partName, skillName, testTitle } from "./dict";
export type { Lang, T } from "./dict";

const Ctx = createContext<Lang>("zh");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useLang() {
  return { lang: useContext(Ctx) };
}

export function useT(): T {
  const lang = useContext(Ctx);
  return useCallback((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

/** Site-relative path in the current language: href("/practice/?skill=reading") -> "/zh/practice/?skill=reading". */
export function useHref() {
  const lang = useContext(Ctx);
  return useCallback((path: string) => localePath(lang, path), [lang]);
}

/** The current path with its language prefix removed ("/zh/practice/" -> "/practice/"). */
export function stripLang(path: string) {
  return path.replace(/^\/(zh|en)(?=\/|$)/, "") || "/";
}
