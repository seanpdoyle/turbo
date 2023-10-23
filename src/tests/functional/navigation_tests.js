import { expect, test } from "@playwright/test"
import {
  clickWithoutScrolling,
  getSearchParam,
  hash,
  isScrolledToSelector,
  nextAttributeMutationNamed,
  nextBeat,
  nextBody,
  nextEventNamed,
  noNextEventNamed,
  pathname,
  pathnameForIFrame,
  readEventLogs,
  search,
  selectorHasFocus,
  visitAction,
  willChangeBody
} from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/navigation.html")
  await readEventLogs(page)
})

test("navigating renders a progress bar until the next turbo:load", async ({ page }) => {
  await page.evaluate(() => window.Turbo.setProgressBarDelay(0))
  await page.click("#delayed-link")

  await expect(page.locator(".turbo-progress-bar")).toBeVisible()

  await nextEventNamed(page, "turbo:render")
  assert.ok(await hasSelector(page, ".turbo-progress-bar"), "displays progress bar")

  await nextEventNamed(page, "turbo:load")
  await expect(page.locator(".turbo-progress-bar")).not.toBeVisible()
})

test("navigating does not render a progress bar before expiring the delay", async ({ page }) => {
  await page.evaluate(() => window.Turbo.setProgressBarDelay(1000))
  await page.click("#same-origin-unannotated-link")

  await expect(page.locator(".turbo-progress-bar")).not.toBeVisible()
})

test("navigating hides the progress bar on failure", async ({ page }) => {
  await page.evaluate(() => window.Turbo.setProgressBarDelay(0))
  await page.click("#delayed-failure-link")

  await waitUntilSelector(page, ".turbo-progress-bar")
  await waitUntilNoSelector(page, ".turbo-progress-bar")
})

test("after loading the page", async ({ page }) => {
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin unannotated link", async ({ page }) => {
  await page.click("#same-origin-unannotated-link")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("advance")
  expect(
    await nextAttributeMutationNamed(page, "html", "aria-busy")
  ).toEqual(
    "true"
  )
  expect(
    await nextAttributeMutationNamed(page, "html", "aria-busy")
  ).toEqual(
    null
  )
})

test("following a same-origin unannotated custom element link", async ({ page }) => {
  await nextBeat()
  await page.evaluate(() => {
    const shadowRoot = document.querySelector("#custom-link-element")?.shadowRoot
    const link = shadowRoot?.querySelector("a")
    link?.click()
  })
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(search(page.url())).toEqual("")
  expect(await visitAction(page)).toEqual("advance")
})

test("drive enabled; click an element in the shadow DOM wrapped by a link in the light DOM", async ({ page }) => {
  await page.click("#shadow-dom-drive-enabled span")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("advance")
})

test("drive disabled; click an element in the shadow DOM within data-turbo='false'", async ({ page }) => {
  await page.click("#shadow-dom-drive-disabled span")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("load")
})

test("drive enabled; click an element in the slot", async ({ page }) => {
  await page.click("#element-in-slot")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("advance")
})

test("drive disabled; click an element in the slot within data-turbo='false'", async ({ page }) => {
  await page.click("#element-in-slot-disabled")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("load")
})

test("drive disabled; click an element in the nested slot within data-turbo='false'", async ({ page }) => {
  await page.click("#element-in-nested-slot-disabled")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin unannotated link with search params", async ({ page }) => {
  await page.click("#same-origin-unannotated-link-search-params")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(search(page.url())).toEqual("?key=value")
  expect(await visitAction(page)).toEqual("advance")
})

test("following a same-origin unannotated form[method=GET]", async ({ page }) => {
  await page.click("#same-origin-unannotated-form button")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("advance")
})

test("following a same-origin data-turbo-method=get link", async ({ page }) => {
  await page.click("#same-origin-get-link-form")
  await nextEventNamed(page, "turbo:submit-start")
  await nextEventNamed(page, "turbo:submit-end")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(getSearchParam(page.url(), "a")).toEqual("one")
  expect(getSearchParam(page.url(), "b")).toEqual("two")
})

test("following a same-origin data-turbo-action=replace link", async ({ page }) => {
  await page.click("#same-origin-replace-link")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin GET form[data-turbo-action=replace]", async ({ page }) => {
  await page.click("#same-origin-replace-form-get button")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin GET form button[data-turbo-action=replace]", async ({ page }) => {
  await page.click("#same-origin-replace-form-submitter-get button")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin POST form[data-turbo-action=replace]", async ({ page }) => {
  await page.click("#same-origin-replace-form-post button")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin POST form button[data-turbo-action=replace]", async ({ page }) => {
  await page.click("#same-origin-replace-form-submitter-post button")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("replace")
})

