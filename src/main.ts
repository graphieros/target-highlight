import './style.css'
import { targetHighlight, targetHide, HighlightOptions, KeyboardNavigationKey } from "../dist/target-highlight.js"

const blockedKeys: KeyboardNavigationKey[] = [' ', 'Tab', 'ArrowDown', 'ArrowUp']

const options: HighlightOptions = {
  overlayColor: 'rgba(0,0,0,0.7)',
  borderColor: "transparent",
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
  forceTooltipPosition: 'right',
  nextCallback: () => next('forwards'),
  previousCallback: () => next('back'),
  stopCallback: targetHide,
  blockedKeys
}

let currentStep = -1;

const steps = [
  {
    selector: '#div1',
    tooltip: 'This is div1'
  },
  {
    selector: '#div2',
    tooltip: 'This is div2'
  },
  {
    selector: '#div3',
    tooltip: 'This is div3'
  },
  {
    selector: '#div4',
    tooltip: 'This is div4'
  }
]

function next(direction: 'forwards' | 'back') {
  if (direction === 'forwards') {
    currentStep += 1;
    if (currentStep > steps.length - 1) {
      currentStep = steps.length -1
      return
    }
  } else {
    currentStep -= 1;
    if (currentStep < 0) {
      currentStep = 0;
      return
    }
  }

  targetHighlight(steps[currentStep].selector, {
    ...options,
    tooltip: () => {
      return `
        <div>
          ${steps[currentStep].tooltip}
          <button id="target-highlight-button-previous">PREVIOUS</button>
          <button id="target-highlight-button-next">NEXT</button>
          <button id="target-highlight-button-stop">STOP</button>
        </div>
      `
    }
  })
}

next('forwards')

setTimeout(() => {
  const STOP = document.getElementById('STOP');
  STOP?.addEventListener('click', () => {
    targetHide()
  })
  const START = document.getElementById('START');
  START?.addEventListener('click', () => {
    currentStep = -1
    next('forwards')
  })
},1)

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <button id="STOP" style="position: fixed; top: 24px; left: 40px">STOP</button>
    <button id="START" style="position: fixed; top: 24px; left: 100px">START</button>
    <h1>target-highlight</h1>
    <h2>Playground</h2>
    <div id="div1" style="height: 500px">
      <span>DIV 1</span>
      <span class="span" data-target-highlight-ignore>SPAN</span>
    </div>
    <div id="div2" data-step style="height: 500px">
      <span>DIV 2</span>
      <span class="span">SPAN</span>
    </div>
    <div id="div3" style="height: 500px">
      <span>DIV 3</span>
      <span class="span">SPAN</span>
    </div>
    <div id="div4" style="height: 500px">
      <span>DIV 4</span>
      <span class="span">SPAN</span>
    </div>
    <button id="btn">CLICK</button>
  </div>
`
