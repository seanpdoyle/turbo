import { expect, test } from "@playwright/test"
import { get } from "http"
import {
  cancelNextEvent,
  getSearchParam,
  isScrolledToSelector,
  isScrolledToTop,
  nextBeat,
  nextEventNamed,
  noNextAttributeMutationNamed,
  pathname,
  readEventLogs,
  scrollToSelector,
  visitAction,
  willChangeBody
} from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/visit.html")
  await readEventLogs(page)
})

test("programmatically visiting a same-origin location", async ({ page }) => {
  const urlBeforeVisit = page.url()
  await visitLocation(page, "/src/tests/fixtures/one.html")

  await nextBeat()

  const urlAfterVisit = page.url()
  expect(urlBeforeVisit).not.toEqual(urlAfterVisit)
  expect(await visitAction(page)).toEqual("advance")

  const { url: urlFromBeforeVisitEvent } = await nextEventNamed(page, "turbo:before-visit")
  expect(urlFromBeforeVisitEvent).toEqual(urlAfterVisit)

  const { url: urlFromVisitEvent } = await nextEventNamed(page, "turbo:visit")
  expect(urlFromVisitEvent).toEqual(urlAfterVisit)

  const { timing } = await nextEventNamed(page, "turbo:load")
  expect(timing).not.toEqual(null)
})

test("skip programmatically visiting a cross-origin location falls back to window.location", async ({ page }) => {
  const urlBeforeVisit = page.url()
  await visitLocation(page, "about:blank")

  const urlAfterVisit = page.url()
  expect(urlBeforeVisit).not.toEqual(urlAfterVisit)
  expect(await visitAction(page)).toEqual("load")
})

test("visiting a location served with a non-HTML content type", async ({ page }) => {
  const urlBeforeVisit = page.url()
  await visitLocation(page, "/src/tests/fixtures/svg.svg")
  await nextBeat()

  const url = page.url()
  const contentType = await contentTypeOfURL(url)
  expect(contentType).toEqual("image/svg+xml")

  const urlAfterVisit = page.url()
  expect(urlBeforeVisit).not.toEqual(urlAfterVisit)
  expect(await visitAction(page)).toEqual("load")
})

test("canceling a turbo:click event falls back to built-in browser navigation", async ({ page }) => {
  await cancelNextEvent(page, "turbo:click")
  await Promise.all([page.waitForNavigation(), page.click("#same-origin-link")])

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
})

test("canceling a before-visit event prevents navigation", async ({ page }) => {
  await cancelNextVisit(page)
  const urlBeforeVisit = page.url()

  expect(
    await willChangeBody(page, async () => {
      await page.click("#same-origin-link")
      await nextBeat()
    })
  ).toEqual(false)

  const urlAfterVisit = page.url()
  expect(urlAfterVisit).toEqual(urlBeforeVisit)
})

test("navigation by history is not cancelable", async ({ page }) => {
  await page.click("#same-origin-link")
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("h1")).toHaveText("One")

  await cancelNextVisit(page)
  await page.goBack()
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("h1")).toHaveText("Visit")
})

test("turbo:before-fetch-request event.detail", async ({ page }) => {
  await page.click("#same-origin-link")
  const { url, fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.method).toEqual("get")
  expect(url).toContain("/src/tests/fixtures/one.html")
})

test("turbo:before-fetch-request event.detail encodes searchParams", async ({ page }) => {
  await page.click("#same-origin-link-search-params")
  const { url } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(url).toContain("/src/tests/fixtures/one.html?key=value")
})

test("turbo:before-fetch-response open new site", async ({ page }) => {
  await page.evaluate(() =>
    addEventListener(
      "turbo:before-fetch-response",
      async (event) => {
        window.fetchResponseResult = {
          responseText: await event.detail.fetchResponse.responseText,
          responseHTML: await event.detail.fetchResponse.responseHTML
        }
      },
      { once: true }
    )
  )

  await page.click("#sample-response")
  await nextEventNamed(page, "turbo:before-fetch-response")

  const fetchResponseResult = await page.evaluate(() => window.fetchResponseResult)

  expect(fetchResponseResult.responseText.indexOf("An element with an ID") > -1).toEqual(true)
  expect(fetchResponseResult.responseHTML.indexOf("An element with an ID") > -1).toEqual(true)
})

test("visits with data-turbo-stream include MIME type & search params", async ({ page }) => {
  await page.click("#stream-link")
  const { fetchOptions, url } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).toContain("text/vnd.turbo-stream.html")
  expect(getSearchParam(url, "key")).toEqual("value")
})

test("visits with data-turbo-stream do not set aria-busy", async ({ page }) => {
  await page.click("#stream-link")

  expect(
    await noNextAttributeMutationNamed(page, "html", "aria-busy"),
    "never sets [aria-busy] on the document element"
  ).toEqual(true)
})

test("cache does not override response after redirect", async ({ page }) => {
  await page.evaluate(() => {
    const cachedElement = document.createElement("some-cached-element")
    document.body.appendChild(cachedElement)
  })

  expect(await page.locator("some-cached-element").count()).toEqual(1)

  await page.click("#same-origin-link")
  await nextBeat()
  await page.click("#redirection-link")
  await nextBeat() // 301 redirect response
  await nextBeat() // 200 response

  expect(await page.locator("some-cached-element").count()).toEqual(0)
})

function cancelNextVisit(page) {
  return cancelNextEvent(page, "turbo:before-visit")
}

function contentTypeOfURL(url) {
  return new Promise((resolve) => {
    get(url, ({ headers }) => resolve(headers["content-type"]))
  })
}

test("can scroll to element after click-initiated turbo:visit", async ({ page }) => {
  const id = "below-the-fold-link"
  await page.evaluate((id) => {
    addEventListener("turbo:load", () => document.getElementById(id)?.scrollIntoView())
  }, id)

  expect(await isScrolledToTop(page)).toEqual(true)

  await page.click("#same-page-link")
  await nextEventNamed(page, "turbo:load")

  expect(await isScrolledToSelector(page, "#" + id)).toEqual(true)
})

test("can scroll to element after history-initiated turbo:visit", async ({ page }) => {
  const id = "below-the-fold-link"
  await page.evaluate((id) => {
    addEventListener("turbo:load", () => document.getElementById(id)?.scrollIntoView())
  }, id)

  await scrollToSelector(page, "#" + id)
  await page.click("#" + id)
  await nextEventNamed(page, "turbo:load")
  await page.goBack()
  await nextEventNamed(page, "turbo:load")

  expect(await isScrolledToSelector(page, "#" + id)).toEqual(true)
})

test("Visit with network error", async ({ page }) => {
  await page.evaluate(() => {
    addEventListener("turbo:fetch-request-error", (event) => event.preventDefault())
  })
  await page.context().setOffline(true)
  await page.click("#same-origin-link")
  await nextEventNamed(page, "turbo:fetch-request-error")
})

async function visitLocation(page, location) {
  return page.evaluate((location) => window.Turbo.visit(location), location)
}
