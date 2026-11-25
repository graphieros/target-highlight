type Selector = string | Element;
type Placement = 'top' | 'bottom' | 'right' | 'left';
type TooltipContent = string | HTMLElement;
export type DismissReason = 'escape' | 'backdrop' | 'target';

export type KeyboardNavigationKey = 'Tab' | 'Enter' | ' ' | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' | 'PageUp' | 'PageDown' | 'Escape';

export interface HighlightOptions {
    overlayColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    overlayZIndex?: number;
    tooltip?: TooltipContent | (() => TooltipContent);
    singleTooltip?: boolean;
    keepTooltipInView?: boolean;
    padding?: string;
    hidePointerEvents?: boolean;
    nextCallback?: () => void;
    previousCallback?: () => void;
    stopCallback?: () => void;
    scrollToTarget?: null | {
        behavior?: 'smooth' | 'instant' | 'auto',
        block?: 'start' | 'center' | 'end' | 'nearest',
        inline?: 'start' | 'center' | 'end' | 'nearest'
    };
    scrollOnStepChange?: HighlightOptions['scrollToTarget'];
    forceTooltipPosition?: Placement | null;
    blockedKeys?: KeyboardNavigationKey[];
    focus?: 'target' | 'tooltip' | 'trap' | null;
    dismissOn?: DismissReason[];
    onDismiss?: (reason: DismissReason) => void;
    waitForTarget?: { timeoutMs?: number; onTimeout?: () => void } | null;
}

type ResolvedOptions = Required<HighlightOptions>;

const defaultOptions: ResolvedOptions = {
    borderColor: '#00AAFF',
    borderRadius: 0,
    borderWidth: 2,
    overlayColor: '#00000050',
    overlayZIndex: 2147483647,
    padding: '0',
    singleTooltip: true,
    keepTooltipInView: false,
    tooltip: '',
    hidePointerEvents: true,
    nextCallback: () => { },
    previousCallback: () => { },
    stopCallback: () => { },
    scrollToTarget: null,
    scrollOnStepChange: { behavior: 'smooth', block: 'center', inline: 'center' },
    forceTooltipPosition: null,
    blockedKeys: [],
    focus: null,
    dismissOn: [],
    onDismiss: () => {},
    waitForTarget: null,
};

type Rect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
type Tooltip = { node: HTMLElement; reposition: () => void };

type Highlight = {
    selector: Selector;
    options: ResolvedOptions;
    cancelPending?: () => void;
    cleanup?: () => void;
    updateGeometry?: (viewportResized?: boolean) => void;
    returnFocus?: Element | null;
    nodes: Element[];
    tooltips: Tooltip[];
};

let activeHighlight: Highlight | undefined;
let blockedKeys = new Set<string>();
let maskSequence = 0;

