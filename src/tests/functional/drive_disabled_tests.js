import { expect, test } from "@playwright/test"
import {
  getFromLocalStorage,
  nextBeat,
  nextEventNamed,
  nextEventOnTarget,
  pathname,
  searchParams,
  setLocalStorageFromEvent,
  visitAction
} from "../helpers/page"

const path = "/src/tests/fixtures/drive_disabled.html"

test.beforeEach(async ({ page }) => {
  await page.goto(path)
})

test("drive disabled by default; click normal link", async ({ page }) => {
  await page.click("#drive_disabled")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual(path)
  expect(await visitAction(page)).toEqual("load")
})

test("drive disabled by default; click link inside data-turbo='true'", async ({ page }) => {
  await page.click("#drive_enabled")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual(path)
  expect(await visitAction(page)).toEqual("advance")
})

test("drive disabled by default; submit form inside data-turbo='true'", async ({ page }) => {
  await setLocalStorageFromEvent(page, "turbo:submit-start", "formSubmitted", "true")

  await page.click("#no_submitter_drive_enabled a#requestSubmit")
  await nextBeat()

  expect(await getFromLocalStorage(page, "formSubmitted")).toEqual("true")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(await visitAction(page)).toEqual("advance")
  expect(await searchParams(page.url()).get("greeting")).toEqual("Hello from a redirect")
})

test("drive disabled by default; links within <turbo-frame> navigate with Turbo", async ({ page }) => {
  await page.click("#frame a")
  await nextEventOnTarget(page, "frame", "turbo:frame-render")
})

test("drive disabled by default; forms within <turbo-frame> navigate with Turbo", async ({ page }) => {
  await page.click("#frame button")
  await nextEventOnTarget(page, "frame", "turbo:frame-render")
})

test("drive disabled by default; slot within <turbo-frame> navigate with Turbo", async ({ page }) => {
  await page.click("#frame-navigation-with-slot")
  await nextEventOnTarget(page, "frame", "turbo:frame-render")
})
