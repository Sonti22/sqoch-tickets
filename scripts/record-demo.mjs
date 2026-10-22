import { chromium } from "@playwright/test";
import { mkdir, rename } from "node:fs/promises";

const base = process.env.DEMO_BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  slowMo: 170,
});
await mkdir("docs", { recursive: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 940 },
  recordVideo: { dir: "test-results/demo", size: { width: 1280, height: 940 } },
});
const page = await context.newPage();
const pause = () => page.waitForTimeout(1800);
const name = page.getByLabel("Имя участника", { exact: true });
const age = page.getByLabel("Возраст, лет", { exact: true });
try {
  await page.goto(base);
  await pause();
  await name.fill("Алексей");
  await age.fill("35");
  await page.getByRole("button", { name: "Добавить участника" }).click();
  await name.nth(1).fill("Маша");
  await age.nth(1).fill("8");
  await page.getByLabel("Контактный email").fill("family@example.com");
  await pause();
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await pause();
  await page.screenshot({ path: "docs/review-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Изменить данные" }).click();
  await age.nth(1).fill("14");
  await pause();
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await pause();
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await page.getByRole("heading", { name: "Вы идёте на фестиваль!" }).waitFor();
  await pause();
  await page.screenshot({ path: "docs/success-desktop.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать демо-билеты" }).click();
  await download;
  await pause();
  await page.getByRole("button", { name: "Оформить новый заказ" }).click();
  await name.fill("Ирина");
  await age.fill("28");
  await page.getByLabel("Контактный email").fill("irina@example.com");
  await page.getByText("Демо · проверить сценарии", { exact: true }).click();
  await page
    .getByLabel("Наличие мест при подтверждении")
    .selectOption("sold-out");
  await pause();
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await pause();
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await page.getByRole("heading", { name: "Ох, места закончились" }).waitFor();
  await pause();
  await page.screenshot({ path: "docs/sold-out-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Вернуться к данным" }).click();
  await pause();
  await page
    .getByLabel("Наличие мест при подтверждении")
    .selectOption("success");
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await page.getByRole("heading", { name: "Вы идёте на фестиваль!" }).waitFor();
  await pause();
  const videoPath = await page.video().path();
  await context.close();
  await rename(videoPath, "docs/demo.webm");
  console.log("Demo recorded: docs/demo.webm");
} finally {
  await browser.close();
}
