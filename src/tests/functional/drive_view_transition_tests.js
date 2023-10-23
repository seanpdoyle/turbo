import { expect, test } from "@playwright/test"
import { nextBeat } from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/transitions/left.html")

  await page.evaluate(`
    window.startViewTransitionCalled = false

    document.startViewTransition = (callback) => {
      window.startViewTransitionCalled = true
      callback()
    }
  `)
})

test("navigating triggers the view transition", async ({ page }) => {
  await page.click("#go-right")
  await nextBeat()

  const called = await page.evaluate(`window.startViewTransitionCalled`)
  expect(called).toEqual(true)
})

test("navigating does not trigger a view transition when meta tag not present", async ({ page }) => {
  await page.click("#go-other")
  await nextBeat()

  const called = await page.evaluate(`window.startViewTransitionCalled`)
  expect(called).toEqual(false)
})
