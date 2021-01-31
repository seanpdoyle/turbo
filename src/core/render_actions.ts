export enum RenderAction {
  append = "append",
  prepend = "prepend",
  remove = "remove",
  replace = "replace",
  update = "update",
}

export function renderActionFromString(action: string | null): RenderAction {
  switch (action?.toLowerCase()) {
    case "append":  return RenderAction.append
    case "prepend": return RenderAction.prepend
    case "remove":  return RenderAction.remove
    case "replace": return RenderAction.replace
    default:        return RenderAction.update
  }
}

export const RenderActions: { [action: string]: (this: { targetElement: Element | null, templateContent: Node }) => void } = {
  append() {
    this.targetElement?.append(this.templateContent)
  },

  prepend() {
    this.targetElement?.prepend(this.templateContent)
  },

  remove() {
    this.targetElement?.remove()
  },

  replace() {
    this.targetElement?.replaceWith(this.templateContent)
  },

  update() {
    if (this.targetElement) {
      this.targetElement.innerHTML = ""
      this.targetElement.append(this.templateContent)
    }
  }
}
