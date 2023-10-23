import { expect, test } from "@playwright/test"
import { nextEventNamed, pathname, visitAction } from "../helpers/page"

const path = "/src/tests/fixtures/drive.html"

test.beforeEach(async ({ page }) => {
  await page.goto(path)
})

test("drive enabled by default; click normal link", async ({ page }) => {
  await page.click("#drive_enabled")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual(path)
})

test("drive to external link", async ({ page }) => {
  await page.route("https://example.com", async (route) => {
    await route.fulfill({ body: "Hello from the outside world" })
  })

  await page.click("#drive_enabled_external")

  await expect(page).toHaveURL("https://example.com/")
  await expect(page.locator("body")).toHaveText("Hello from the outside world")
})

test("drive enabled by default; click link inside data-turbo='false'", async ({ page }) => {
  await page.click("#drive_disabled")

  await expect(page).toHaveURL(path)
  expect(await visitAction(page)).toEqual("load")
})
