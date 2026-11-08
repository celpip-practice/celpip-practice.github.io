# CELPIP Practice

Free CELPIP-General mock exams in an interface modelled on the real computer-delivered test.

**Live site:** https://celpip-practice.github.io

- 27 practice tests covering Listening, Reading, Writing and Speaking
- **Full mock exam** with the official section timers, or **practice by skill** with a countdown you can keep going past
- Instant scoring for Listening and Reading, with a CELPIP level estimate
- Writing with a spell checker and word count; Speaking with in-browser recording and playback
- Skill guides, a score / CLB chart and an FAQ
- Site interface in English and Chinese (`/en/`, `/zh/`); the test content itself is in English
- No account: history stays in your browser (`localStorage`), recordings in `IndexedDB`

> Unofficial site, not affiliated with Paragon Testing Enterprises or CELPIP.
> Test content © Paragon Testing Enterprises. For personal exam preparation only.

## Tech stack

- [Next.js 15](https://nextjs.org) App Router with `output: "export"`: a fully static site, no server
- React 19, TypeScript
- Python scripts that turn the source practice-test material into JSON + media
- Vitest (unit), pytest (content), Playwright (end-to-end)
- Deployed to GitHub Pages by GitHub Actions

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:3000
```

The built test content is committed under `public/content/`, so the app runs without the Python pipeline.

To serve the static export the way GitHub Pages does:

```bash
npm run build        # writes out/
npm start            # serves out/ on http://127.0.0.1:3000
```

## Project layout

```
app/
  [lang]/            Localised routes (en, zh): home, exam, practice, history,
                     skill guides, scores, faq, tests/[id]
  (redirect)/        Language-less URLs that redirect to /en/ or /zh/
  sitemap.ts, robots.ts
components/          Test runners (Listening, Reading, Writing, Speaking), exam frame, views
lib/
  dict.ts            UI strings for both languages
  guides.ts          Guide, score and FAQ content
  scoring.ts         Raw score to CELPIP level
  site.ts            Page metadata: canonical, hreflang, Open Graph
  store.ts           Progress persistence
public/content/      Built tests: index.json and tests/<id>/test.json + media/
scripts/             Content pipeline (Python)
tests/               pytest content checks and Vitest unit tests
e2e/                 Playwright specs
scripts/og.mjs       Renders the social share images (public/og-*.png)
```

## Testing

```bash
npm test             # Vitest unit tests
npm run test:content # validate built content + pytest
npm run test:e2e     # Playwright (builds are served from out/)
npm run test:all     # everything above, plus a production build
```

The Python checks expect a virtualenv at `.venv/` with `pytest`. Playwright browsers are installed to
`work/pw` (`PLAYWRIGHT_BROWSERS_PATH=work/pw npx playwright install chromium`).

## Content pipeline

Only needed to add or rebuild tests. The scripts read the source practice-test material (PDFs, Word documents,
audio and video) from the folder named by `CELPIP_SRC`, and write `public/content/tests/<id>/`.

```bash
npm run content:build -- s01-t1      # or: all
.venv/bin/python scripts/validate.py s01-t1
```

The pipeline runs on macOS and needs:

- Python packages: `pymupdf`, `python-docx`, `numpy`, `faster-whisper`, `pytest`
- `ffmpeg` for cutting audio clips
- `bin/ocr`, a macOS Vision OCR helper compiled from `scripts/ocr.swift`:
  `swiftc -O scripts/ocr.swift -o bin/ocr`

OCR results and Whisper transcripts are cached under `work/`.

## Deployment

Every push to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml): unit tests, a static
build, then a deploy to GitHub Pages. For a project page (served under `/<repo>`), set the repository variable
`BASE_PATH` to `/<repo>`; leave it empty for an `<org>.github.io` repository.

To regenerate the share images after changing their copy:

```bash
PLAYWRIGHT_BROWSERS_PATH=work/pw node scripts/og.mjs
```
