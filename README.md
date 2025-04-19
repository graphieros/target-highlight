# target-highlight

A lightweight, zero‑dependency JavaScript library to spotlight DOM elements with a customizable overlay, border, padding, and optional tooltip. Single or multiple elements can be highlighted, using usual selectors.

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
};

// Target an element using any selector

targetHighlight("#myDiv");

// Or target many elements
targetHighlight(".myClass");

// Remove all highlights
targetHide();
```

## Customize the tooltip

Target the following css class to customize the tooltip:

```css
.target-highlight-tooltip {
}
```
