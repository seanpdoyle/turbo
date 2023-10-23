import { expect, test } from "@playwright/test"
import {
  getFromLocalStorage,
  getSearchParam,
  hasSelector,
  isScrolledToTop,
  nextAttributeMutationNamed,
  nextBeat,
  nextBody,
  nextEventNamed,
  nextEventOnTarget,
  noNextEventNamed,
  outerHTMLForSelector,
  pathname,
  readEventLogs,
  scrollToSelector,
  search,
  searchParams,
  setLocalStorageFromEvent,
  visitAction
} from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/form.html")
  await setLocalStorageFromEvent(page, "turbo:submit-start", "formSubmitStarted", "true")
  await setLocalStorageFromEvent(page, "turbo:submit-end", "formSubmitEnded", "true")
  await readEventLogs(page)
})

test("standard form submission renders a progress bar", async ({ page }) => {
  await page.evaluate(() => window.Turbo.setProgressBarDelay(0))
  await page.click("#standard form.sleep input[type=submit]")

  await expect(page.locator(".turbo-progress-bar")).toBeVisible()
  await expect(page.locator(".turbo-progress-bar")).not.toBeVisible()
})

test("form submission with confirmation confirmed", async ({ page }) => {
  page.on("dialog", (alert) => {
    expect(alert.message()).toEqual("Are you sure?")
    alert.accept()
  })

  await page.click("#standard form.confirm input[type=submit]")

  await nextEventNamed(page, "turbo:load")
  expect(await formSubmitStarted(page)).toEqual("true")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
})

test("form submission with confirmation cancelled", async ({ page }) => {
  page.on("dialog", (alert) => {
    expect(alert.message()).toEqual("Are you sure?")
    alert.dismiss()
  })
  await page.click("#standard form.confirm input[type=submit]")

  expect(await formSubmitStarted(page)).not.toEqual("true")
})

test("form submission with secondary submitter click - confirmation confirmed", async ({ page }) => {
  page.on("dialog", (alert) => {
    expect(alert.message()).toEqual("Are you really sure?")
    alert.accept()
  })

  await page.click("#standard form.confirm #secondary_submitter")

  await nextEventNamed(page, "turbo:load")
  expect(await formSubmitStarted(page)).toEqual("true")
  expect(await pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("advance")
  expect(getSearchParam(page.url(), "greeting")).toEqual("secondary_submitter")
})

test("form submission with secondary submitter click - confirmation cancelled", async ({ page }) => {
  page.on("dialog", (alert) => {
    expect(alert.message()).toEqual("Are you really sure?")
    alert.dismiss()
  })

  await page.click("#standard form.confirm #secondary_submitter")

  expect(await formSubmitStarted(page)).not.toEqual("true")
})

test("from submission with confirmation overridden", async ({ page }) => {
  page.on("dialog", (alert) => {
    expect(alert.message()).toEqual("Overridden message")
    alert.accept()
  })

  await page.evaluate(() => window.Turbo.setConfirmMethod(() => Promise.resolve(confirm("Overridden message"))))
  await page.click("#standard form.confirm input[type=submit]")

  expect(await formSubmitStarted(page)).toEqual("true")
})

test("standard form submission does not render a progress bar before expiring the delay", async ({ page }) => {
  await page.evaluate(() => window.Turbo.setProgressBarDelay(500))
  await page.click("#standard form.redirect input[type=submit]")

  await expect(page.locator(".turbo-progress-bar")).not.toBeVisible()
})

test("standard POST form submission with redirect response", async ({ page }) => {
  await page.click("#standard form.redirect input[type=submit]")
  await nextEventNamed(page, "turbo:load")

  expect(await formSubmitStarted(page)).toEqual("true")
  expect(await pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(await visitAction(page)).toEqual("advance")
  expect(getSearchParam(page.url(), "greeting")).toEqual("Hello from a redirect")
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

test("standard POST form submission events", async ({ page }) => {
  await page.click("#standard-post-form-submit")

  expect(await formSubmitStarted(page)).toEqual("true")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).toContain("text/vnd.turbo-stream.html")

  await nextEventNamed(page, "turbo:before-fetch-response")

  expect(await formSubmitEnded(page)).toEqual("true")

  await nextEventNamed(page, "turbo:before-visit")
  await nextEventNamed(page, "turbo:visit")
  await nextEventNamed(page, "turbo:before-render")
  await nextEventNamed(page, "turbo:render")
  await nextEventNamed(page, "turbo:load")
})

test("supports transforming a POST submission to a GET in a turbo:submit-start listener", async ({ page }) => {
  await page.evaluate(() =>
    addEventListener("turbo:submit-start", (({ detail }) => {
      detail.formSubmission.method = "get"
      detail.formSubmission.action = "/src/tests/fixtures/one.html"
      detail.formSubmission.body.set("greeting", "Hello, from an event listener")
    }))
  )
  await page.click("#standard form[method=post] [type=submit]")

  await expect(page.locator("h1")).toHaveText("One")
  expect(getSearchParam(page.url(), "greeting")).toEqual("Hello, from an event listener")
})

test("supports transforming a GET submission to a POST in a turbo:submit-start listener", async ({ page }) => {
  await page.evaluate(() =>
    addEventListener("turbo:submit-start", (({ detail }) => {
      detail.formSubmission.method = "post"
      detail.formSubmission.body.set("path", "/src/tests/fixtures/one.html")
      detail.formSubmission.body.set("greeting", "Hello, from an event listener")
    }))
  )
  await page.click("#standard form[method=get] [type=submit]")

  await expect(page.locator("h1")).toHaveText("One")
  expect(getSearchParam(page.url(), "greeting")).toEqual("Hello, from an event listener")
})

test("supports modifying the submission in a turbo:before-fetch-request listener", async ({ page }) => {
  await page.evaluate(() =>
    addEventListener("turbo:before-fetch-request", (({ detail }) => {
      detail.url = new URL("/src/tests/fixtures/one.html", document.baseURI)
      detail.url.search = new URLSearchParams(detail.fetchOptions.body).toString()
      detail.fetchOptions.body = null
      detail.fetchOptions.method = "get"
    }))
  )
  await page.click("#standard form[method=post] [type=submit]")

  await expect(page.locator("h1")).toHaveText("One")
  expect(getSearchParam(page.url(), "greeting")).toEqual("Hello from a redirect")
})

test("standard POST form submission merges values from both searchParams and body", async ({ page }) => {
  await page.click("#form-action-post-redirect-self-q-b")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "q")).toEqual("b")
  expect(getSearchParam(page.url(), "sort")).toEqual("asc")
})

test("standard POST form submission merges values from both searchParams and body", async ({ page }) => {
  await page.click("#form-action-post-redirect-self-q-b")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "q")).toEqual("b")
  expect(getSearchParam(page.url(), "sort")).toEqual("asc")
})

