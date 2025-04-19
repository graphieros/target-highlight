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
    behavior: "smooth",
    block: "center",
    inline: "center",
  },
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
