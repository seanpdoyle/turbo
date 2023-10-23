import { expect, test } from "@playwright/test"
import { nextBeat } from "../helpers/page"

test("preloads snapshot on initial load", async ({ page }) => {
  // contains `a[rel="preload"][href="http://localhost:9000/src/tests/fixtures/preloaded.html"]`
  await page.goto("/src/tests/fixtures/preloading.html")
  await nextBeat()

  expect(
    await page.evaluate(() => {
      const preloadedUrl = new URL("http://localhost:9000/src/tests/fixtures/preloaded.html")
      const cache = window.Turbo.session.preloader.snapshotCache

      return preloadedUrl in cache
    })
  ).toEqual(true)
})

test("preloads snapshot on page visit", async ({ page }) => {
  // contains `a[rel="preload"][href="http://localhost:9000/src/tests/fixtures/preloading.html"]`
  await page.goto("/src/tests/fixtures/hot_preloading.html")

  // contains `a[rel="preload"][href="http://localhost:9000/src/tests/fixtures/preloaded.html"]`
  await page.click("#hot_preload_anchor")
  await page.waitForSelector("#preload_anchor")
  await nextBeat()

  expect(
    await page.evaluate(() => {
      const preloadedUrl = new URL("http://localhost:9000/src/tests/fixtures/preloaded.html")
      const cache = window.Turbo.session.preloader.snapshotCache

      return preloadedUrl in cache
    })
  ).toEqual(true)
})

test("navigates to preloaded snapshot from frame", async ({ page }) => {
  // contains `a[rel="preload"][href="http://localhost:9000/src/tests/fixtures/preloaded.html"]`
  await page.goto("/src/tests/fixtures/frame_preloading.html")
  await page.waitForSelector("#frame_preload_anchor")
  await nextBeat()

  expect(
    await page.evaluate(() => {
      const preloadedUrl = new URL("http://localhost:9000/src/tests/fixtures/preloaded.html")
      const cache = window.Turbo.session.preloader.snapshotCache

      return preloadedUrl in cache
    })
  ).toEqual(true)
})