test("standard POST form submission toggles submitter [disabled] attribute", async ({ page }) => {
  await page.click("#standard-post-form-submit")

  expect(
    await nextAttributeMutationNamed(page, "standard-post-form-submit", "disabled")
  ).toEqual(
    ""
  )
  expect(
    await nextAttributeMutationNamed(page, "standard-post-form-submit", "disabled")
  ).toEqual(
    null
  )
})

test("replaces input value with data-turbo-submits-with on form submission", async ({ page }) => {
  await page.click("#submits-with-form-input")

  expect(
    await nextAttributeMutationNamed(page, "submits-with-form-input", "value")
  ).toEqual(
    "Saving..."
  )

  expect(
    await nextAttributeMutationNamed(page, "submits-with-form-input", "value")
  ).toEqual(
    "Save"
  )
})

test("replaces button innerHTML with data-turbo-submits-with on form submission", async ({ page }) => {
  await page.click("#submits-with-form-button")

  await nextEventNamed(page, "turbo:submit-start")
  await expect(
    page.locator("#submits-with-form-button")
  ).toHaveText(
    "Saving..."
  )

  await nextEventNamed(page, "turbo:submit-end")
  await expect(
    page.locator("#submits-with-form-button")
  ).toHaveText(
    "Save"
  )
})

test("standard GET form submission", async ({ page }) => {
  await page.click("#standard form.greeting input[type=submit]")
  await nextBody(page)

  expect(await formSubmitStarted(page)).toEqual("true")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(await visitAction(page)).toEqual("advance")
  expect(getSearchParam(page.url(), "greeting")).toEqual("Hello from a form")
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

test("standard GET HTMLFormElement.requestSubmit() with Turbo Action", async ({ page }) => {
  const select = await page.locator("#external-select")
  await select.evaluate((formControl) => {
    if (formControl && formControl.form) formControl.form.requestSubmit()
  })
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("h1")).toHaveText("Form")
  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")
  expect(await visitAction(page)).toEqual("replace")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/frames/hello.html")
  expect(getSearchParam(page.url(), "greeting")).toEqual("Hello from a replace Visit")
})

test("GET HTMLFormElement.requestSubmit() triggered by javascript", async ({ page }) => {
  await page.click("#request-submit-trigger")

  expect(pathname(page.url())).not.toEqual("/src/tests/fixtures/one.html")
  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")
})

test("standard GET form submission with [data-turbo-stream] declared on the form", async ({ page }) => {
  await page.click("#standard-get-form-with-stream-opt-in-submit")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).toContain("text/vnd.turbo-stream.html")
})

test("standard GET form submission with [data-turbo-stream] declared on submitter", async ({ page }) => {
  await page.click("#standard-get-form-with-stream-opt-in-submitter")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).toContain("text/vnd.turbo-stream.html")
})

