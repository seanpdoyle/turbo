import { FunctionalTestCase } from "../helpers/functional_test_case"

export class FrameTests extends FunctionalTestCase {
  async setup() {
    await this.goToLocation("/src/tests/fixtures/frames.html")
  }

  async "test following a link to a page without a matching frame results in an empty frame"() {
    await this.clickSelector("#missing a")
    await this.nextBeat
    this.assert.notOk(await this.innerHTMLForSelector("#missing"))
  }

  async "test following a link within a frame with a target set navigates the target frame"() {
    await this.clickSelector("#hello a")
    await this.nextBeat

    const frameText = await this.querySelector("#frame h2")
    this.assert.equal(await frameText.getVisibleText(), "Frame: Loaded")
  }

  async "test following a link within a descendant frame whose ancestor declares a target set navigates the descendant frame"() {
    await this.clickSelector("#nested-root[target=frame] #nested-child a:not([data-turbo-frame])")
    await this.nextBeat

    const frame = await this.querySelector("#frame h2")
    const nestedRoot = await this.querySelector("#nested-root h2")
    const nestedChild = await this.querySelector("#nested-child")
    this.assert.equal(await frame.getVisibleText(), "Frames: #frame")
    this.assert.equal(await nestedRoot.getVisibleText(), "Frames: #nested-root")
    this.assert.equal(await nestedChild.getVisibleText(), "Frame: Loaded")
  }

  async "test following a link that declares data-turbo-frame within a frame whose ancestor respects the override"() {
    await this.clickSelector("#nested-root[target=frame] #nested-child a[data-turbo-frame]")
    await this.nextBeat

    const frameText = await this.querySelector("body > h1")
    this.assert.equal(await frameText.getVisibleText(), "One")
  }

  async "test following a link within a frame with target=_top navigates the page"() {
    await this.clickSelector("#navigate-top a")
    await this.nextBeat

    const frameText = await this.querySelector("body > h1")
    this.assert.equal(await frameText.getVisibleText(), "One")
  }

  async "test frame with action=append appends the contents"() {
    await this.remote.execute(() => document.getElementById("frame")?.setAttribute("action", "append"))
    await this.clickSelector("#frame-with-action a:first-of-type")
    await this.nextBeat

    this.assert.ok(await this.hasSelector("#frame"), "preserves existing frame")
    this.assert.equal(await this.getVisibleText("#frame h2:first-of-type"), "Frames: #frame")
    this.assert.equal(await this.getVisibleText("#frame h2:last-of-type"), "Frame: Loaded")
  }

  async "test frame with action=prepend appends the contents"() {
    await this.remote.execute(() => document.getElementById("frame")?.setAttribute("action", "prepend"))
    await this.clickSelector("#frame-with-action a:first-of-type")
    await this.nextBeat

    this.assert.ok(await this.hasSelector("#frame"), "preserves existing frame")
    this.assert.equal(await this.getVisibleText("#frame h2:first-of-type"), "Frame: Loaded")
    this.assert.equal(await this.getVisibleText("#frame h2:last-of-type"), "Frames: #frame")
  }

  async "test frame with action=remove removes the element"() {
    await this.remote.execute(() => document.getElementById("frame")?.setAttribute("action", "remove"))
    await this.clickSelector("#frame-with-action a:first-of-type")
    await this.nextBeat

    this.assert.notOk(await this.hasSelector("turbo-frame#frame"), "removes existing frame")
    this.assert.notOk(await this.hasSelector("#frame-with-action h2"))
  }

  async "test frame with action=replace sets outerHTML"() {
    await this.remote.execute(() => document.getElementById("frame")?.setAttribute("action", "replace"))
    await this.clickSelector("#frame-with-action a:first-of-type")
    await this.nextBeat

    this.assert.notOk(await this.hasSelector("turbo-frame#frame"), "removes existing frame")
    this.assert.equal(await this.getVisibleText("#frame-with-action h2:first-of-type"), "Frame: Loaded")
  }

  async "test frame without action defaults to action=update"() {
    await this.remote.execute(() => document.getElementById("frame")?.removeAttribute("action"))
    await this.clickSelector("#frame-with-action a:first-of-type")
    await this.nextBeat

    this.assert.ok(await this.hasSelector("turbo-frame#frame"), "preserves existing frame")
    this.assert.equal(await this.getVisibleText("#frame h2"), "Frame: Loaded")
  }

  async "test frame with action=update sets innerHTML"() {
    await this.remote.execute(() => document.getElementById("frame")?.setAttribute("action", "update"))
    await this.clickSelector("#frame-with-action a:first-of-type")
    await this.nextBeat

    this.assert.ok(await this.hasSelector("turbo-frame#frame"))
    this.assert.equal(await this.getVisibleText("#frame h2"), "Frame: Loaded")
  }

}

FrameTests.registerSuite()
