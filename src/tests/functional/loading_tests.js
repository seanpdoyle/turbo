import { expect, test } from "@playwright/test"
import {
  attributeForSelector,
  hasSelector,
  nextAttributeMutationNamed,
  nextBeat,
  nextBody,
  nextEventNamed,
  nextEventOnTarget,
  noNextEventOnTarget,
  readEventLogs
} from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/loading.html")
  await readEventLogs(page)
})

test("eager loading within a details element", async ({ page }) => {
  await nextBeat()
  expect(await hasSelector(page, "#loading-eager turbo-frame#frame h2")).toEqual(true)
  expect(await hasSelector(page, "#loading-eager turbo-frame[complete]")).toEqual(true)
})

test("lazy loading within a details element", async ({ page }) => {
  const frameContents = "#loading-lazy turbo-frame h2"
  const contents = await page.locator(frameContents)
  await expect(contents).not.toBeVisible()
  expect(await hasSelector(page, "#loading-lazy turbo-frame:not([complete])")).toEqual(true)

  await page.click("#loading-lazy summary")

  await expect(contents).toHaveText("Hello from a frame")
  expect(await hasSelector(page, "#loading-lazy turbo-frame[complete]")).toEqual(true)
})

test("changing loading attribute from lazy to eager loads frame", async ({ page }) => {
  const frameContents = await page.locator("#loading-lazy turbo-frame h2")

  await expect(frameContents).not.toBeVisible()

  await page.evaluate(() => document.querySelector("#loading-lazy turbo-frame")?.setAttribute("loading", "eager"))

  await page.click("#loading-lazy summary")
  await expect(frameContents).toHaveText("Hello from a frame")
})

test("navigating a visible frame with loading=lazy navigates", async ({ page }) => {
  await page.click("#loading-lazy summary")

  const initialContents = await page.locator("#hello h2")
  await expect(initialContents).toHaveText("Hello from a frame")

  await page.click("#hello a")

  const navigatedContents = await page.locator("#hello h2")
  await expect(navigatedContents).toHaveText("Frames: #hello")
})

test("changing src attribute on a frame with loading=lazy defers navigation", async ({ page }) => {
  const frameContents = await page.locator("#loading-lazy turbo-frame h2")

  await page.evaluate(() =>
    document.querySelector("#loading-lazy turbo-frame")?.setAttribute("src", "/src/tests/fixtures/frames.html")
  )
  await expect(frameContents).not.toBeVisible()

  await page.click("#loading-lazy summary")

  await expect(frameContents).toHaveText("Frames: #hello")
})

test("changing src attribute on a frame with loading=eager navigates", async ({ page }) => {
  const frame = await page.locator("#loading-eager turbo-frame")
  const frameContents = await frame.locator("h2")

  await frame.evaluate((frame) =>
    frame.setAttribute("src", "/src/tests/fixtures/frames.html")
  )

  await page.click("#loading-eager summary")

  await expect(frameContents).toHaveText("Frames: #frame")
})

test("reloading a frame reloads the content", async ({ page }) => {
  const frame = await page.locator("#loading-eager turbo-frame#frame")
  await page.click("#loading-eager summary")
  await nextEventOnTarget(page, "frame", "turbo:frame-load")

  const frameContent = await frame.locator("h2")
  await expect(frameContent).toBeVisible()
  expect(await nextAttributeMutationNamed(page, "frame", "complete")).toEqual("")

  await frame.evaluate(() => frame.reload())
  await expect(frameContent).toBeVisible()
  expect(await nextAttributeMutationNamed(page, "frame", "complete")).toEqual(null)
})

test("navigating away from a page does not reload its frames", async ({ page }) => {
  await page.click("#one")

  const eventLogs = await readEventLogs(page)
  const requestLogs = eventLogs.filter(([name]) => name == "turbo:before-fetch-request")
  expect(requestLogs.length).toEqual(1)
})

test("removing the [complete] attribute of an eager frame reloads the content", async ({ page }) => {
  const frame = await page.locator("#loading-eager turbo-frame")
  await nextEventOnTarget(page, "frame", "turbo:frame-load")
  await frame.evaluate((frame) => frame.removeAttribute("complete"))
  await nextEventOnTarget(page, "frame", "turbo:frame-load")

  expect(
    await hasSelector(page, "#loading-eager turbo-frame[complete]")
  ).toEqual(true)
})

test("changing [src] attribute on a [complete] frame with loading=lazy defers navigation", async ({ page }) => {
  await page.click("#loading-lazy summary")
  await nextEventOnTarget(page, "hello", "turbo:frame-load")

  expect(await hasSelector(page, "#loading-lazy turbo-frame[complete]")).toEqual(true)
  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")

  await page.click("#loading-lazy summary")
  await page.click("#one")
  await nextEventNamed(page, "turbo:load")
  await page.goBack()
  await nextEventNamed(page, "turbo:load")

  expect(await noNextEventOnTarget(page, "hello", "turbo:frame-load")).toEqual(true)

  let src = new URL((await attributeForSelector(page, "#hello", "src")) || "")

  expect(await hasSelector(page, "#loading-lazy turbo-frame[complete]")).toEqual(true)
  expect(src.pathname).toEqual("/src/tests/fixtures/frames/hello.html")

  await page.click("#link-lazy-frame")

  expect(await noNextEventOnTarget(page, "hello", "turbo:frame-load")).toEqual(true)
  expect(await hasSelector(page, "#loading-lazy turbo-frame:not([complete])")).toEqual(true)

  await page.click("#loading-lazy summary")
  await nextEventOnTarget(page, "hello", "turbo:frame-load")

  src = new URL((await attributeForSelector(page, "#hello", "src")) || "")

  await expect(page.locator("#loading-lazy turbo-frame h2")).toHaveText("Frames: #hello")
  expect(await hasSelector(page, "#loading-lazy turbo-frame[complete]")).toEqual(true)
  expect(src.pathname).toEqual("/src/tests/fixtures/frames.html")
})

test("navigating away from a page and then back does not reload its frames", async ({ page }) => {
  await page.click("#one")
  await nextBody(page)
  await readEventLogs(page)
  await page.goBack()
  await nextBody(page)

  const eventLogs = await readEventLogs(page)
  const requestLogs = eventLogs.filter(([name]) => name == "turbo:before-fetch-request")
  const requestsOnEagerFrame = requestLogs.filter((record) => record[2] == "frame")
  const requestsOnLazyFrame = requestLogs.filter((record) => record[2] == "hello")

  expect(requestsOnEagerFrame.length).toEqual(0)
  expect(requestsOnLazyFrame.length).toEqual(0)

  await page.click("#loading-lazy summary")
  await nextEventOnTarget(page, "hello", "turbo:before-fetch-request")
  await nextEventOnTarget(page, "hello", "turbo:frame-render")
  await nextEventOnTarget(page, "hello", "turbo:frame-load")
})

test("disconnecting and reconnecting a frame does not reload the frame", async ({ page }) => {
  await nextBeat()

  await page.evaluate(() => {
    window.savedElement = document.querySelector("#loading-eager")
    window.savedElement?.remove()
  })
  await nextBeat()

  await page.evaluate(() => {
    if (window.savedElement) {
      document.body.appendChild(window.savedElement)
    }
  })
  await nextBeat()

  const eventLogs = await readEventLogs(page)
  const requestLogs = eventLogs.filter(([name]) => name == "turbo:before-fetch-request")
  expect(requestLogs.length).toEqual(0)
})