test("standard GET form submission events", async ({ page }) => {
  await page.click("#standard-get-form-submit")

  expect(await formSubmitStarted(page)).toEqual("true")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).not.toContain("text/vnd.turbo-stream.html")

  await nextEventNamed(page, "turbo:before-fetch-response")

  expect(await formSubmitEnded(page)).toEqual("true")

  await nextEventNamed(page, "turbo:before-visit")
  await nextEventNamed(page, "turbo:visit")
  await nextEventNamed(page, "turbo:before-cache")
  await nextEventNamed(page, "turbo:before-render")
  await nextEventNamed(page, "turbo:render")
  await nextEventNamed(page, "turbo:load")
})

test("standard GET form submission does not incorporate the current page's URLSearchParams values into the submission", async ({
  page
}) => {
  await page.click("#form-action-self-sort")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(search(page.url())).toEqual("?sort=asc")

  await page.click("#form-action-none-q-a")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(search(page.url())).toEqual("?q=a")
})

test("standard GET form submission does not merge values into the [action] attribute", async ({ page }) => {
  await page.click("#form-action-self-sort")
  await nextEventNamed(page, "turbo:load")

  expect(await pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(await search(page.url())).toEqual("?sort=asc")

  await page.click("#form-action-self-q-b")
  await nextEventNamed(page, "turbo:load")

  expect(await pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(await search(page.url())).toEqual("?q=b")
})

test("standard GET form submission omits the [action] value's URLSearchParams from the submission", async ({
  page
}) => {
  await page.click("#form-action-self-submit")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(search(page.url())).toEqual("")
})

test("standard GET form submission toggles submitter [disabled] attribute", async ({ page }) => {
  await page.click("#standard-get-form-submit")

  expect(
    await nextAttributeMutationNamed(page, "standard-get-form-submit", "disabled")
  ).toEqual(
    ""
  )
  expect(
    await nextAttributeMutationNamed(page, "standard-get-form-submit", "disabled")
  ).toEqual(
    null
  )
})

test("standard GET form submission appending keys", async ({ page }) => {
  await page.goto("/src/tests/fixtures/form.html?query=1")
  await page.click("#standard form.conflicting-values input[type=submit]")
  await nextBody(page)

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "query")).toEqual("2")
})

test("standard form submission with empty created response", async ({ page }) => {
  const htmlBefore = await outerHTMLForSelector(page, "body")
  await page.click("#standard form.created input[type=submit]")
  await nextBeat()

  const htmlAfter = await outerHTMLForSelector(page, "body")
  expect(htmlAfter).toEqual(htmlBefore)
})

test("standard form submission with empty no-content response", async ({ page }) => {
  const htmlBefore = await outerHTMLForSelector(page, "body")
  await page.click("#standard form.no-content input[type=submit]")
  await nextBeat()

  const htmlAfter = await outerHTMLForSelector(page, "body")
  expect(htmlAfter).toEqual(htmlBefore)
})

test("standard POST form submission with multipart/form-data enctype", async ({ page }) => {
  await page.click("#standard form[method=post][enctype] input[type=submit]")
  await nextBeat()

  const enctype = getSearchParam(page.url(), "enctype")
  expect(enctype).toContain("multipart/form-data")
})

test("standard GET form submission ignores enctype", async ({ page }) => {
  await page.click("#standard form[method=get][enctype] input[type=submit]")
  await nextBeat()

  const enctype = getSearchParam(page.url(), "enctype")
  expect(enctype).not.toBe()
})

test("standard POST form submission without an enctype", async ({ page }) => {
  await page.click("#standard form[method=post].no-enctype input[type=submit]")
  await nextBeat()

  const enctype = getSearchParam(page.url(), "enctype")
  expect(enctype).toContain("application/x-www-form-urlencoded")
})

test("no-action form submission with single parameter", async ({ page }) => {
  await page.click("#no-action form.single input[type=submit]")
  await nextBody(page)

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "query")).toEqual("1")

  await page.click("#no-action form.single input[type=submit]")
  await nextBody(page)

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "query")).toEqual("1")

  await page.goto("/src/tests/fixtures/form.html?query=2")
  await page.click("#no-action form.single input[type=submit]")
  await nextBody(page)

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "query")).toEqual("1")
})

test("no-action form submission with multiple parameters", async ({ page }) => {
  await page.goto("/src/tests/fixtures/form.html?query=2")
  await page.click("#no-action form.multiple input[type=submit]")
  await nextBody(page)

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(searchParams(page.url()).getAll("query")).toEqual(["1", "2"])

  await page.click("#no-action form.multiple input[type=submit]")
  await nextBody(page)

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(searchParams(page.url()).getAll("query")).toEqual(["1", "2"])
})