function preventBlockedKey(event: KeyboardEvent): void {
    if (blockedKeys.has(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

export function blockKeyboardEvents(keys: KeyboardNavigationKey[]): void {
    blockedKeys = new Set(keys);
    document.addEventListener('keydown', preventBlockedKey, true);
    document.addEventListener('keypress', preventBlockedKey, true);
}

export function restoreKeyboardEvents(): void {
    document.removeEventListener('keydown', preventBlockedKey, true);
    document.removeEventListener('keypress', preventBlockedKey, true);
    blockedKeys.clear();
}

function isElementOrAncestorFixed(el: Element): boolean {
    let e: Element | null = el;
    while (e && e !== document.documentElement) {
        if (getComputedStyle(e).position === 'fixed') return true;
        e = e.parentElement;
    }
    return false;
}

// Parse any CSS padding shorthand into numeric px values
function parsePadding(padding: string) {
    const el = document.createElement('div');
    el.style.padding = padding;
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const res = {
        top: parseFloat(cs.paddingTop),
        right: parseFloat(cs.paddingRight),
        bottom: parseFloat(cs.paddingBottom),
        left: parseFloat(cs.paddingLeft)
    };
    el.remove();
    return res;
}

function createSpotlight(count: number, opts: ResolvedOptions, fixed: boolean) {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.classList.add('target-highlight-overlay');
    Object.assign(svg.style, {
        position: fixed ? 'fixed' : 'absolute',
        top: '0',
        left: '0',
        pointerEvents: opts.hidePointerEvents ? 'none' : 'all',
        zIndex: String(opts.overlayZIndex - 1),
    });

    const defs = document.createElementNS(namespace, 'defs');
    const mask = document.createElementNS(namespace, 'mask');
    mask.id = `target-highlight-mask-${++maskSequence}`;
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('maskContentUnits', 'userSpaceOnUse');

    const background = document.createElementNS(namespace, 'rect');
    background.setAttribute('fill', 'white');
    mask.append(background);

    const shade = document.createElementNS(namespace, 'rect');
    shade.setAttribute('fill', opts.overlayColor);
    shade.setAttribute('mask', `url(#${mask.id})`);
    defs.append(mask);
    svg.append(defs, shade);

    const outlines = Array.from({ length: count }, () => {
        const hole = document.createElementNS(namespace, 'rect');
        hole.setAttribute('fill', 'black');
        hole.setAttribute('rx', String(opts.borderRadius));
        hole.setAttribute('ry', String(opts.borderRadius));
        mask.append(hole);

        const border = document.createElement('div');
        border.classList.add('target-highlight-border');
        border.hidden = true;
        Object.assign(border.style, {
            position: fixed ? 'fixed' : 'absolute',
            border: `${opts.borderWidth}px solid ${opts.borderColor}`,
            borderRadius: `${opts.borderRadius}px`,
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: String(opts.overlayZIndex),
        });
        return { hole, border, rect: null as Pick<Rect, 'left' | 'top' | 'width' | 'height'> | null };
    });

    const nodes = [svg, ...outlines.map(({ border }) => border)];
    let width = 0;
    let height = 0;

    function update(rects: (Rect | null)[]): void {
        const pageWidth = fixed ? window.innerWidth : Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
        const pageHeight = fixed ? window.innerHeight : Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        if (width !== pageWidth || height !== pageHeight) {
            width = pageWidth;
            height = pageHeight;
            svg.style.width = `${width}px`;
            svg.style.height = `${height}px`;
            for (const rect of [background, shade]) {
                rect.setAttribute('width', String(width));
                rect.setAttribute('height', String(height));
            }
        }

        const offsetX = fixed ? 0 : window.scrollX;
        const offsetY = fixed ? 0 : window.scrollY;
        outlines.forEach((outline, index) => {
            const { hole, border, rect: previous } = outline;
            const rect = rects[index];
            if (!rect) {
                if (previous) {
                    border.hidden = true;
                    hole.setAttribute('width', '0');
                    outline.rect = null;
                }
                return;
            }

            const left = rect.left + offsetX;
            const top = rect.top + offsetY;
            if (previous?.left === left && previous.top === top &&
                previous.width === rect.width && previous.height === rect.height) return;

            outline.rect = { left, top, width: rect.width, height: rect.height };
            hole.setAttribute('x', String(left));
            hole.setAttribute('y', String(top));
            hole.setAttribute('width', String(rect.width));
            hole.setAttribute('height', String(rect.height));
            Object.assign(border.style, {
                left: `${left - opts.borderWidth}px`,
                top: `${top - opts.borderWidth}px`,
                width: `${rect.width + opts.borderWidth * 2}px`,
                height: `${rect.height + opts.borderWidth * 2}px`,
            });
            border.hidden = false;
        });
    }

    return { nodes, update };
}

const stepControls = [
    ['#target-highlight-button-next', 'nextCallback'],
    ['#target-highlight-button-previous', 'previousCallback'],
    ['#target-highlight-button-stop', 'stopCallback'],
] as const;

const stepListeners = new WeakMap<HTMLElement, EventListener>();

function bindStepControls(root: ParentNode, options: HighlightOptions): void {
    for (const [selector, callbackName] of stepControls) {
        const callback = options[callbackName];
        for (const button of root.querySelectorAll<HTMLElement>(selector)) {
            const previous = stepListeners.get(button);
            if (previous) button.removeEventListener('click', previous);
            stepListeners.delete(button);
            if (typeof callback !== 'function') continue;

            const listener: EventListener = event => {
                stepListeners.delete(button);
                event.stopPropagation();
                event.preventDefault();
                setTimeout(() => callback(), 0);
            };
            stepListeners.set(button, listener);
            button.addEventListener('click', listener, { once: true });
        }
    }
}

export function applyStepListeners(options: HighlightOptions = {}): void {
    bindStepControls(document, options);
}

function positionTooltip(
    rect: Rect,
    width: number,
    height: number,
    forced: Placement | null,
    keepInView: boolean
): { side: Placement; left: number; top: number } {
    const margin = 8;
    const maxLeft = window.innerWidth - margin - width;
    const maxTop = window.innerHeight - margin - height;
    const clamp = (value: number, max: number) => Math.min(Math.max(value, margin), Math.max(margin, max));
    const centerX = rect.left + (rect.width - width) / 2;
    const centerY = rect.top + (rect.height - height) / 2;
    const candidates = [
        { side: 'top', left: centerX, top: rect.top - height - margin },
        { side: 'bottom', left: centerX, top: rect.bottom + margin },
        { side: 'right', left: rect.right + margin, top: centerY },
        { side: 'left', left: rect.left - width - margin, top: centerY },
    ] as const;

    if (forced) {
        const candidate = candidates.find(({ side }) => side === forced) ?? candidates[2];
        return {
            side: forced,
            left: clamp(candidate.left, maxLeft),
            top: keepInView ? clamp(candidate.top, maxTop) : candidate.top,
        };
    }

    const clamped = candidates.map(candidate => ({
        ...candidate,
        left: clamp(candidate.left, maxLeft),
        top: clamp(candidate.top, maxTop),
    }));
    const fits = ({ left, top }: { left: number; top: number }) =>
        left >= margin && left <= maxLeft && top >= margin && top <= maxTop;
    const avoidsTarget = ({ left, top }: { left: number; top: number }) =>
        left + width <= rect.left || left >= rect.right ||
        top + height <= rect.top || top >= rect.bottom;

    const choice = candidates.find(fits) ?? clamped.find(avoidsTarget) ?? clamped[0];
    const { left, top } = choice;
    let side: Placement = choice.side;
    if (top + height <= rect.top) side = 'top';
    else if (top >= rect.bottom) side = 'bottom';
    else if (left + width <= rect.left) side = 'left';
    else if (left >= rect.right) side = 'right';

    return { side, left, top };
}

function createTooltip(measure: () => Rect, opts: ResolvedOptions, overlayFixed: boolean): Tooltip {
    const tip = document.createElement('div');
    const fixed = overlayFixed || opts.keepTooltipInView;
    tip.className = 'target-highlight-tooltip';
    const content = typeof opts.tooltip === 'function' ? opts.tooltip() : opts.tooltip;
    if (typeof content !== 'string') {
        tip.append(content.closest('.target-highlight-tooltip.fade-in') ? content.cloneNode(true) : content);
    } else if (typeof opts.tooltip === 'function') {
        tip.innerHTML = content;
    } else {
        tip.textContent = content;
    }
    Object.assign(tip.style, {
        position: fixed ? 'fixed' : 'absolute',
        visibility: 'hidden',
        zIndex: String(opts.overlayZIndex),
    });
    document.body.appendChild(tip);
    tip.classList.add('fade-in');
    bindStepControls(tip, opts);

    function reposition(): void {
        const { side, left, top } = positionTooltip(
            measure(), tip.offsetWidth, tip.offsetHeight, opts.forceTooltipPosition, opts.keepTooltipInView,
        );
        tip.setAttribute('data-placement', side);
        tip.style.left = `${left + (fixed ? 0 : window.scrollX)}px`;
        tip.style.top = `${top + (fixed ? 0 : window.scrollY)}px`;
    }

    reposition();
    tip.style.visibility = 'visible';
    return { node: tip, reposition };
}

function toRect(left: number, top: number, right: number, bottom: number): Rect {
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function unionRects(rects: Rect[]): Rect {
    return rects.reduce((bounds, rect) => toRect(
        Math.min(bounds.left, rect.left),
        Math.min(bounds.top, rect.top),
        Math.max(bounds.right, rect.right),
        Math.max(bounds.bottom, rect.bottom),
    ));
}

function visibleRect(element: Element, rect: Rect): Rect | null {
    let { left, top, right, bottom } = rect;
    for (let node = element; node.parentElement && node.parentElement !== document.body; node = node.parentElement) {
        if (getComputedStyle(node).position === 'fixed') break;
        const parent = node.parentElement;
        const style = getComputedStyle(parent);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const bounds = parent.getBoundingClientRect();
        if (style.overflowX !== 'visible') {
            left = Math.max(left, bounds.left + parent.clientLeft);
            right = Math.min(right, bounds.left + parent.clientLeft + parent.clientWidth);
        }
        if (style.overflowY !== 'visible') {
            top = Math.max(top, bounds.top + parent.clientTop);
            bottom = Math.min(bottom, bounds.top + parent.clientTop + parent.clientHeight);
        }
    }
    return right > left && bottom > top ? toRect(left, top, right, bottom) : null;
}

function renderHighlight(highlight: Highlight, elements: Element[]): void {
    const { options, nodes, tooltips } = highlight;
    const fixedTargets = elements.map(isElementOrAncestorFixed);
    const tooltipsFixed = fixedTargets.every(Boolean);
    // A fixed target must share the viewport coordinate system with its cutout.
    const spotlight = createSpotlight(elements.length, options, fixedTargets.some(Boolean));
    const getPadding = () => options.padding && options.padding !== '0' ? parsePadding(options.padding) : null;
    let padding = getPadding();
    const measure = (element: Element): Rect => {
        const rect = element.getBoundingClientRect();
        return padding ? toRect(
            rect.left - padding.left,
            rect.top - padding.top,
            rect.right + padding.right,
            rect.bottom + padding.bottom,
        ) : rect;
    };

    highlight.updateGeometry = (viewportResized = false) => {
        if (viewportResized) padding = getPadding();
        spotlight.update(elements.map(element => element.isConnected ? visibleRect(element, measure(element)) : null));
    };
    highlight.updateGeometry();
    nodes.push(...spotlight.nodes);
    document.body.append(...spotlight.nodes);
    document.body.setAttribute('data-target-highlight', '');

    const shared: { element: Element; tooltipOptions: ResolvedOptions }[] = [];
    for (const element of elements) {
        const text = element.getAttribute('data-target-highlight-tooltip');
        const placement = element.getAttribute('data-target-highlight-tooltip-position') as Placement | null;
        const tooltipOptions = {
            ...options,
            forceTooltipPosition: placement ?? options.forceTooltipPosition,
        };
        if (text === null) {
            shared.push({ element, tooltipOptions });
        } else {
            tooltips.push(createTooltip(() => measure(element), { ...tooltipOptions, tooltip: text }, tooltipsFixed));
        }
    }

    if (!options.tooltip) return;
    if (options.singleTooltip && shared.length > 1) {
        tooltips.push(createTooltip(() => unionRects(shared.map(({ element }) => measure(element))), options, tooltipsFixed));
    } else {
        for (const { element, tooltipOptions } of shared) {
            tooltips.push(createTooltip(() => measure(element), tooltipOptions, tooltipsFixed));
        }
    }
}

function drawHighlight(highlight: Highlight, elements: Element[]): boolean {
    try {
        renderHighlight(highlight, elements);
    } catch (error) {
        clearHighlight(highlight, false);
        throw error;
    }

    // A tooltip callback can hide or replace the highlight during rendering.
    if (activeHighlight !== highlight) {
        clearHighlight(highlight, false);
        return false;
    }
    return true;
}

function clearHighlight(highlight: Highlight, animate: boolean): void {
    for (const node of highlight.nodes) node.remove();
    highlight.nodes.length = 0;

    for (const { node: tip } of highlight.tooltips) {
        bindStepControls(tip, {});
        if (!animate) {
            tip.remove();
            continue;
        }

        tip.classList.remove('fade-in');
        tip.classList.add('fade-out');
        const computed = getComputedStyle(tip);
        const remove = () => tip.remove();
        if (computed.animationName !== 'none' && computed.animationDuration !== '0s') {
            tip.addEventListener('animationend', remove, { once: true });
            tip.addEventListener('animationcancel', remove, { once: true });
        } else {
            requestAnimationFrame(remove);
        }
    }
    highlight.tooltips.length = 0;
    document.body?.removeAttribute('data-target-highlight');
}

const focusableSelector = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

function focusableWithin(roots: HTMLElement[]): HTMLElement[] {
    return roots.flatMap(root => [root, ...root.querySelectorAll<HTMLElement>(focusableSelector)])
        .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') &&
            node.getClientRects().length > 0 && getComputedStyle(node).visibility === 'visible');
}

function bindHighlight(highlight: Highlight, elements: Element[]): () => void {
    const { options, tooltips } = highlight;
    const dismissOn = options.dismissOn ?? [];
    const tips = tooltips.map(({ node }) => node);
    const target = elements.find((node): node is HTMLElement => node instanceof HTMLElement);
    const focusRoot = options.focus === 'target' ? target : tips[0] ?? target;
    const trapRoots = tips.length ? tips : target ? [target] : [];
    let temporaryTabIndex = false;
    let frame: number | undefined;

    function moveFocus(): void {
        if (!focusRoot) return;
        const first = focusableWithin([focusRoot])[0];
        if (!first && !focusRoot.hasAttribute('tabindex')) {
            focusRoot.tabIndex = -1;
            temporaryTabIndex = true;
        }
        (first ?? focusRoot).focus({ preventScroll: true });
    }

    function dismiss(reason: DismissReason): void {
        targetHide();
        options.onDismiss?.(reason);
    }

    function onKey(event: KeyboardEvent): void {
        if (event.key === 'Escape' && dismissOn.includes('escape')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            dismiss('escape');
        } else if (event.key === 'Tab' && options.focus === 'trap') {
            const focusable = focusableWithin(trapRoots);
            const index = focusable.findIndex(node => node === document.activeElement);
            const next = event.shiftKey ? index <= 0 ? focusable.length - 1 : index - 1 : (index + 1) % focusable.length;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (focusable.length) focusable[next].focus({ preventScroll: true });
            else moveFocus();
        }
    }

    function onFocus(event: FocusEvent): void {
        if (event.target instanceof Node && !trapRoots.some(root => root.contains(event.target as Node))) moveFocus();
    }

    function onClick(event: MouseEvent): void {
        const path = event.composedPath();
        if (tips.some(tip => path.includes(tip))) return;
        const x = event.clientX;
        const y = event.clientY;
        const hitsTarget = elements.some(el => {
            if (path.includes(el)) return true;
            if (!event.detail || !path.includes(highlight.nodes[0])) return false;
            const rect = visibleRect(el, el.getBoundingClientRect());
            return rect && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
        });
        const reason = hitsTarget ? 'target' : 'backdrop';
        if (dismissOn.includes(reason)) dismiss(reason);
    }

    function refresh(): void {
        if (frame !== undefined) return;
        frame = requestAnimationFrame(() => {
            frame = undefined;
            highlight.updateGeometry?.();
            if (options.keepTooltipInView) tooltips.forEach(({ reposition }) => reposition());
        });
    }

    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refresh);
    elements.forEach(element => observer?.observe(element, { box: 'border-box' }));
    window.addEventListener('scroll', refresh, { capture: true, passive: true });
    if (dismissOn.includes('escape') || options.focus === 'trap') document.addEventListener('keydown', onKey, true);
    if (dismissOn.includes('target') || dismissOn.includes('backdrop')) document.addEventListener('click', onClick, true);
    if (options.focus === 'trap') document.addEventListener('focusin', onFocus);

    // Defer focus until cleanup is registered, since focus can invoke consumer listeners.
    if (options.focus) queueMicrotask(() => {
        if (activeHighlight === highlight) moveFocus();
    });

    return () => {
        observer?.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
        window.removeEventListener('scroll', refresh, true);
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('focusin', onFocus);
        if (temporaryTabIndex) focusRoot?.removeAttribute('tabindex');
    };
}

function hideHighlight(restoreFocus: boolean): void {
    const highlight = activeHighlight;
    activeHighlight = undefined;
    highlight?.cancelPending?.();
    highlight?.cleanup?.();
    if (highlight) clearHighlight(highlight, true);
    window.removeEventListener('resize', onResize);
    restoreKeyboardEvents();
    const previous = highlight?.returnFocus;
    if (restoreFocus && previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
    }
}

export function targetHide(): void {
    hideHighlight(true);
}

function findElements(selector: Selector): Element[] {
    return (typeof selector === 'string'
        ? Array.from(document.querySelectorAll(selector))
        : [selector]
    ).filter(element => !element.hasAttribute('data-target-highlight-ignore'));
}

function whenTargetsExist(highlight: Highlight, show: (elements: Element[]) => void): void {
    const find = () => findElements(highlight.selector).filter(element =>
        !highlight.options.waitForTarget || element.isConnected
    );
    const elements = find();
    if (elements.length) {
        show(elements);
        return;
    }

    const wait = highlight.options.waitForTarget;
    if (!wait) {
        hideHighlight(true);
        throw new Error(`Element not found: ${highlight.selector}`);
    }

    const observer = new MutationObserver(() => {
        const found = find();
        if (!found.length) return;
        cancel();
        highlight.cancelPending = undefined;
        show(found);
    });
    const timer = setTimeout(() => {
        hideHighlight(true);
        wait.onTimeout?.();
    }, wait.timeoutMs ?? 3000);
    function cancel(): void {
        observer.disconnect();
        clearTimeout(timer);
    }
    highlight.cancelPending = cancel;
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
}

export function targetHighlight(selector: Selector, options: HighlightOptions = {}): void {
    const changingStep = Boolean(activeHighlight?.nodes.length);
    const resolved = { ...defaultOptions, ...options };
    const returnFocus = activeHighlight?.returnFocus ?? (resolved.focus ? document.activeElement : null);
    if (activeHighlight) hideHighlight(false);
    const highlight: Highlight = {
        selector,
        options: resolved,
        nodes: [],
        tooltips: [],
        returnFocus,
    };
    activeHighlight = highlight;

    const schedule = () => {
        const timer = setTimeout(() => {
            highlight.cancelPending = undefined;
            whenTargetsExist(highlight, elements => {
                const { scrollToTarget, scrollOnStepChange = defaultOptions.scrollOnStepChange } = highlight.options;
                const scroll = changingStep ? scrollOnStepChange : scrollToTarget;
                if (scroll) elements[0].scrollIntoView(scroll);
                if (!drawHighlight(highlight, elements)) return;
                highlight.cleanup = bindHighlight(highlight, elements);
                blockKeyboardEvents(highlight.options.blockedKeys ?? []);
                window.addEventListener('resize', onResize);
            });
        }, 0);
        highlight.cancelPending = () => clearTimeout(timer);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', schedule, { once: true });
        highlight.cancelPending = () => document.removeEventListener('DOMContentLoaded', schedule);
    } else {
        schedule();
    }
}

function onResize(): void {
    const highlight = activeHighlight;
    if (!highlight) return;
    highlight.updateGeometry?.(true);
    highlight.tooltips.forEach(({ reposition }) => reposition());
}

export type TourStep = { target: Selector; options?: HighlightOptions };

export function createTour(steps: readonly TourStep[], options: HighlightOptions = {}) {
    let index = -1;
    let owner: Highlight | undefined;

    function show(nextIndex: number): void {
        const step = steps[nextIndex];
        if (!step) return;
        index = nextIndex;
        const stepOptions = { ...options, ...step.options };
        let stepHighlight: Highlight | undefined;
        const isCurrent = () => stepHighlight === owner && owner === activeHighlight && index === nextIndex;
        targetHighlight(step.target, {
            ...stepOptions,
            nextCallback: () => {
                if (!isCurrent()) return;
                stepOptions.nextCallback?.();
                if (isCurrent()) next();
            },
            previousCallback: () => {
                if (!isCurrent()) return;
                stepOptions.previousCallback?.();
                if (isCurrent()) previous();
            },
            stopCallback: () => {
                if (!isCurrent()) return;
                stepOptions.stopCallback?.();
                if (isCurrent()) stop();
            },
            onDismiss: reason => {
                index = -1;
                stepOptions.onDismiss?.(reason);
            },
        });
        stepHighlight = owner = activeHighlight;
    }

    function next(): void {
        if (index < 0 || (activeHighlight && activeHighlight !== owner)) return;
        if (index === steps.length - 1) stop();
        else show(index + 1);
    }

    function previous(): void {
        if (index > 0 && (!activeHighlight || activeHighlight === owner)) show(index - 1);
    }

    function stop(): void {
        if (index < 0) return;
        index = -1;
        if (owner === activeHighlight) targetHide();
        owner = undefined;
    }

    return { start: () => show(0), next, previous, stop };
}

export const defaultConfig = defaultOptions;
