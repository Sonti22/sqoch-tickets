import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function participant(
  page: Page,
  index: number,
  name: string,
  age: string,
) {
  await page.getByLabel("Имя участника", { exact: true }).nth(index).fill(name);
  await page.getByLabel("Возраст, лет", { exact: true }).nth(index).fill(age);
}

async function singleAdult(page: Page) {
  await participant(page, 0, "Алексей", "35");
  await page.getByLabel("Контактный email").fill("alex@example.com");
}

async function review(page: Page) {
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(page.getByRole("heading", { name: "Всё верно?" })).toBeVisible();
}

async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
});

test("оформляет взрослого с ребёнком и скачивает демо-билеты", async ({
  page,
}) => {
  await singleAdult(page);
  await page.getByRole("button", { name: "Добавить участника" }).click();
  await participant(page, 1, "Маша", "8");
  await expect(page.getByTestId("order-total")).toHaveText(/3\s*000 ₽/);
  await review(page);
  await expect(page.getByText("Алексей", { exact: true })).toBeVisible();
  await expect(page.getByText("Маша", { exact: true })).toBeVisible();
  await expect(
    page.getByText("alex@example.com", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("button", { name: "Проверяем места…" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Вы идёте на фестиваль!" }),
  ).toBeVisible();
  await expect(page.getByText(/VG-[A-F0-9]{8}/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать демо-билеты" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^VG-[A-F0-9]{8}\.txt$/);
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const content = await readFile(filePath!, "utf8");
  expect(content).toContain("Алексей, 35 лет");
  expect(content).toContain("Маша, 8 лет");
  expect(content).toMatch(/Итого: 3\s*000 ₽/);
  expect(content).toContain("не даёт права входа");
});

test("возвращается из проверки и пересчитывает изменённый заказ", async ({
  page,
}) => {
  await singleAdult(page);
  await review(page);
  await page.getByRole("button", { name: "Изменить данные" }).click();
  await expect(page.getByLabel("Имя участника", { exact: true })).toHaveValue(
    "Алексей",
  );
  await page.getByRole("button", { name: "Добавить участника" }).click();
  await participant(page, 1, "Вера", "13");
  await expect(page.getByTestId("order-total")).toHaveText(/3\s*000 ₽/);
  await page.getByLabel("Возраст, лет", { exact: true }).nth(1).fill("14");
  await page.getByLabel("Контактный email").fill("new@example.com");
  await expect(page.getByTestId("order-total")).toHaveText(/4\s*000 ₽/);
  await review(page);
  await expect(page.getByText("14 лет · Полный билет")).toBeVisible();
  await expect(
    page.getByText("new@example.com", { exact: true }),
  ).toBeVisible();
});

test("обрабатывает окончание мест, сохраняет данные и позволяет повторить", async ({
  page,
}) => {
  await singleAdult(page);
  await page.getByText("Демо · проверить сценарии", { exact: true }).click();
  await page
    .getByLabel("Наличие мест при подтверждении")
    .selectOption("sold-out");
  await review(page);
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Ох, места закончились" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Заказ не создан, деньги не списаны/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Вернуться к данным" }).click();
  await expect(page.getByLabel("Имя участника", { exact: true })).toHaveValue(
    "Алексей",
  );
  await expect(page.getByLabel("Возраст, лет", { exact: true })).toHaveValue(
    "35",
  );
  await expect(page.getByLabel("Контактный email")).toHaveValue(
    "alex@example.com",
  );
  await review(page);
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Ох, места закончились" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Повторить с доступными местами" })
    .click();
  await expect(page.getByRole("heading", { name: "Всё верно?" })).toBeVisible();
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Вы идёте на фестиваль!" }),
  ).toBeVisible();
});