test("no-action form submission submitter parameters", async ({ page }) => {
  await page.click("#no-action form.button-param [type=submit]")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "query")).toEqual("1")
  expect(searchParams(page.url()).getAll("button")).toEqual([""])

  await page.click("#no-action form.button-param [type=submit]")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "query")).toEqual("1")
  expect(searchParams(page.url()).getAll("button")).toEqual([""])
})

test("submitter with blank formaction submits to the current page", async ({ page }) => {
  await page.click("#blank-formaction button")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  await expect(page.locator("#blank-formaction")).toBeVisible()
})

test("input named action with no action attribute", async ({ page }) => {
  await page.click("#action-input form.no-action [type=submit]")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(getSearchParam(page.url(), "action")).toEqual("1")
  expect(getSearchParam(page.url(), "query")).toEqual("1")
})

test("input named action with action attribute", async ({ page }) => {
  await page.click("#action-input form.action [type=submit]")
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
  expect(getSearchParam(page.url(), "action")).toEqual("1")
  expect(getSearchParam(page.url(), "query")).toEqual("1")
})

test("invalid form submission with unprocessable entity status", async ({ page }) => {
  await page.click("#reject form.unprocessable_entity input[type=submit]")

  await expect(page.locator("h1")).toHaveText("Unprocessable Entity")
  await expect(page.locator("#frame form.reject")).not.toBeVisible()
})

test("invalid form submission with long form", async ({ page }) => {
  await scrollToSelector(page, "#reject form.unprocessable_entity_with_tall_form input[type=submit]")
  await page.click("#reject form.unprocessable_entity_with_tall_form input[type=submit]")

  await expect(page.locator("h1")).toHaveText("Unprocessable Entity")
  expect(await isScrolledToTop(page)).toEqual(true)
  await expect(page.locator("#frame form.reject")).not.toBeVisible()
})

test("invalid form submission with server error status", async ({ page }) => {
  expect(await hasSelector(page, "head > #form-fixture-styles")).toEqual(true)
  await page.click("#reject form.internal_server_error input[type=submit]")

  await expect(page.locator("h1")).toHaveText("Internal Server Error")
  expect(await hasSelector(page, "head > #form-fixture-styles")).toEqual(false)
  await expect(page.locator("#frame form.reject")).not.toBeVisible()
})

test("form submission with network error", async ({ page }) => {
  await page.context().setOffline(true)
  await page.click("#reject-form [type=submit]")
  await nextEventOnTarget(page, "reject-form", "turbo:fetch-request-error")
})

test("submitter form submission reads button attributes", async ({ page }) => {
  const button = await page.locator("#submitter form button[type=submit][formmethod=post]")
  await button.click()
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/two.html")
  expect(await visitAction(page)).toEqual("advance")
})

test("submitter POST form submission with multipart/form-data formenctype", async ({ page }) => {
  await page.click("#submitter form[method=post]:not([enctype]) input[formenctype]")
  await nextBeat()

  const enctype = getSearchParam(page.url(), "enctype")
  expect(enctype).toContain("multipart/form-data")
})

test("submitter GET submission from submitter with data-turbo-frame", async ({ page }) => {
  await page.click("#submitter form[method=get] [type=submit][data-turbo-frame]")

  await expect(page.locator("h1")).toHaveText("Form")
  await expect(page.locator("#frame div.message")).toHaveText("Frame redirected")
})

test("submitter POST submission from submitter with data-turbo-frame", async ({ page }) => {
  await page.click("#submitter form[method=post] [type=submit][data-turbo-frame]")

  await expect(page.locator("h1")).toHaveText("Form")
  await expect(page.locator("#frame div.message")).toHaveText("Frame redirected")
})

test("form[data-turbo-frame=_top] submission", async ({ page }) => {
  const form = await page.locator("#standard form.redirect[data-turbo-frame=_top]")

  await form.locator("button").click()
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("h1")).toHaveText("One")
})

test("form[data-turbo-frame=_top] submission within frame", async ({ page }) => {
  const frame = await page.locator("turbo-frame#frame")
  const form = await frame.locator("form.redirect[data-turbo-frame=_top]")

  await form.locator("button").click()
  await nextEventNamed(page, "turbo:load")

  await expect(page.locator("h1")).toHaveText("Frames: Form")
})

test("frame form GET submission from submitter with data-turbo-frame=_top", async ({ page }) => {
  await page.click("#frame form[method=get] [type=submit][data-turbo-frame=_top]")

  await expect(page.locator("h1")).toHaveText("One")
})

test("frame form POST submission from submitter with data-turbo-frame=_top", async ({ page }) => {
  await page.click("#frame form[method=post] [type=submit][data-turbo-frame=_top]")

  await expect(page.locator("h1")).toHaveText("One")
})

