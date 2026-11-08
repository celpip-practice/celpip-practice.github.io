"use client";
import { useT } from "@/lib/i18n";

export const KOFI_URL = "https://ko-fi.com/zhouhai";

function Cup({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 2.5c0 1 1 1 1 2s-1 1-1 2M12 2.5c0 1 1 1 1 2s-1 1-1 2" />
    </svg>
  );
}

export function DonateButton() {
  const t = useT();
  return (
    <a className="donate-btn" href={KOFI_URL} target="_blank" rel="noopener noreferrer" data-testid="donate-header">
      <Cup /> {t("donate.button")}
    </a>
  );
}

export function DonateCard() {
  const t = useT();
  return (
    <div className="card donate-card" data-testid="donate-card">
      <span className="icon-tile donate"><Cup size={22} /></span>
      <div className="grow">
        <h3>{t("donate.title")}</h3>
        <p>{t("donate.body")}</p>
      </div>
      <a className="btn donate-cta" href={KOFI_URL} target="_blank" rel="noopener noreferrer">
        <Cup /> {t("donate.cta")}
      </a>
    </div>
  );
}
