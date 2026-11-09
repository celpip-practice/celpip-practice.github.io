import { chromium } from "@playwright/test";

const page_ = (c) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1200px; height: 630px; font-family: -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif;
    background: radial-gradient(900px 420px at 88% -10%, rgba(213,43,30,.45), transparent 60%),
      radial-gradient(800px 420px at 0% 110%, rgba(29,78,216,.55), transparent 60%), #0b1f3a;
    color: #cbd5e1; display: flex; flex-direction: column; justify-content: center; padding: 0 88px; box-sizing: border-box; }
  .brand { display: flex; align-items: center; gap: 18px; color: #fff; font-size: 34px; font-weight: 600; }
  .brand b { font-weight: 800; }
  h1 { color: #fff; font-size: 68px; line-height: 1.1; margin: 40px 0 18px; letter-spacing: -1px; }
  p { font-size: 32px; margin: 0; color: #cbd5e1; }
  .tags { display: flex; gap: 14px; margin-top: 44px; }
  .tags span { font-size: 24px; font-weight: 600; color: #fff; padding: 10px 22px; border-radius: 999px;
    background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.25); }
</style></head><body>
  <div class="brand">
    <svg width="64" height="64" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#d52b1e"/><path fill="#fff" d="M16 5l1.6 3.2 1.9-.9-.6 4.4 2.6-2.8.6 1.6 2.9-.6-1 3.2 1.4.7-4.4 3.6.6 1.6-4.6-.6.2 4.6h-1.4l.2-4.6-4.6.6.6-1.6-4.4-3.6 1.4-.7-1-3.2 2.9.6.6-1.6 2.6 2.8-.6-4.4 1.9.9z"/></svg>
    <span>CELPIP <b>Practice</b></span>
  </div>
  <h1>${c.h1}</h1>
  <p>${c.p}</p>
  <div class="tags">${c.tags.map((x) => `<span>${x}</span>`).join("")}</div>
</body></html>`;

const COPY = {
  en: {
    h1: "Free CELPIP mock exams<br>and practice tests",
    p: "27 practice tests · Listening · Reading · Writing · Speaking",
    tags: ["Real exam interface", "Instant scoring", "Free, no sign-up"],
  },
  zh: {
    h1: "免费思培在线模考<br>与分项练习",
    p: "27 套模考题 · 听力 · 阅读 · 写作 · 口语",
    tags: ["还原真实考试界面", "自动判分", "免费，无需注册"],
  },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [lang, c] of Object.entries(COPY)) {
  await page.setContent(page_(c));
  await page.screenshot({ path: `public/og-${lang}.png` });
}
await page.setContent(page_(COPY.en));
await page.screenshot({ path: "public/og.png" });
await browser.close();
