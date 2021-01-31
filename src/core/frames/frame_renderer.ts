import { FrameElement } from "../../elements/frame_element"
import { RenderActions, RenderAction } from "../render_actions"
import { nextAnimationFrame } from "../../util"
import { Renderer } from "../renderer"
import { Snapshot } from "../snapshot"

export class FrameRenderer extends Renderer<FrameElement> {
  readonly renderAction: RenderAction
  constructor(currentSnapshot: Snapshot<FrameElement>, newSnapshot: Snapshot<FrameElement>, isPreview: boolean, renderAction: RenderAction) {
    super(currentSnapshot, newSnapshot, isPreview)
    this.renderAction = renderAction
  }

  get shouldRender() {
    return true
  }

  async render() {
    await nextAnimationFrame()
    this.preservingPermanentElements(() => {
      this.loadFrameElement()
    })
    this.scrollFrameIntoView()
    await nextAnimationFrame()
    this.focusFirstAutofocusableElement()
  }

  loadFrameElement() {
    const sourceRange = this.newElement.ownerDocument?.createRange()
    sourceRange.selectNodeContents(this.newElement)

    RenderActions[this.renderAction].apply({
      targetElement: this.currentElement,
      templateContent: sourceRange.extractContents()
    })
  }

  scrollFrameIntoView() {
    if (this.currentElement.autoscroll || this.newElement.autoscroll) {
      const element = this.currentElement.firstElementChild
      const block = readScrollLogicalPosition(this.currentElement.getAttribute("data-autoscroll-block"), "end")

      if (element) {
        element.scrollIntoView({ block })
        return true
      }
    }
    return false
  }
}

function readScrollLogicalPosition(value: string | null, defaultValue: ScrollLogicalPosition): ScrollLogicalPosition {
  if (value == "end" || value == "start" || value == "center" || value == "nearest") {
    return value
  } else {
    return defaultValue
  }
}
