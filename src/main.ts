import './style.css';
import { createTour, targetHide, targetHighlight, type HighlightOptions } from './index';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header>
    <h1>target-highlight playground</h1>
    <p>Choose a scenario, then try its controls, resize the window, or scroll.</p>
  </header>
  <section class="controls" aria-label="Playground controls">
    <label>Scenario
      <select id="scenario">
        <option value="basic">Single target</option>
        <option value="group">Multiple targets and attribute tooltip</option>
        <option value="scroll">Nested scroll and changing size</option>
        <option value="mixed">Fixed and scrolling targets</option>
        <option value="focus">Focus trap and restoration</option>
        <option value="interactive">Interactive target and dismissal</option>
        <option value="wait">Wait for delayed target</option>
        <option value="timeout">Wait timeout</option>
        <option value="node">DOM tooltip with live controls</option>
        <option value="tour">Guided tour</option>
      </select>
    </label>
    <label><input id="keep" type="checkbox"> Keep tooltips in view</label>
    <label>Tooltip placement
      <select id="placement">
        <option value="">Automatic</option>
        <option>top</option><option>bottom</option><option>left</option><option>right</option>
      </select>
    </label>
    <label>Step scrolling
      <select id="step-scroll">
        <option value="smooth">Smooth</option><option value="instant">Instant</option><option value="none">Off</option>
      </select>
    </label>
    <button id="run">Run scenario</button>
    <button id="hide">Hide</button>
    <output id="status" aria-live="polite">Ready</output>
  </section>
  <main>
    <section class="card">
      <h2 id="intro">First step</h2>
      <p id="group-a" class="group">First grouped target</p>
      <p class="group" data-target-highlight-tooltip="This label comes from an attribute" data-target-highlight-tooltip-position="bottom">Attribute tooltip target</p>
      <p id="group-b" class="group">Second grouped target</p>
      <p class="group" data-target-highlight-ignore>Ignored grouped target</p>
      <button id="interactive" type="button">Highlight and click this button</button>
    </section>
    <section class="card">
      <h2>Nested scroll</h2>
      <button id="grow">Resize target</button>
      <div class="scroller" tabindex="0" aria-label="Scrollable demo">
        <p>Scroll inside this area to move its highlight.</p>
        <div id="nested-target">Resizable nested target</div>
        <div class="scroll-space"></div>
      </div>
    </section>
    <section class="card" id="async-area">
      <h2>Asynchronous target</h2>
      <p>The delayed scenario inserts a target here after one second.</p>
    </section>
    <section class="card final-card" id="last">
      <h2>Last step</h2>
      <p>Use the tour to compare smooth, instant, and disabled step scrolling.</p>
    </section>
  </main>
  <div id="fixed">Fixed target</div>
`;

const status = document.querySelector<HTMLOutputElement>('#status')!;
const scenario = document.querySelector<HTMLSelectElement>('#scenario')!;
const placement = document.querySelector<HTMLSelectElement>('#placement')!;
const keep = document.querySelector<HTMLInputElement>('#keep')!;
const stepScroll = document.querySelector<HTMLSelectElement>('#step-scroll')!;
const nested = document.querySelector<HTMLElement>('#nested-target')!;
let delayedTarget: ReturnType<typeof setTimeout> | undefined;
let tour: ReturnType<typeof createTour> | undefined;

function reset(): void {
  if (delayedTarget !== undefined) clearTimeout(delayedTarget);
  delayedTarget = undefined;
  if (tour) tour.stop();
  targetHide();
  tour = undefined;
  document.querySelector('#delayed-target')?.remove();
}

function dismiss(reason: string): void {
  status.value = `Dismissed by ${reason}`;
}

function controls(label: string): string {
  return `<p>${label}</p>
    <button id="target-highlight-button-previous">Previous</button>
    <button id="target-highlight-button-next">Next</button>
    <button id="target-highlight-button-stop">Stop</button>`;
}

function nodeTooltip(): HTMLElement {
  const content = document.createElement('div');
  const button = document.createElement('button');
  let count = 0;
  button.textContent = 'Count: 0';
  button.addEventListener('click', () => { button.textContent = `Count: ${++count}`; });
  content.append(button);
  return content;
}

function run(): void {
  reset();
  const options: HighlightOptions = {
    borderRadius: 6,
    padding: '4px',
    keepTooltipInView: keep.checked,
    forceTooltipPosition: placement.value ? placement.value as HighlightOptions['forceTooltipPosition'] : null,
    dismissOn: ['escape'],
    onDismiss: dismiss,
  };
  const show = (target: string, extra: HighlightOptions) => targetHighlight(target, { ...options, ...extra });
  status.value = scenario.selectedOptions[0].text;

  switch (scenario.value) {
    case 'group':
      show('.group', { tooltip: 'Shared tooltip for the two plain targets' });
      break;
    case 'scroll':
      show('#nested-target', { tooltip: 'Scroll the container or resize this target.' });
      break;
    case 'mixed':
      show('#fixed, #intro', { singleTooltip: false, tooltip: 'Scroll the page to compare these targets.' });
      break;
    case 'focus':
      show('#intro', {
        focus: 'trap',
        tooltip: () => '<p>Use Tab and Shift+Tab, then press Escape.</p><button>First</button><button>Second</button>',
      });
      break;
    case 'interactive':
      show('#interactive', { focus: 'target', dismissOn: ['escape', 'backdrop', 'target'], tooltip: 'Click here, the backdrop, or press Escape.' });
      break;
    case 'wait':
      show('#delayed-target', { tooltip: 'The target is ready.', waitForTarget: { onTimeout: () => { status.value = 'Timed out'; } } });
      delayedTarget = setTimeout(() => {
        const target = document.createElement('p');
        target.id = 'delayed-target';
        target.textContent = 'Target inserted after one second';
        document.querySelector('#async-area')!.append(target);
        status.value = 'Target inserted';
      }, 1000);
      break;
    case 'timeout':
      status.value = 'Waiting for a target that never appears';
      show('#missing', { waitForTarget: { timeoutMs: 1000, onTimeout: () => { status.value = 'Timed out'; } } });
      break;
    case 'node':
      show('#intro', { tooltip: nodeTooltip() });
      break;
    case 'tour': {
      const behavior = stepScroll.value === 'instant' ? 'instant' : 'smooth';
      tour = createTour([
        { target: '#intro', options: { tooltip: () => controls('Step 1 of 3') } },
        { target: '#nested-target', options: { tooltip: () => controls('Step 2 of 3') } },
        { target: '#last', options: { tooltip: () => controls('Step 3 of 3') } },
      ], {
        ...options,
        keepTooltipInView: true,
        focus: 'tooltip',
        scrollToTarget: { behavior: 'instant', block: 'center' },
        scrollOnStepChange: stepScroll.value === 'none' ? null : { behavior, block: 'center' },
      });
      tour.start();
      break;
    }
    default:
      show('#intro', { tooltip: 'A single highlight with a text tooltip.' });
  }
}

document.querySelector('#run')!.addEventListener('click', run);
document.querySelector('#hide')!.addEventListener('click', () => { reset(); status.value = 'Hidden'; });
document.querySelector('#grow')!.addEventListener('click', () => nested.classList.toggle('grown'));