test("frame POST form targeting frame submission", async ({ page }) => {
  await page.click("#targets-frame-post-form-submit")

  expect(await formSubmitStarted(page)).toEqual("true")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).toContain("text/vnd.turbo-stream.html")
  expect(fetchOptions.headers["Turbo-Frame"]).toEqual("frame")

  await nextEventNamed(page, "turbo:before-fetch-response")

  expect(await formSubmitEnded(page)).toEqual("true")

  await nextEventNamed(page, "turbo:frame-render")
  await nextEventNamed(page, "turbo:frame-load")

  const otherEvents = await readEventLogs(page)
  expect(otherEvents.length).toEqual(0)

  const src = await page.getAttribute("#frame", "src")
  expect(pathname(src)).toEqual("/src/tests/fixtures/frames/frame.html")
})

test("frame POST form targeting frame toggles submitter's [disabled] attribute", async ({ page }) => {
  await page.click("#targets-frame-post-form-submit")

  expect(
    await nextAttributeMutationNamed(page, "targets-frame-post-form-submit", "disabled")
  ).toEqual(
    ""
  )
  expect(
    await nextAttributeMutationNamed(page, "targets-frame-post-form-submit", "disabled")
  ).toEqual(
    null
  )
})

test("frame GET form targeting frame submission", async ({ page }) => {
  await page.click("#targets-frame-get-form-submit")

  expect(await formSubmitStarted(page)).toEqual("true")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).not.toContain("text/vnd.turbo-stream.html")
  expect(fetchOptions.headers["Turbo-Frame"]).toEqual("frame")

  await nextEventNamed(page, "turbo:before-fetch-response")

  expect(await formSubmitEnded(page)).toEqual("true")

  await nextEventNamed(page, "turbo:frame-render")
  await nextEventNamed(page, "turbo:frame-load")

  const otherEvents = await readEventLogs(page)
  expect(otherEvents.length).toEqual(0)

  const src = await page.getAttribute("#frame", "src")
  expect(pathname(src)).toEqual("/src/tests/fixtures/frames/frame.html")
})

test("frame GET form targeting frame toggles submitter's [disabled] attribute", async ({ page }) => {
  await page.click("#targets-frame-get-form-submit")

  expect(
    await nextAttributeMutationNamed(page, "targets-frame-get-form-submit", "disabled")
  ).toEqual(
    ""
  )
  expect(
    await nextAttributeMutationNamed(page, "targets-frame-get-form-submit", "disabled")
  ).toEqual(
    null
  )
})

test("frame form GET submission from submitter referencing another frame", async ({ page }) => {
  await page.click("#frame form[method=get] [type=submit][data-turbo-frame=hello]")

  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")
  await expect(page.locator("h1")).toHaveText("Form")
})

test("frame form POST submission from submitter referencing another frame", async ({ page }) => {
  await page.click("#frame form[method=post] [type=submit][data-turbo-frame=hello]")

  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")
  await expect(page.locator("h1")).toHaveText("Form")
})

test("frame form submission with redirect response", async ({ page }) => {
  const path = (await page.getAttribute("#frame form.redirect input[name=path]", "value")) || ""
  const url = new URL(path, "http://localhost:9000")
  url.searchParams.set("enctype", "application/x-www-form-urlencoded;charset=UTF-8")

  await page.click("#frame form.redirect input[type=submit]")
  await nextEventOnTarget(page, "frame", "turbo:frame-load")

  await expect(page.locator("#frame form.redirect")).not.toBeVisible()
  await expect(page.locator("#frame div.message")).toHaveText("Frame redirected")
  expect(pathname(page.url())).toContain("/src/tests/fixtures/form.html")
  expect(search(page.url())).not.toBe()
  await expect(page.locator("#frame")).toHaveAttribute("src", url.href)
})

test("frame POST form submission toggles the ancestor frame's [aria-busy] attribute", async ({ page }) => {
  await page.click("#frame form.redirect input[type=submit]")

  expect(await nextAttributeMutationNamed(page, "frame", "busy")).toEqual("")
  expect(await nextAttributeMutationNamed(page, "frame", "aria-busy")).toEqual("true")
  expect(await nextAttributeMutationNamed(page, "frame", "busy")).toEqual(null)
  expect(
    await nextAttributeMutationNamed(page, "frame", "aria-busy")
  ).toEqual(
    null
  )
})

test("frame POST form submission toggles the target frame's [aria-busy] attribute", async ({ page }) => {
  await page.click('#targets-frame form.frame [type="submit"]')

  expect(await nextAttributeMutationNamed(page, "frame", "busy")).toEqual("")
  expect(await nextAttributeMutationNamed(page, "frame", "aria-busy")).toEqual("true")

  await expect(page.locator("#frame h2")).toHaveText("Frame: Loaded")
  expect(await nextAttributeMutationNamed(page, "frame", "busy")).toEqual(null)
  expect(
    await nextAttributeMutationNamed(page, "frame", "aria-busy")
  ).toEqual(
    null
  )
})

