import { expect, test } from "@playwright/test"
import {
  nextBeat,
  nextEventNamed,
  readEventLogs
} from "../helpers/page"

test.beforeEach(async ({ page }) => {
  await page.goto("/src/tests/fixtures/stream.html")
  await readEventLogs(page)
})

test("receiving a stream message", async ({ page }) => {
  const messages = await page.locator("#messages .message")

  await expect(messages).toHaveText(["First"])

  await page.click("#append-target button")

  await expect(messages).toHaveText(["First", "Hello world!"])
})

test("dispatches a turbo:before-stream-render event", async ({ page }) => {
  await page.click("#append-target button")
  await nextEventNamed(page, "turbo:submit-end")
  const [[type, { newStream }, target]] = await readEventLogs(page, 1)

  expect(type).toEqual("turbo:before-stream-render")
  expect(target).toEqual("a-turbo-stream")
  expect(newStream).toContain(`action="append"`)
  expect(newStream).toContain(`target="messages"`)
})

test("receiving a stream message with css selector target", async ({ page }) => {
  const messages2 = await page.locator("#messages_2 .message")
  const messages3 = await page.locator("#messages_3 .message")

  await expect(messages2).toHaveText(["Second"])
  await expect(messages3).toHaveText(["Third"])

  await page.click("#append-targets button")

  await expect(messages2).toHaveText(["Second", "Hello CSS!"])
  await expect(messages3).toHaveText(["Third", "Hello CSS!"])
})

test("receiving a message without a template", async ({ page }) => {
  await page.evaluate(() =>
    window.Turbo.renderStreamMessage(`
      <turbo-stream action="remove" target="messages"></turbo-stream>
    `)
  )

  await expect(page.locator("#messages")).not.toBeVisible()
})

test("receiving a message with a <script> element", async ({ page }) => {
  await page.evaluate(() =>
    window.Turbo.renderStreamMessage(`
      <turbo-stream action="append" target="messages">
        <template>
          <script>
            const messages = document.querySelector("#messages .message")
            messages.textContent = "Hello from script"
          </script>
        </template>
      </turbo-stream>
    `)
  )

  await expect(page.locator("#messages")).toHaveText("Hello from script")
})

test("overriding with custom StreamActions", async ({ page }) => {
  const html = "Rendered with Custom Action"

  await page.evaluate((html) => {
    const CustomActions = {
      customUpdate(newStream) {
        for (const target of newStream.targetElements) target.innerHTML = html
      }
    }

    addEventListener("turbo:before-stream-render", ({ target, detail }) => {
      const stream = target

      const defaultRender = detail.render
      detail.render = CustomActions[stream.action] || defaultRender
    })

    window.Turbo.renderStreamMessage(`
      <turbo-stream action="customUpdate" target="messages">
        <template></template>
      </turbo-stream>
    `)
  }, html)

  await expect(page.locator("#messages")).toHaveText("Rendered with Custom Action")
})

test("receiving a stream message over SSE", async ({ page }) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<turbo-stream-source id="stream-source" src="/__turbo/messages"></turbo-stream-source>`
    )
  })
  await nextBeat()
  expect(await getReadyState(page, "stream-source")).toEqual(await page.evaluate(() => EventSource.OPEN))

  const messages = await page.locator("#messages .message")

  await expect(messages).toHaveText(["First"])

  await page.click("#async button")

  await expect(messages).toHaveText(["First", "Hello world!"])

  const readyState = await page.evaluate((id) => {
    const element = document.getElementById(id)

    if (element && element.streamSource) {
      element.remove()

      return element.streamSource.readyState
    } else {
      return -1
    }
  }, "stream-source")
  expect(readyState).toEqual(await page.evaluate(() => EventSource.CLOSED))

  await page.click("#async button")

  await expect(messages).toHaveText(["First", "Hello world!"])
})

test("receiving an update stream message preserves focus if the activeElement has an [id]", async ({ page }) => {
  await page.locator("input#container-element").focus()
  await page.evaluate(() => {
    window.Turbo.renderStreamMessage(`
      <turbo-stream action="update" target="container">
        <template><textarea id="container-element"></textarea></template>
      </turbo-stream>
    `)
  })

  await expect(page.locator("textarea#container-element")).toBeFocused()
})

test("receiving a replace stream message preserves focus if the activeElement has an [id]", async ({ page }) => {
  await page.locator("input#container-element").focus()
  await page.evaluate(() => {
    window.Turbo.renderStreamMessage(`
      <turbo-stream action="replace" target="container-element">
        <template><textarea id="container-element"></textarea></template>
      </turbo-stream>
    `)
  })

  await expect(page.locator("textarea#container-element")).toBeFocused()
})

test("receiving a remove stream message preserves focus blurs the activeElement", async ({ page }) => {
  await page.locator("#container-element").focus()
  await page.evaluate(() => {
    window.Turbo.renderStreamMessage(`
      <turbo-stream action="remove" target="container-element"></turbo-stream>
    `)
  })

  await expect(page.locator(":focus")).not.toBeVisible()
})

async function getReadyState(page, id) {
  return page.evaluate((id) => {
    const element = document.getElementById(id)

    if (element?.streamSource) {
      return element.streamSource.readyState
    } else {
      return -1
    }
  }, id)
}