test("после окончания мест явное переключение сценария на доступные места работает", async ({
  page,
}) => {
  await singleAdult(page);
  await page.getByText("Демо · проверить сценарии", { exact: true }).click();
  await page
    .getByLabel("Наличие мест при подтверждении")
    .selectOption("sold-out");
  await review(page);
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Ох, места закончились" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Вернуться к данным" }).click();
  await page
    .getByLabel("Наличие мест при подтверждении")
    .selectOption("success");
  await expect(page.getByLabel("Имя участника", { exact: true })).toHaveValue(
    "Алексей",
  );
  await expect(page.getByLabel("Контактный email")).toHaveValue(
    "alex@example.com",
  );
  await review(page);
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Вы идёте на фестиваль!" }),
  ).toBeVisible();
});

test("не пропускает ребёнка без сопровождающего от 18 лет", async ({
  page,
}) => {
  await participant(page, 0, "Маша", "8");
  await page.getByLabel("Контактный email").fill("family@example.com");
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "сопровождающего от 18 лет",
  );
  await page.getByRole("button", { name: "Добавить участника" }).click();
  await participant(page, 1, "Иван", "17");
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "сопровождающего от 18 лет",
  );
  await page.getByLabel("Возраст, лет", { exact: true }).nth(1).fill("18");
  await review(page);
  await page.getByRole("button", { name: "Изменить данные" }).click();
  await page.getByRole("button", { name: "Удалить участника 2" }).click();
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "сопровождающего от 18 лет",
  );
});

test("считает 14 лет полным билетом без требования сопровождения", async ({
  page,
}) => {
  await participant(page, 0, "Денис", "14");
  await page.getByLabel("Контактный email").fill("denis@example.com");
  await expect(page.getByTestId("order-total")).toHaveText(/2\s*000 ₽/);
  await review(page);
  await expect(page.getByText("14 лет · Полный билет")).toBeVisible();
});

test("ограничивает заказ четырьмя участниками и не удаляет последнего", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: /Удалить участника/ }),
  ).toHaveCount(0);
  for (let index = 1; index < 4; index++)
    await page.getByRole("button", { name: "Добавить участника" }).click();
  await expect(page.getByLabel("Имя участника", { exact: true })).toHaveCount(
    4,
  );
  await expect(
    page.getByRole("button", { name: "В заказе максимум 4 участника" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Удалить участника 2" }).click();
  await expect(page.getByLabel("Имя участника", { exact: true })).toHaveCount(
    3,
  );
  await expect(
    page.getByRole("button", { name: "Добавить участника" }),
  ).toBeEnabled();
});

test("показывает ошибки обязательных полей, email и возраста", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(
    page.getByLabel("Имя участника", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByLabel("Возраст, лет", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Контактный email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Имя участника", { exact: true })).toBeFocused();
  await participant(page, 0, "Алексей", "1.5");
  await page.getByLabel("Контактный email").fill("wrong-address");
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(
    page.getByLabel("Возраст, лет", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Контактный email")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByTestId("order-total")).toHaveText("0 ₽");
  await page.getByLabel("Возраст, лет", { exact: true }).fill("121");
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(
    page.getByLabel("Возраст, лет", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Возраст, лет", { exact: true }).fill("35");
  await page.getByLabel("Контактный email").fill("valid@example.com");
  await review(page);
});

test("все шаги помещаются по ширине, новый заказ очищает данные", async ({
  page,
}) => {
  await noOverflow(page);
  await singleAdult(page);
  await review(page);
  await noOverflow(page);
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Вы идёте на фестиваль!" }),
  ).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "Оформить новый заказ" }).click();
  await expect(page.getByLabel("Имя участника", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Возраст, лет", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Контактный email")).toHaveValue("");
  await expect(page.getByTestId("order-total")).toHaveText("0 ₽");
  await page.getByText("Демо · проверить сценарии", { exact: true }).click();
  await page
    .getByLabel("Наличие мест при подтверждении")
    .selectOption("sold-out");
  await singleAdult(page);
  await review(page);
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Ох, места закончились" }),
  ).toBeVisible();
  await noOverflow(page);
});
