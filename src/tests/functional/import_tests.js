import { expect, test } from "@playwright/test"

test("window variable with ESM", async ({ page }) => {
  await page.goto("/src/tests/fixtures/esm.html")
  expect(await page.evaluate(() => typeof window.Turbo)).toEqual("object")
})