test("following a POST form clears cache", async ({ page }) => {
  await page.evaluate(() => {
    const cachedElement = document.createElement("some-cached-element")
    document.body.appendChild(cachedElement)
  })

  await page.click("#form-post-submit")
  await nextBeat() // 301 redirect response
  await nextBeat() // 200 response

  await expect(page.locator("h1")).toHaveText("One")

  await page.goBack()

  await expect(page.locator("h1")).toHaveText("Navigation")
  await expect(page.locator("some-cached-element")).not.toBeVisible()
})

test("following a same-origin POST link with data-turbo-action=replace", async ({ page }) => {
  await page.click("#same-origin-replace-post-link")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("replace")
})

test("following a same-origin data-turbo=false link", async ({ page }) => {
  await page.click("#same-origin-false-link")
  await page.waitForEvent("load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin unannotated link inside a data-turbo=false container", async ({ page }) => {
  await page.click("#same-origin-unannotated-link-inside-false-container")
  await page.waitForEvent("load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin data-turbo=true link inside a data-turbo=false container", async ({ page }) => {
  await page.click("#same-origin-true-link-inside-false-container")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("advance")
})

test("following a same-origin anchored link", async ({ page }) => {
  await page.click("#same-origin-anchored-link")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(hash(page.url())).toEqual("#element-id")
  expect(await visitAction(page)).toEqual("advance")
  expect(await isScrolledToSelector(page, "#element-id")).toEqual(true)
})

test("following a same-origin link to a named anchor", async ({ page }) => {
  await page.click("#same-origin-anchored-link-named")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(hash(page.url())).toEqual("#named-anchor")
  expect(await visitAction(page)).toEqual("advance")
  expect(await isScrolledToSelector(page, "[name=named-anchor]")).toEqual(true)
})

test("following a cross-origin unannotated link", async ({ page }) => {
  await page.click("#cross-origin-unannotated-link")

  expect(page.url()).toEqual("about:blank")
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin [target] link", async ({ page }) => {
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("#same-origin-targeted-link")])

  expect(pathname(popup.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(popup)).toEqual("load")
})

test("following a same-origin [download] link", async ({ page }) => {
  expect(
    await willChangeBody(page, async () => {
      await page.click("#same-origin-download-link")
      await nextBeat()
    })
  ).toEqual(false)
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(await visitAction(page)).toEqual("load")
})

test("following a same-origin link inside an SVG element", async ({ page }) => {
  await page.click("#same-origin-link-inside-svg-element", { force: true })
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("advance")
})

test("following a cross-origin link inside an SVG element", async ({ page }) => {
  await page.click("#cross-origin-link-inside-svg-element", { force: true })

  expect(page.url()).toEqual("about:blank")
  expect(await visitAction(page)).toEqual("load")
})

test("clicking the back button", async ({ page }) => {
  await page.click("#same-origin-unannotated-link")
  await nextEventNamed(page, "turbo:load")
  await page.goBack()
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(await visitAction(page)).toEqual("restore")
})

test("clicking the forward button", async ({ page }) => {
  await page.click("#same-origin-unannotated-link")
  await nextEventNamed(page, "turbo:load")
  await page.goBack()
  await page.goForward()
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("restore")
})

test("link targeting a disabled turbo-frame navigates the page", async ({ page }) => {
  await page.click("#link-to-disabled-frame")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/frames/hello.html")
})

test("skip link with hash-only path scrolls to the anchor without a visit", async ({ page }) => {
  expect(
    await willChangeBody(page, async () => {
      await page.click('a[href="#main"]')
      await nextBeat()
    })
  ).toEqual(false)

  expect(await isScrolledToSelector(page, "#main")).toEqual(true)
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(hash(page.url())).toEqual("#main")
})

test("skip link with hash-only path moves focus and changes tab order", async ({ page }) => {
  await page.click('a[href="#main"]')
  await nextBeat()
  await page.press("#main", "Tab")

  await expect(page.locator("#ignored-link")).not.toBeFocused()
  expect(await selectorHasFocus(page, "#main *:focus")).toEqual(true)
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(hash(page.url())).toEqual("#main")
})

test("same-page anchored replace link assumes the intention was a refresh", async ({ page }) => {
  await page.click("#refresh-link")
  await nextEventNamed(page, "turbo:load")
  expect(await isScrolledToSelector(page, "#main"), "scrolled to #main").toEqual(true)
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(hash(page.url())).toEqual("#main")
})

test("navigating back to anchored URL", async ({ page }) => {
  await clickWithoutScrolling(page, 'a[href="#main"]', { hasText: "Skip Link" })
  await nextBeat()

  await clickWithoutScrolling(page, "#same-origin-unannotated-link")
  await nextEventNamed(page, "turbo:load")
  await nextBeat()

  await page.goBack()
  await nextEventNamed(page, "turbo:load")

  expect(await isScrolledToSelector(page, "#main")).toEqual(true)
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(hash(page.url())).toEqual("#main")
})

test("following a redirection", async ({ page }) => {
  await page.click("#redirection-link")
  await nextEventNamed(page, "turbo:load")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("replace")
})

test("clicking the back button after redirection", async ({ page }) => {
  await page.click("#redirection-link")
  await nextEventNamed(page, "turbo:load")
  await page.goBack()
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(await visitAction(page)).toEqual("restore")
})

test("same-page anchor visits do not trigger visit events", async ({ page }) => {
  const events = [
    "turbo:before-visit",
    "turbo:visit",
    "turbo:before-cache",
    "turbo:before-render",
    "turbo:render",
    "turbo:load"
  ]

  for (const eventName in events) {
    await page.goto("/src/tests/fixtures/navigation.html")
    await page.click('a[href="#main"]')
    expect(await noNextEventNamed(page, eventName)).toEqual(true)
  }
})

test("correct referrer header", async ({ page }) => {
  await page.click("#headers-link")
  await nextEventNamed(page, "turbo:load")
  const pre = await page.textContent("pre")
  const headers = await JSON.parse(pre || "")
  expect(
    headers.referer
  ).toEqual(
    "http://localhost:9000/src/tests/fixtures/navigation.html"
  )
})

test("double-clicking on a link", async ({ page }) => {
  await page.click("#delayed-link", { clickCount: 2 })

  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/__turbo/delayed_response")
  expect(await visitAction(page)).toEqual("advance")
})

test("does not fire turbo:load twice after following a redirect", async ({ page }) => {
  await page.click("#redirection-link")

  await nextBeat() // 301 redirect response

  expect(await noNextEventNamed(page, "turbo:load")).toEqual(true)

  await nextBeat() // 200 response
  await nextBody(page)
  await nextEventNamed(page, "turbo:load")
})

test("navigating back whilst a visit is in-flight", async ({ page }) => {
  await page.click("#delayed-link")
  await nextEventNamed(page, "turbo:before-render")
  await page.goBack()

  await nextEventNamed(page, "turbo:visit")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(await visitAction(page)).toEqual("restore")
})

test("ignores links with a [target] attribute that target an iframe with a matching [name]", async ({ page }) => {
  await page.click("#link-target-iframe")
  await nextBeat()
  await noNextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(await pathnameForIFrame(page, "iframe")).toEqual("/src/tests/fixtures/one.html")
})

test("ignores links with a [target] attribute that targets an iframe with [name='']", async ({ page }) => {
  await page.click("#link-target-empty-name-iframe")
  await nextBeat()
  await noNextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
})

test("ignores forms with a [target] attribute that targets an iframe with a matching [name]", async ({ page }) => {
  await page.click("#form-target-iframe button")
  await nextBeat()
  await noNextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(await pathnameForIFrame(page, "iframe")).toEqual("/src/tests/fixtures/one.html")
})

test("ignores forms with a button[formtarget] attribute that targets an iframe with [name='']", async ({
  page
}) => {
  await page.click("#form-target-empty-name-iframe button")
  await nextBeat()
  await noNextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
})

test("ignores forms with a button[formtarget] attribute that targets an iframe with a matching [name]", async ({
  page
}) => {
  await page.click("#button-formtarget-iframe")
  await nextBeat()
  await noNextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/navigation.html")
  expect(await pathnameForIFrame(page, "iframe")).toEqual("/src/tests/fixtures/one.html")
})

test("ignores forms with a [target] attribute that target an iframe with [name='']", async ({ page }) => {
  await page.click("#button-formtarget-empty-name-iframe")
  await nextBeat()
  await noNextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
})