test("frame form submission with empty created response", async ({ page }) => {
  const htmlBefore = await outerHTMLForSelector(page, "#frame")
  await page.click("#frame form.created input[type=submit]")

  const htmlAfter = await outerHTMLForSelector(page, "#frame")
  expect(htmlAfter).toEqual(htmlBefore)
})

test("frame form submission with empty no-content response", async ({ page }) => {
  const htmlBefore = await outerHTMLForSelector(page, "#frame")
  await page.click("#frame form.no-content input[type=submit]")

  const htmlAfter = await outerHTMLForSelector(page, "#frame")
  expect(htmlAfter).toEqual(htmlBefore)
})

test("frame form submission within a frame submits the Turbo-Frame header", async ({ page }) => {
  await page.click("#frame form.redirect input[type=submit]")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Turbo-Frame"]).toEqual("frame")
})

test("invalid frame form submission with unprocessable entity status", async ({ page }) => {
  await page.click("#frame form.unprocessable_entity input[type=submit]")

  expect(await formSubmitStarted(page)).toEqual("true")
  await nextEventNamed(page, "turbo:before-fetch-request")
  await nextEventNamed(page, "turbo:before-fetch-response")
  expect(await formSubmitEnded(page)).toEqual("true")
  await nextEventNamed(page, "turbo:frame-render")
  await nextEventNamed(page, "turbo:frame-load")

  const otherEvents = await readEventLogs(page)
  expect(otherEvents.length).toEqual(0)

  await expect(page.locator("#reject form:first-of-type")).toBeVisible()
  await expect(page.locator("#frame h2")).toHaveText("Frame: Unprocessable Entity")
})

test("invalid frame form submission with internal server error status", async ({ page }) => {
  await page.click("#frame form.internal_server_error input[type=submit]")

  expect(await formSubmitStarted(page)).toEqual("true")
  await nextEventNamed(page, "turbo:before-fetch-request")
  await nextEventNamed(page, "turbo:before-fetch-response")
  expect(await formSubmitEnded(page)).toEqual("true")
  await nextEventNamed(page, "turbo:frame-render")
  await nextEventNamed(page, "turbo:frame-load")

  const otherEvents = await readEventLogs(page)
  expect(otherEvents.length).toEqual(0)

  await expect(page.locator("#reject form:first-of-type")).toBeVisible()
  await expect(page.locator("#frame h2")).toHaveText("Frame: Internal Server Error")
})

test("frame form submission with stream response", async ({ page }) => {
  const button = await page.locator("#frame form.stream[method=post] input[type=submit]")
  await button.click()

  await expect(page.locator("#frame form.stream[method=post]")).toBeVisible()
  await expect(page.locator("#frame div.message")).toHaveText("Hello!")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(await page.getAttribute("#frame", "src")).not.toBe()
})

test("frame form submission with HTTP verb other than GET or POST", async ({ page }) => {
  await page.click("#frame form.put.stream input[type=submit]")

  await expect(page.locator("#frame form.put.stream")).toBeVisible()
  await expect(page.locator("#frame div.message")).toHaveText("1: Hello!")
  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
})

test("frame form submission with [data-turbo=false] on the form", async ({ page }) => {
  await page.click('#frame form[data-turbo="false"] input[type=submit]')

  await expect(page.locator("#element-id")).toBeVisible()
  expect(await formSubmitStarted(page)).not.toBe()
})

test("frame form submission with [data-turbo=false] on the submitter", async ({ page }) => {
  await page.click('#frame form:not([data-turbo]) input[data-turbo="false"]')

  await expect(page.locator("#element-id")).toBeVisible()
  expect(await formSubmitStarted(page)).not.toBe()
})

test("frame form submission ignores submissions with their defaultPrevented", async ({ page }) => {
  await page.evaluate(() => document.addEventListener("submit", (event) => event.preventDefault(), true))
  await page.click("#frame .redirect [type=submit]")

  await expect(page.locator("#frame h2")).toHaveText("Frame: Form")
  expect(await page.getAttribute("#frame", "src")).toEqual(null)
})

test("form submission with [data-turbo=false] on the form", async ({ page }) => {
  await page.click('#turbo-false form[data-turbo="false"] input[type=submit]')

  await expect(page.locator("#element-id")).toBeVisible()
  expect(await formSubmitStarted(page)).not.toBe()
})

test("form submission with [data-turbo=false] on the submitter", async ({ page }) => {
  await page.click('#turbo-false form:not([data-turbo]) input[data-turbo="false"]')

  await expect(page.locator("#element-id")).toBeVisible()
  expect(await formSubmitStarted(page)).not.toBe()
})

test("form submission skipped within method=dialog", async ({ page }) => {
  await page.click('#dialog-method [type="submit"]')

  expect(await formSubmitStarted(page)).not.toBe()
})

