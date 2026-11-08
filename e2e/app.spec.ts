import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { listeningQuestions, readingQuestions } from "../lib/content";
import type { Test } from "../lib/types";

const contentDir = path.resolve(process.cwd(), "public/content");
const index = JSON.parse(fs.readFileSync(path.join(contentDir, "index.json"), "utf8"));
const firstId: string = index.tests[0].id;
const data: Test = JSON.parse(fs.readFileSync(path.join(contentDir, "tests", firstId, "test.json"), "utf8"));

async function answerReadingPart(page: Page, n: number) {
  const part = data.reading!.parts.find((p) => p.n === n)!;
  for (const q of readingQuestions(part)) {
    await page.getByTestId(`dd-${q.id}`).selectOption(String(q.answer));
  }
}

test("home page lists the converted tests and both modes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("mode-exam")).toBeVisible();
  await expect(page.getByTestId("mode-practice")).toBeVisible();
  for (const t of index.tests) await expect(page.getByTestId(`test-${t.id}`)).toBeVisible();
});

test("practice: listening part 1 answered correctly scores 8/8", async ({ page }) => {
  await page.goto(`/practice/run/?test=${firstId}&skill=listening&part=1`);
  await expect(page.getByTestId("exam-title")).toContainText("Listening Part 1");
  await expect(page.getByTestId("intro")).toBeVisible();
  const answers = new Map(listeningQuestions(data.listening!.parts[0]).map((q, i) => [i + 1, q.answer!]));
  for (let step = 0; step < 40; step++) {
    if (await page.getByTestId("practice-results").isVisible()) break;
    const head = page.locator(".q-head");
    if (await head.isVisible()) {
      const n = Number((await head.textContent())!.match(/Question (\d+)/)![1]);
      await page.getByTestId("radio-options").locator("label").nth(answers.get(n)!).click();
      await page.getByTestId("answer-key").click();
      await expect(page.locator(".radio-list label.correct")).toHaveCount(1);
    }
    await page.getByTestId("next").click();
  }
  await expect(page.getByTestId("score")).toContainText("8 / 8");
});

test("practice: listening question without question audio shows its printed stem", async ({ page }) => {
  const entry = index.tests.find((t: { id: string }) => {
    const tj: Test = JSON.parse(fs.readFileSync(path.join(contentDir, "tests", t.id, "test.json"), "utf8"));
    return listeningQuestions(tj.listening?.parts[0] ?? { sections: [] } as never).some((q) => !q.audio && q.stem);
  });
  test.skip(!entry, "every test has spoken question audio");
  const tj: Test = JSON.parse(fs.readFileSync(path.join(contentDir, "tests", entry.id, "test.json"), "utf8"));
  const first = listeningQuestions(tj.listening!.parts[0])[0];
  await page.goto(`/practice/run/?test=${entry.id}&skill=listening&part=1`);
  for (let step = 0; step < 4 && !(await page.locator(".q-head").isVisible()); step++) {
    await page.getByTestId("next").click();
  }
  await expect(page.getByTestId("stem-text")).toHaveText(first.stem!);
});

test("practice: reading part 3 answered correctly scores full marks", async ({ page }) => {
  await page.goto(`/practice/run/?test=${firstId}&skill=reading&part=3`);
  await expect(page.getByTestId("reading-left")).toBeVisible();
  await expect(page.getByTestId("reading-right")).toBeVisible();
  await expect(page.getByTestId("back")).toBeDisabled();
  await answerReadingPart(page, 3);
  await page.getByTestId("next").click();
  const total = readingQuestions(data.reading!.parts[2]).length;
  await expect(page.getByTestId("score")).toContainText(`${total} / ${total}`);
});

test("exam: reading runs all four timed parts without Back and scores 38/38", async ({ page }) => {
  await page.goto(`/exam/?test=${firstId}`);
  await page.getByTestId("start-reading").click();
  await expect(page.getByTestId("time-remaining")).toContainText("11 minutes");
  for (const n of [1, 2, 3, 4]) {
    await expect(page.getByTestId("exam-title")).toContainText(`Reading Part ${n}`);
    await expect(page.getByTestId("back")).toBeDisabled();
    await answerReadingPart(page, n);
    await page.getByTestId("next").click();
  }
  await expect(page.getByTestId("exam-results")).toBeVisible();
  await expect(page.getByTestId("score")).toContainText("38 / 38");
  await expect(page.getByTestId("score")).toContainText("10-12");
});

test("exam: listening blocks Next until the recording has played", async ({ page }) => {
  await page.goto(`/exam/?test=${firstId}`);
  await page.getByTestId("start-listening").click();
  await expect(page.getByTestId("intro")).toBeVisible();
  await page.getByTestId("next").click();
  await expect(page.getByTestId("audio-box")).toBeVisible();
  await expect(page.getByTestId("next")).toBeDisabled();
  await expect(page.getByTestId("back")).toBeDisabled();
});

test("practice: writing counts words and shows sample responses", async ({ page }) => {
  await page.goto(`/practice/run/?test=${firstId}&skill=writing&part=1`);
  await page.getByTestId("writing-area").fill("Dear Sir, I am writing to complain about the service.");
  await expect(page.getByTestId("word-count")).toContainText("10");
  await page.getByTestId("toggle-samples").click();
  await expect(page.getByTestId("samples")).toBeVisible();
  await page.getByTestId("next").click();
  await expect(page.getByTestId("practice-results")).toContainText("I am writing to complain");
});

test("practice: speaking task 3 shows the picture, records and plays back", async ({ page }) => {
  await page.goto(`/practice/run/?test=${firstId}&skill=speaking&part=3`);
  await expect(page.getByTestId("exam-title")).toContainText("Speaking Task 3");
  await expect(page.locator("img.scene")).toBeVisible();
  await expect(page.getByTestId("prep-box")).toBeVisible();
  await page.getByTestId("next").click();
  await expect(page.getByTestId("recording-box")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId("next").click();
  await expect(page.getByTestId("practice-results")).toBeVisible();
  await expect(page.getByTestId("practice-results").locator("audio")).toHaveCount(1);
});

test("history keeps finished attempts", async ({ page }) => {
  await page.goto(`/practice/run/?test=${firstId}&skill=reading&part=3`);
  await answerReadingPart(page, 3);
  await page.getByTestId("next").click();
  await expect(page.getByTestId("score")).toBeVisible();
  await page.goto("/history/");
  await expect(page.getByRole("link", { name: "查看" }).first()).toBeVisible();
});
