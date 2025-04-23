import './style.css'
import { targetHighlight, targetHide, defaultConfig, HighlightOptions } from "../dist/target-highlight.js"

const options: HighlightOptions = {
  overlayColor: 'rgba(0,0,0,0.7)',
  borderColor: "transparent",
  tooltip: "This is h1",
  singleTooltip: false,
  padding: '2px',
  borderRadius: 2,
  overlayZIndex: 2,
  hidePointerEvents: true,
  scrollToTarget: {
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  },
  forceTooltipPosition: 'right'
}

targetHighlight('#div2', options)

// setTimeout(() => {
//   targetHighlight('h2', {
//     ...options,
//     tooltip: 'This is h2'
//   })
// }, 1000)
// setTimeout(() => {
//   targetHighlight('#div1', {
//     ...options,
//   })
// }, 2000)
// setTimeout(() => {
//   targetHighlight('#div2', {
//     ...options,
//   })
// }, 3000)
// setTimeout(() => {
//   targetHighlight('#div3', {
//     ...options,
//     tooltip: 'This is DIV 3'
//   })
// }, 4000)
// setTimeout(() => {
//   targetHighlight('.span', {
//     ...options,
//     tooltip: 'These are spans'
//   })
// }, 5000)

// setTimeout(() => {
//   targetHighlight('#left', {
//     ...options,
//     tooltip: () => {
//       return `<div>TEST</div>`
//     }
//   })
// }, 6000)


// Resizing test:
setTimeout(() => {
  const d2: any = document.getElementById('div2')
  d2.style.height = '100%'
  d2.style.width = '500px'
}, 2000)

setTimeout(() => {
  const btn = document.getElementById('left');
  btn?.addEventListener('click', () => {
    targetHide()
  })
},1)

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <button id="left" style="position: fixed; top: 0; left: 0" data-target-highlight-tooltip="This is my tooltip" data-target-highlight-tooltip-position="bottom">STOP</button>
    <h1>target-highlight</h1>
    <h2>Playground</h2>
    <div id="div1" data-target-highlight-tooltip="This is DIV 1!" style="height: 500px">
      <span>DIV 1</span>
      <span class="span" data-target-highlight-ignore>SPAN</span>
    </div>
    <div id="div2" data-step style="height: 500px" data-target-highlight-tooltip="This is DIV 2!">
      <span>DIV 2</span>
      <span class="span">SPAN</span>
    </div>
    <div id="div3" style="height: 500px">
      <span>DIV 3</span>
      <span class="span">SPAN</span>
    </div>
    <button id="btn">CLICK</button>
    <button id="target-highlight-button-next">NEXT</button>
    <button id="target-highlight-button-previous">previous</button>
  </div>
`