test("form submission skipped with submitter formmethod=dialog", async ({ page }) => {
  await page.click('#dialog-formmethod-turbo-frame [formmethod="dialog"]')

  expect(await formSubmitStarted(page)).not.toBe()
})

test("form submission targeting frame skipped within method=dialog", async ({ page }) => {
  await page.click("#dialog-method-turbo-frame button")

  expect(await formSubmitStarted(page)).not.toBe()
})

test("form submission targeting frame skipped with submitter formmethod=dialog", async ({ page }) => {
  await page.click('#dialog-formmethod [formmethod="dialog"]')

  expect(await formSubmitStarted(page)).not.toBe()
})

test("form submission targets disabled frame", async ({ page }) => {
  await page.evaluate(() => document.getElementById("frame")?.setAttribute("disabled", ""))
  await page.click('#targets-frame form.one [type="submit"]')
  await nextEventNamed(page, "turbo:load")

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/one.html")
})

test("form submission targeting a frame submits the Turbo-Frame header", async ({ page }) => {
  await page.click('#targets-frame [type="submit"]')

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Turbo-Frame"]).toEqual("frame")
})

test("link method form submission dispatches events from a connected <form> element", async ({ page }) => {
  await page.evaluate(() =>
    new MutationObserver(([record]) => {
      for (const form of record.addedNodes) {
        if (form instanceof HTMLFormElement) form.id = "a-form-link"
      }
    }).observe(document.body, { childList: true })
  )

  await page.click("#stream-link-method-within-form-outside-frame")
  await nextEventOnTarget(page, "a-form-link", "turbo:before-fetch-request")
  await nextEventOnTarget(page, "a-form-link", "turbo:submit-start")
  await nextEventOnTarget(page, "a-form-link", "turbo:before-fetch-response")
  await nextEventOnTarget(page, "a-form-link", "turbo:submit-end")

  await expect(page.locator("#a-form-link")).not.toBeVisible()
})

test("link method form submission submits a single request", async ({ page }) => {
  let requestCounter = 0
  page.on("request", () => requestCounter++)

  await page.click("#stream-link-method-within-form-outside-frame")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  await noNextEventNamed(page, "turbo:before-fetch-request")
  expect(fetchOptions.method).toEqual("post")
  expect(requestCounter).toEqual(1)
})

test("link method form submission inside frame submits a single request", async ({ page }) => {
  let requestCounter = 0
  page.on("request", () => requestCounter++)

  await page.click("#stream-link-method-inside-frame")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  await noNextEventNamed(page, "turbo:before-fetch-request")
  expect(fetchOptions.method).toEqual("post")
  expect(requestCounter).toEqual(1)
})

test("link method form submission targeting frame submits a single request", async ({ page }) => {
  let requestCounter = 0
  page.on("request", () => requestCounter++)

  await page.click("#turbo-method-post-to-targeted-frame")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  await noNextEventNamed(page, "turbo:before-fetch-request")
  expect(fetchOptions.method).toEqual("post")
  expect(requestCounter).toEqual(2)
})

test("link method form submission inside frame", async ({ page }) => {
  await page.click("#link-method-inside-frame")

  await expect(page.locator("#frame h2")).toHaveText("Frame: Loaded")
  await expect(page.locator("#nested-child")).not.toBeVisible()
})

test("link method form submission inside frame with data-turbo-frame=_top", async ({ page }) => {
  await page.click("#link-method-inside-frame-target-top")

  await expect(page.locator("h1")).toHaveText("Hello")
})

test("link method form submission inside frame with data-turbo-frame target", async ({ page }) => {
  await page.click("#link-method-inside-frame-with-target")

  await expect(page.locator("h1")).toHaveText("Form")
  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")
})

test("stream link method form submission inside frame", async ({ page }) => {
  await page.click("#stream-link-method-inside-frame")

  await expect(page.locator("#frame div.message")).toHaveText("Link!")
})

test("stream link GET method form submission inside frame", async ({ page }) => {
  await page.click("#stream-link-get-method-inside-frame")

  const { fetchOptions } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).toContain("text/vnd.turbo-stream.html")
})

test("stream link inside frame", async ({ page }) => {
  await page.click("#stream-link-inside-frame")

  const { fetchOptions, url } = await nextEventNamed(page, "turbo:before-fetch-request")

  expect(fetchOptions.headers["Accept"]).toContain("text/vnd.turbo-stream.html")
  expect(getSearchParam(url, "content")).toEqual("Link!")
})

test("link method form submission within form inside frame", async ({ page }) => {
  await page.click("#stream-link-method-within-form-inside-frame")

  await expect(page.locator("#frame div.message")).toHaveText("Link!")
})

test("link method form submission inside frame with confirmation confirmed", async ({ page }) => {
  page.on("dialog", (dialog) => {
    expect(dialog.message()).toEqual("Are you sure?")
    dialog.accept()
  })

  await page.click("#link-method-inside-frame-with-confirmation")

  await expect(page.locator("#frame div.message")).toHaveText("Link!")
})

