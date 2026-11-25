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
pnpm add target-highlight
# or
npm install target-highlight
# or
yarn add target-highlight
```

## Usage

The package is ESM-only. Use `import` to load it.

```ts
import {
  targetHighlight,
  targetHide,
  defaultConfig,
  type HighlightOptions,
} from "target-highlight";

// Define options
const options: HighlightOptions = {
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
  blockedKeys: [], // Add keyboard keys that will be inactive when the application is running
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

Set `keepTooltipInView: true` to keep tooltips visible during page or container scrolling. By default, tooltips use their initial position and can scroll out of view with the page.

The spotlight tracks targets during page and container scrolling and when a target resizes. Targets clipped by a scroll container are highlighted only where they are visible.

Pass an `HTMLElement` or a callback returning one to put live DOM in a tooltip. The library moves the node into the tooltip, preserving its event listeners. For individual tooltips on several targets, return a fresh node from the callback for each tooltip.

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

## Focus and dismissal

Set `focus` to `'target'` to focus the highlighted target or its first focusable child, `'tooltip'` to focus the tooltip or its first focusable control, or `'trap'` to keep keyboard focus within the tooltip controls. With focus management enabled, hiding the highlight restores focus to the element that had it before the highlight.

Use `dismissOn: ['escape', 'backdrop', 'target']` to opt into any of those dismissal triggers. Tooltip clicks are outside this dismissal behavior. `onDismiss(reason)` runs after a configured trigger hides the highlight. Calls to `targetHide()` do not invoke it.

## Wait for a target

Use `waitForTarget` when a step opens a menu, changes tabs, or inserts an element asynchronously. The default timeout is 3,000 ms. Set `timeoutMs` to change it or pass `onTimeout` to handle a missing target. Hiding or replacing the highlight cancels the wait.

```js
targetHighlight('#menu-item', {
  tooltip: 'Choose this item',
  waitForTarget: { timeoutMs: 2000, onTimeout: () => showFallback() },
});
```

## Run a tour

`createTour(steps, options)` returns `start()`, `next()`, `previous()`, and `stop()`. Each step has a `target` and optional highlight settings that override the shared options. Tooltip buttons with the standard next, previous, and stop IDs drive the tour. Advancing past the last step stops it.

```js
import { createTour } from 'target-highlight';

const tour = createTour([
  { target: '#toolbar', options: { tooltip: 'This is the toolbar' } },
  { target: '#search', options: { tooltip: 'Search starts here' } },
], { dismissOn: ['escape'], scrollToTarget: { block: 'center' } });

tour.start();
// Call tour.next(), tour.previous(), or tour.stop() from your own controls.
```

Run `pnpm dev` to try these features in the playground.

## Defining steps

Replacing a visible highlight scrolls smoothly to center its first target on both axes by default. Set `scrollOnStepChange` to customize the transition or pass `null` to keep the current scroll position. The first highlight, including the one after `targetHide()`, uses `scrollToTarget`, which defaults to no scrolling.

```js
const scrollOptions = {
  scrollToTarget: { behavior: "instant", block: "center" },
  scrollOnStepChange: { behavior: "smooth", block: "center" },
};

targetHighlight("#first-step", scrollOptions);
// When advancing to the next step:
targetHighlight("#second-step", scrollOptions);
```

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

// Define blocked keys
const blockedKeys = [" ", "Tab"];

// Show the current step and bind its tooltip controls
// In this example, chevron icons are added as plain svg
// Buttons with id #target-highlight-button-previous and #target-highlight-button-next will be recognized by the library, and events attached to them.
function applySteps() {
  targetHighlight(`[data-step="${step.current}"]`, {
    ...options,
    blockedKeys,
    tooltip: () => {
      return `<div style="position:relative; padding: 0 24px">This is step ${step.current}</div><button id="target-highlight-button-previous" style="position: absolute; top: 50%; left: 0; transform: translateY(-50%)">${chevronLeftIcon}</button><button id="target-highlight-button-next" style="position: absolute; top: 50%; right: 0; transform: translateY(-50%)">${chevronRightIcon}</button>`;
    },
  });
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

## Blocked keys

Combine `hidePointerEvents: false` with blocked keys, to prevent events outside of the tour.
List of all the available blockable keys:

```ts
type KeyboardNavigationKey =
  | " "
  | "Tab"
  | "Enter"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "Escape";
```

Set blocked keys in the options object:

```js
blockedKeys: [
  " ",
  "Tab",
  "Enter",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Escape",
];
```

Blocked events will be restored when `targetHide` is called.

## Tooltip transitions

This library does not inject CSS. To enable tooltip transitions, add for example the following to your app’s global styles:

```css
.target-highlight-tooltip {
  opacity: 1;
  transition: opacity 0.3s;
  will-change: opacity;
}

.target-highlight-tooltip.fade-in {
  opacity: 0;
  animation: fadeIn 0.3s forwards;
}

.target-highlight-tooltip.fade-out {
  opacity: 1;
  animation: fadeOut 0.3s forwards;
  pointer-events: none;
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  to {
    opacity: 0;
  }
}
```
