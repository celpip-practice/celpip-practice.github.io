"use client";
import { useEffect } from "react";
import { LANG_STORAGE_KEY, isLang, type Lang } from "@/lib/dict";
import { BASE_PATH } from "@/lib/site";

function preferredLang(): Lang {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (isLang(saved)) return saved;
  return (navigator.languages ?? [navigator.language]).some((l) => l?.toLowerCase().startsWith("zh")) ? "zh" : "en";
}

/** Sends "/" and pre-i18n URLs such as "/practice/?skill=reading" to the same page in the visitor's language. */
export default function LangRedirect({ path }: { path: string }) {
  useEffect(() => {
    window.location.replace(`${BASE_PATH}/${preferredLang()}${path}${window.location.search}${window.location.hash}`);
  }, [path]);
  return (
    <main className="redirect">
      <a href={`${BASE_PATH}/zh${path}`} hrefLang="zh-CN">中文</a>
      <a href={`${BASE_PATH}/en${path}`} hrefLang="en-CA">English</a>
    </main>
  );
}