test("link method form submission inside frame with confirmation cancelled", async ({ page }) => {
  page.on("dialog", (dialog) => {
    expect(dialog.message()).toEqual("Are you sure?")
    dialog.dismiss()
  })

  await page.click("#link-method-inside-frame-with-confirmation")

  await expect(page.locator("#frame div.message")).not.toBeVisible()
})

test("link method form submission outside frame", async ({ page }) => {
  await page.click("#link-method-outside-frame")

  await expect(page.locator("h1")).toHaveText("Hello")
})

test("following a link with [data-turbo-method] set and a target set navigates the target frame", async ({
  page
}) => {
  await page.click("#turbo-method-post-to-targeted-frame")

  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")
})

test("following a link with [data-turbo-method] and [data-turbo=true] set when html[data-turbo=false]", async ({
  page
}) => {
  const html = await page.locator("html")
  await html.evaluate((html) => html.setAttribute("data-turbo", "false"))

  const link = await page.locator("#turbo-method-post-to-targeted-frame")
  await link.evaluate((link) => link.setAttribute("data-turbo", "true"))

  await link.click()

  await expect(page.locator("h1")).toHaveText("Form")
  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")
})

test("following a link with [data-turbo-method] and [data-turbo=true] set when Turbo.session.drive = false", async ({
  page
}) => {
  await page.evaluate(() => window.Turbo.session.drive = false)

  const link = await page.locator("#turbo-method-post-to-targeted-frame")
  await link.evaluate((link) => link.setAttribute("data-turbo", "true"))

  await link.click()

  await expect(page.locator("h1")).toHaveText("Form")
  await expect(page.locator("#hello h2")).toHaveText("Hello from a frame")
})

test("following a link with [data-turbo-method] set when html[data-turbo=false]", async ({ page }) => {
  const html = await page.locator("html")
  await html.evaluate((html) => html.setAttribute("data-turbo", "false"))

  await page.click("#turbo-method-post-to-targeted-frame")

  await expect(page.locator("h1")).toHaveText("Hello")
})

test("following a link with [data-turbo-method] set when Turbo.session.drive = false", async ({ page }) => {
  await page.evaluate(() => (window.Turbo.session.drive = false))
  await page.click("#turbo-method-post-to-targeted-frame")

  await expect(page.locator("h1")).toHaveText("Hello")
})

test("stream link method form submission outside frame", async ({ page }) => {
  await page.click("#stream-link-method-outside-frame")

  await expect(page.locator("#frame div.message")).toHaveText("Link!")
})

test("link method form submission within form outside frame", async ({ page }) => {
  await page.click("#link-method-within-form-outside-frame")

  await expect(page.locator("h1")).toHaveText("Hello")
})

test("stream link method form submission within form outside frame", async ({ page }) => {
  await page.click("#stream-link-method-within-form-outside-frame")

  await expect(page.locator("#frame div.message")).toHaveText("Link!")
})

test("turbo:before-fetch-request fires on the form element", async ({ page }) => {
  await page.click('#targets-frame form.one [type="submit"]')
  await nextEventOnTarget(page, "form_one", "turbo:before-fetch-request")
})

test("turbo:before-fetch-response fires on the form element", async ({ page }) => {
  await page.click('#targets-frame form.one [type="submit"]')
  await nextEventOnTarget(page, "form_one", "turbo:before-fetch-response")
})

test("POST to external action ignored", async ({ page }) => {
  await page.click("#submit-external")

  await noNextEventNamed(page, "turbo:before-fetch-request")
  await expect(page).toHaveURL("https://httpbin.org/post")
})

test("POST to external action within frame ignored", async ({ page }) => {
  await page.click("#submit-external-within-ignored")

  await noNextEventNamed(page, "turbo:before-fetch-request")
  await expect(page).toHaveURL("https://httpbin.org/post")
})

test("POST to external action targeting frame ignored", async ({ page }) => {
  await page.click("#submit-external-target-ignored")

  await noNextEventNamed(page, "turbo:before-fetch-request")
  await expect(page).toHaveURL("https://httpbin.org/post")
})

test("form submission skipped with form[target]", async ({ page }) => {
  await page.click("#skipped form[target] button")
  await nextBeat()

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(await formSubmitEnded(page)).not.toBe()
})

test("form submission skipped with submitter button[formtarget]", async ({ page }) => {
  await page.click("#skipped [formtarget]")
  await nextBeat()

  expect(pathname(page.url())).toEqual("/src/tests/fixtures/form.html")
  expect(await formSubmitEnded(page)).not.toBe()
})

function formSubmitStarted(page) {
  return getFromLocalStorage(page, "formSubmitStarted")
}

function formSubmitEnded(page) {
  return getFromLocalStorage(page, "formSubmitEnded")
}
