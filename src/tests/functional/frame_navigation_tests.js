import { expect, test } from "@playwright/test"
import { getFromLocalStorage, nextEventNamed, nextEventOnTarget, pathname, scrollToSelector } from "../helpers/page"

test("frame navigation with descendant link", async ({ page }) => {
  await page.goto("/src/tests/fixtures/frame_navigation.html")
  await page.click("#inside")

  await nextEventOnTarget(page, "frame", "turbo:frame-load")
})

test("frame navigation with self link", async ({ page }) => {
  await page.goto("/src/tests/fixtures/frame_navigation.html")
  await page.click("#self")

  await nextEventOnTarget(page, "frame", "turbo:frame-load")
})

test("frame navigation with exterior link", async ({ page }) => {
  await page.goto("/src/tests/fixtures/frame_navigation.html")
  await page.click("#outside")

  await nextEventOnTarget(page, "frame", "turbo:frame-load")
})

test("frame navigation with exterior link in Shadow DOM", async ({ page }) => {
  await page.goto("/src/tests/fixtures/frame_navigation.html")
  await page.click("#outside-in-shadow-dom")

  await nextEventOnTarget(page, "frame", "turbo:frame-load")
})

test("frame navigation emits fetch-request-error event when offline", async ({ page }) => {
  await page.goto("/src/tests/fixtures/tabs.html")
  await page.context().setOffline(true)
  await page.click("#tab-2")
  await nextEventOnTarget(page, "tab-frame", "turbo:fetch-request-error")
})

test("lazy-loaded frame promotes navigation", async ({ page }) => {
  await page.goto("/src/tests/fixtures/frame_navigation.html")

  await expect(page.locator("#eager-loaded-frame h2")).toHaveText("Eager-loaded frame: Not Loaded")

  await scrollToSelector(page, "#eager-loaded-frame")
  await nextEventOnTarget(page, "eager-loaded-frame", "turbo:frame-load")

  await expect(page.locator("#eager-loaded-frame h2")).toHaveText("Eager-loaded frame: Loaded")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/frames/frame_for_eager.html")
})

test("promoted frame navigation updates the URL before rendering", async ({ page }) => {
  await page.goto("/src/tests/fixtures/tabs.html")

  await page.evaluate(() => {
    addEventListener("turbo:before-frame-render", () => {
      localStorage.setItem("beforeRenderUrl", window.location.pathname)
      localStorage.setItem("beforeRenderContent", document.querySelector("#tab-content")?.textContent || "")
    })
  })

  await page.click("#tab-2")
  await nextEventNamed(page, "turbo:before-frame-render")

  expect(await getFromLocalStorage(page, "beforeRenderUrl")).toEqual("/src/tests/fixtures/tabs/two.html")
  expect(await getFromLocalStorage(page, "beforeRenderContent")).toEqual("One")

  await nextEventNamed(page, "turbo:frame-render")

  expect(await pathname(page.url())).toEqual("/src/tests/fixtures/tabs/two.html")
  await expect(page.locator("#tab-content")).toHaveText("Two")
})

test("promoted frame navigations are cached", async ({ page }) => {
  await page.goto("/src/tests/fixtures/tabs.html")

  await page.click("#tab-2")
  await nextEventOnTarget(page, "tab-frame", "turbo:frame-load")
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("#tab-content")).toHaveText("Two")
  expect(pathname(await page.getAttribute("#tab-frame", "src"))).toEqual("/src/tests/fixtures/tabs/two.html")
  await expect(page.locator("#tab-frame")).toHaveAttribute("complete", "")

  await page.click("#tab-3")
  await nextEventOnTarget(page, "tab-frame", "turbo:frame-load")
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("#tab-content")).toHaveText("Three")
  expect(pathname((await page.getAttribute("#tab-frame", "src")))).toEqual("/src/tests/fixtures/tabs/three.html")
  await expect(page.locator("#tab-frame")).toHaveAttribute("complete", "")

  await page.goBack()
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("#tab-content")).toHaveText("Two")
  expect(pathname((await page.getAttribute("#tab-frame", "src")))).toEqual("/src/tests/fixtures/tabs/two.html")
  await expect(page.locator("#tab-frame")).toHaveAttribute("complete", "")

  await page.goBack()
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("#tab-content")).toHaveText("One")
  await expect(page.locator("#tab-frame", "src")).not.toBe()
  await expect(page.locator("#tab-frame", "complete")).not.toBe()
})
