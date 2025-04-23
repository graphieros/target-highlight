# target-highlight

[![npm](https://img.shields.io/npm/v/target-highlight)](https://github.com/graphieros/target-highlight)
[![GitHub issues](https://img.shields.io/github/issues/graphieros/target-highlight)](https://github.com/graphieros/target-highlight/issues)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/graphieros/target-highlight?tab=MIT-1-ov-file#readme)
[![npm](https://img.shields.io/npm/dt/target-highlight)](https://github.com/graphieros/target-highlight)

A lightweight, zero‑dependency JavaScript library to spotlight DOM elements with a customizable overlay, border, padding, and optional tooltip. Single or multiple elements can be highlighted, using usual selectors.

[DEMO](https://target-highlight.graphieros.com)

**target-highlight** can be used for example to setup a tutorial by highlighting elements.

## Features

- **Overlay** the page, carving out “holes” around target elements
- **Customizable** overlay color, border color, width, radius, padding
- **Tooltip** support (single or per‑element) with automatic positioning
- **Configurable** via options or global defaults

---

## Installation

```bash
npm install target-highlight
# or
yarn add target-highlight
```

## Usage

```ts
import {
  targetHighlight,
  targetHide,
  defaultConfig,
  HighlightOptions,
} from "target-highlight";

// Define options
const options = {
  overlayColor: "#00000080", // all color formats will work
  borderColor: "red", // all color formats will work
  singleTooltip: true,
  padding: "2px", // same as css
  borderRadius: 2,
  overlayZIndex: 2,
  hidePointerEvents: false,
  scrollToTarget: {
    // Use the same options as the native scrollIntoView api
    behavior: "smooth",
    block: "center",
    inline: "center",
  },
  nextCallback: () => {}, // use your callback when clicking on a button with an id of target-highlight-button-previous
  previousCallback: () => {}, // use your callback when clicking on a button with an id of target-highlight-button-previous
  stopCallback: () => {}, // use your callback when clicking on a button with an id of target-highlight-button-stop
  tooltip: "My content", // can also be a callback returning html content
  forceTooltipPosition: null, // 'top' | 'right' | 'bottom' | 'left' | null, default: null
  useResizeObserver: true, // If true, will trigger a re-render when the highlighted element resizes
};

// Target an element using any selector

targetHighlight("#myDiv", {
  ...options,
  tooltip: "This is my div",
});

// Or target many elements
targetHighlight(".myClass", options);

// Remove all highlights
targetHide();
```

## Customize the tooltip

Target the following css class to customize the tooltip:

```css
.target-highlight-tooltip {
}
```

The tooltip can also be passed a callback returning html content:

```js
targetHighlight("#myDiv", {
  ...config,
  tooltip: () => {
    return `
      <div>
        My custom tooltip
      </div>
    `;
  },
});
```

When highlighting multiple elements, you may need to show individual tooltips on each element.
Use the data-target-highlight-tooltip attribute on the highlighted elements to setup the individual tooltip contents. You can also use the data-target-highlight-tooltip-position to force the tooltip position ('top' | 'right' | 'bottom' | 'left'). In this case, you won't need the tooltip option normally passed to targetHighlight. Bear in mind using data attributes, the tooltip content can only be a string.

```html
<div
  class="mySelection"
  data-target-highlight-tooltip="This is div 1"
  data-target-highlight-tooltip-position="bottom"
>
  Some content
</div>
<div
  class="mySelection"
  data-target-highlight-tooltip="This is div 2"
  data-target-highlight-tooltip-position="left"
>
  Some other content
</div>
```

## Defining steps

You can create a scenario to move from step to step.
Add data-step="step" on the elements part of the scenario, where step is a number.

```js
// Define step variables
const step = {
  current: 0,
  max: 5,
};

// Define callbacks in options
const options = {
  nextCallback: () => moveStep("next"),
  previousCallback: () => moveStep("previous"),
  stopCallback: targetHide,
};

// Define a function to call the library and apply event listeners
// In this example, chevron icons are added as plain svg
// Buttons with id #target-highlight-button-previous and #target-highlight-button-next will be recognized by the library, and events attached to them.
function applySteps() {
  targetHighlight(`[data-step="${step.current}"]`, {
    ...options,
    tooltip: () => {
      return `<div style="position:relative; padding: 0 24px">This is step ${step.value}</div><button id="target-highlight-button-previous" style="position: absolute; top: 50%; left: 0; transform: translateY(-50%)">${chevronLeftIcon}</button><button id="target-highlight-button-next" style="position: absolute; top: 50%; right: 0; transform: translateY(-50%)">${chevronRightIcon}</button>`;
    },
  });

  setTimeout(() => {
    applyStepListeners(options);
  }, 10);
}

// Define a function to move through the steps
function moveStep(direction) {
  if (direction === "next") {
    step.current += 1;
    if (step.current > step.max) {
      step.current = 0;
    }
  } else {
    step.current -= 1;
    if (step.current < 0) {
      step.current = step.max;
    }
  }
  applySteps();
}
```

## Ignore elements

Use the data-target-highlight ignore data attribute on elements never to be highlighted:

```html
<!-- When targeting the .selection class, only one element will be highlighted -->
<div class="selection">I will be selected</div>
<div class="selection" data-target-highlight-ignore>I will not be selected</div>
```
