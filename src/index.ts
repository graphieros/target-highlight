type Selector = string | Element;

export interface HighlightOptions {
    overlayColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    overlayZIndex?: number;
    tooltip?: string | (() => string);
    singleTooltip?: boolean;
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
    forceTooltipPosition?: 'top' | 'right' | 'bottom' | 'left' | null,
    useResizeObserver?: boolean
}

const defaultOptions: Required<HighlightOptions> = {
    borderColor: '#00AAFF',
    borderRadius: 0,
    borderWidth: 2,
    overlayColor: '#00000050',
    overlayZIndex: 2147483647,
    padding: '0',
    singleTooltip: true,
    tooltip: '',
    hidePointerEvents: true,
    nextCallback: () => { },
    previousCallback: () => { },
    stopCallback: () => { },
    scrollToTarget: null,
    forceTooltipPosition: null,
    useResizeObserver: true
};

let svgOverlay: SVGSVGElement | null = null;
let highlightBorders: HTMLElement[] = [];
let tooltips: HTMLElement[] = [];
let currentSelector: Selector | null = null;
let currentOptions: Required<HighlightOptions> = { ...defaultOptions };
let _didScroll = false;
let resizeObserver: ResizeObserver | null = null;

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

function createSvgOverlay(rects: DOMRect[], opts: Required<HighlightOptions>, overlayFixed: boolean): SVGSVGElement {
    const XMLNS = 'http://www.w3.org/2000/svg';
    const pageWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
    const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

    const svg = document.createElementNS(XMLNS, 'svg');
    Object.assign(svg.style, {
        position: overlayFixed ? 'fixed' : 'absolute',
        top: '0',
        left: '0',
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        pointerEvents: opts.hidePointerEvents ? 'none' : 'all',
        zIndex: String(opts.overlayZIndex - 1)
    });

    const defs = document.createElementNS(XMLNS, 'defs');
    const mask = document.createElementNS(XMLNS, 'mask');
    const maskId = `highlight-mask-${Date.now()}`;
    mask.setAttribute('id', maskId);
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('maskContentUnits', 'userSpaceOnUse');

    // white = full show
    const full = document.createElementNS(XMLNS, 'rect');
    full.setAttribute('x', '0');
    full.setAttribute('y', '0');
    full.setAttribute('width', String(pageWidth));
    full.setAttribute('height', String(pageHeight));
    full.setAttribute('fill', 'white');
    mask.appendChild(full);

    // punch-holes with optional rounded corners
    rects.forEach(r => {
        const hole = document.createElementNS(XMLNS, 'rect');
        const x = overlayFixed ? r.left : r.left + window.scrollX;
        const y = overlayFixed ? r.top : r.top + window.scrollY;
        hole.setAttribute('x', String(x));
        hole.setAttribute('y', String(y));
        hole.setAttribute('width', String(r.width));
        hole.setAttribute('height', String(r.height));
        hole.setAttribute('rx', String(opts.borderRadius));
        hole.setAttribute('ry', String(opts.borderRadius));
        hole.setAttribute('fill', 'black');
        mask.appendChild(hole);
    });

    defs.appendChild(mask);
    svg.appendChild(defs);

    const overlay = document.createElementNS(XMLNS, 'rect');
    overlay.setAttribute('x', '0');
    overlay.setAttribute('y', '0');
    overlay.setAttribute('width', String(pageWidth));
    overlay.setAttribute('height', String(pageHeight));
    overlay.setAttribute('fill', opts.overlayColor);
    overlay.setAttribute('mask', `url(#${maskId})`);
    svg.appendChild(overlay);

    document.body.appendChild(svg);
    document.body.setAttribute('data-target-highlight', '')

    return svg;
}

function createBorder(rect: DOMRect, opts: Required<HighlightOptions>, overlayFixed: boolean): HTMLElement {
    const border = document.createElement('div');
    const left = overlayFixed ? rect.left : rect.left + window.scrollX;
    const top = overlayFixed ? rect.top : rect.top + window.scrollY;
    Object.assign(border.style, {
        position: overlayFixed ? 'fixed' : 'absolute',
        left: `${left - opts.borderWidth}px`,
        top: `${top - opts.borderWidth}px`,
        width: `${rect.width + opts.borderWidth * 2}px`,
        height: `${rect.height + opts.borderWidth * 2}px`,
        border: `${opts.borderWidth}px solid ${opts.borderColor}`,
        borderRadius: `${opts.borderRadius}px`,
        boxSizing: 'border-box',
        pointerEvents: 'none',
        zIndex: String(opts.overlayZIndex)
    });
    document.body.appendChild(border);
    return border;
}

function createTooltip(
    rect: DOMRect,
    opts: Required<HighlightOptions>,
    overlayFixed: boolean
): HTMLElement {
    const tip = document.createElement('div');
    tip.className = 'target-highlight-tooltip';
    if (typeof opts.tooltip === 'function') {
        tip.innerHTML = opts.tooltip();
    } else {
        tip.textContent = opts.tooltip;
    }
    Object.assign(tip.style, {
        position: overlayFixed ? 'fixed' : 'absolute',
        visibility: 'hidden',
        zIndex: String(opts.overlayZIndex),
        boxSizing: 'border-box',
        margin: '0'
    });
    document.body.appendChild(tip);

    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clamp = (v: number, min: number, max: number) =>
        Math.min(Math.max(v, min), max);

    type Placement = 'top' | 'bottom' | 'right' | 'left';
    const candidates: Array<{ name: Placement; l: number; t: number }> = [
        { name: 'top', l: rect.left + (rect.width - w) / 2, t: rect.top - h - margin },
        { name: 'bottom', l: rect.left + (rect.width - w) / 2, t: rect.bottom + margin },
        { name: 'right', l: rect.right + margin, t: rect.top + (rect.height - h) / 2 },
        { name: 'left', l: rect.left - w - margin, t: rect.top + (rect.height - h) / 2 }
    ];

    if (opts.forceTooltipPosition) {
        const forced = opts.forceTooltipPosition as Placement;
        let l: number, t: number;

        if (forced === 'top') {
            l = clamp(rect.left + (rect.width - w) / 2, margin, vw - margin - w);
            t = rect.top - h - margin;
        } else if (forced === 'bottom') {
            l = clamp(rect.left + (rect.width - w) / 2, margin, vw - margin - w);
            t = rect.bottom + margin;
        } else if (forced === 'left') {
            l = clamp(rect.left - w - margin, margin, vw - margin - w);
            t = rect.top + (rect.height - h) / 2;
        } else {
            l = clamp(rect.right + margin, margin, vw - margin - w);
            t = rect.top + (rect.height - h) / 2;
        }

        tip.setAttribute('data-placement', forced);
        const baseX = overlayFixed ? 0 : window.scrollX;
        const baseY = overlayFixed ? 0 : window.scrollY;
        tip.style.left = `${l + baseX}px`;
        tip.style.top = `${t + baseY}px`;
        tip.style.visibility = 'visible';
        return tip;
    }

    const fits = (l: number, t: number) =>
        l >= margin && t >= margin && l + w <= vw - margin && t + h <= vh - margin;

    const overlaps = (l: number, t: number) =>
        l < rect.left + rect.width &&
        l + w > rect.left &&
        t < rect.top + rect.height &&
        t + h > rect.top;

    let choice: { name: Placement; l: number; t: number } | null = null;

    // Ideal: fits & no overlap
    for (const c of candidates) {
        if (fits(c.l, c.t) && !overlaps(c.l, c.t)) {
            choice = { ...c };
            break;
        }
    }

    // Fallback: clamped pos that avoids overlap
    if (!choice) {
        for (const c of candidates) {
            const L = clamp(c.l, margin, vw - margin - w);
            const T = clamp(c.t, margin, vh - margin - h);
            if (!overlaps(L, T)) {
                choice = { name: c.name, l: L, t: T };
                break;
            }
        }
    }

    // Fallback: any unclamped candidate that fits
    if (!choice) {
        for (const c of candidates) {
            if (fits(c.l, c.t)) {
                choice = {
                    name: c.name,
                    l: clamp(c.l, margin, vw - margin - w),
                    t: clamp(c.t, margin, vh - margin - h)
                };
                break;
            }
        }
    }

    // Last resort: clamp top
    if (!choice) {
        const topC = candidates[0];
        choice = {
            name: 'top',
            l: clamp(topC.l, margin, vw - margin - w),
            t: clamp(topC.t, margin, vh - margin - h)
        };
    }

    // Derive final placement name from actual coords
    let finalName = choice.name;
    if (choice.t + h <= rect.top) finalName = 'top';
    else if (choice.t >= rect.bottom) finalName = 'bottom';
    else if (choice.l + w <= rect.left) finalName = 'left';
    else if (choice.l >= rect.right) finalName = 'right';

    if (finalName === 'bottom') {
        // center X, sit just below
        choice.l = clamp(rect.left + (rect.width - w) / 2, margin, vw - margin - w);
        choice.t = rect.bottom + margin;
    } else if (finalName === 'top') {
        // center X, sit just above
        choice.l = clamp(rect.left + (rect.width - w) / 2, margin, vw - margin - w);
        choice.t = rect.top - h - margin;
    } else if (finalName === 'left') {
        // center Y, sit just left, **clamp X**
        choice.l = clamp(rect.left - w - margin, margin, vw - margin - w);
        choice.t = clamp(rect.top + (rect.height - h) / 2, margin, vh - margin - h);
    } else if (finalName === 'right') {
        // center Y, sit just right, **clamp X**
        choice.l = clamp(rect.right + margin, margin, vw - margin - w);
        choice.t = clamp(rect.top + (rect.height - h) / 2, margin, vh - margin - h);
    }

    tip.setAttribute('data-placement', finalName);
    const baseX = overlayFixed ? 0 : window.scrollX;
    const baseY = overlayFixed ? 0 : window.scrollY;
    tip.style.left = `${choice.l + baseX}px`;
    tip.style.top = `${choice.t + baseY}px`;
    tip.style.visibility = 'visible';
    return tip;
}


function doShow(): void {
    if (!currentSelector) return;
    const allElements: Element[] = typeof currentSelector === 'string'
        ? Array.from(document.querySelectorAll(currentSelector))
        : [currentSelector];

    const elements = allElements.filter(el =>
        !el.hasAttribute('data-target-highlight-ignore')
    );

    if (elements.length === 0) {
        throw new Error(`Element not found: ${currentSelector}`);
    }

    if (currentOptions.scrollToTarget && elements.length && !_didScroll) {
        elements[0].scrollIntoView(currentOptions.scrollToTarget);
        _didScroll = true;
    }

    const overlayFixed = elements.every(isElementOrAncestorFixed);

    targetHide();

    // compute padded rects
    let rects = elements.map(el => el.getBoundingClientRect());
    if (currentOptions.padding && currentOptions.padding !== '0') {
        const p = parsePadding(currentOptions.padding);
        rects = rects.map(r => {
            const left = r.left - p.left;
            const top = r.top - p.top;
            const width = r.width + p.left + p.right;
            const height = r.height + p.top + p.bottom;
            const right = r.right + p.right;
            const bottom = r.bottom + p.bottom;
            return { left, top, width, height, right, bottom } as DOMRect;
        });
    }

    svgOverlay = createSvgOverlay(rects, currentOptions, overlayFixed);
    highlightBorders = rects.map(r => createBorder(r, currentOptions, overlayFixed));

    tooltips = [];

    const withData = elements.filter(el =>
        el.hasAttribute('data-target-highlight-tooltip')
    );
    const withoutData = elements.filter(el =>
        !el.hasAttribute('data-target-highlight-tooltip')
    );

    withData.forEach(el => {
        const idx = elements.indexOf(el);
        const rect = rects[idx];
        const text = el.getAttribute('data-target-highlight-tooltip')!;
        const posAttr = el.getAttribute('data-target-highlight-tooltip-position') as
            | 'top' | 'right' | 'bottom' | 'left'
            | null;
        tooltips.push(
            createTooltip(
                rect,
                {
                    ...currentOptions,
                    tooltip: text,
                    forceTooltipPosition: posAttr ?? currentOptions.forceTooltipPosition
                },
                overlayFixed
            )
        );
    });

    if (currentOptions.tooltip) {
        if (withoutData.length > 1 && currentOptions.singleTooltip) {
            const union = withoutData.reduce<Partial<DOMRect>>((u, el) => {
                const r = rects[elements.indexOf(el)];
                return {
                    top: Math.min(u.top ?? Infinity, r.top),
                    left: Math.min(u.left ?? Infinity, r.left),
                    bottom: Math.max(u.bottom ?? -Infinity, r.bottom),
                    right: Math.max(u.right ?? -Infinity, r.right)
                };
            }, { top: Infinity, left: Infinity, bottom: -Infinity, right: -Infinity });

            union.width = (union.right ?? 0) - (union.left ?? 0);
            union.height = (union.bottom ?? 0) - (union.top ?? 0);

            tooltips.push(
                createTooltip(
                    union as DOMRect,
                    {
                        ...currentOptions,
                    },
                    overlayFixed
                )
            );
        } else {
            withoutData.forEach(el => {
                const idx = elements.indexOf(el);
                const rect = rects[idx];
                const posAttr = el.getAttribute('data-target-highlight-tooltip-position') as
                    | 'top' | 'right' | 'bottom' | 'left'
                    | null;
                tooltips.push(
                    createTooltip(
                        rect,
                        {
                            ...currentOptions,
                            forceTooltipPosition: posAttr ?? currentOptions.forceTooltipPosition
                        },
                        overlayFixed
                    )
                );
            });
        }
    }

    window.addEventListener('resize', onResize);

    if (resizeObserver) {
        resizeObserver.disconnect();
    }
    if (currentOptions.useResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            targetHighlight(currentSelector!, { ...currentOptions })
        });
        elements.forEach(el => resizeObserver!.observe(el));
    }
}

export function targetHide(): void {
    if (svgOverlay) { svgOverlay.remove(); svgOverlay = null; }
    highlightBorders.forEach(b => b.remove());
    highlightBorders = [];
    tooltips.forEach(t => t.remove());
    tooltips = [];
    window.removeEventListener('resize', onResize);
    document.body.removeAttribute('data-target-highlight');
    _didScroll = false;

    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
    }
}

let _lastNext: ((e: Event) => void) | null = null;
let _lastPrev: ((e: Event) => void) | null = null;
let _lastStop: ((e: Event) => void) | null = null;

export function applyStepListeners(options: HighlightOptions = {}) {
    const btnNext = document.querySelector<HTMLElement>('#target-highlight-button-next');
    const btnPrev = document.querySelector<HTMLElement>('#target-highlight-button-previous');
    const btnStop = document.querySelector<HTMLElement>('#target-highlight-button-stop');
    const { nextCallback, previousCallback, stopCallback } = options;

    if (btnNext) {
        if (_lastNext) {
            btnNext.removeEventListener('click', _lastNext);
            _lastNext = null;
        }
        if (typeof nextCallback === 'function') {
            btnNext.addEventListener('click', nextCallback);
            _lastNext = nextCallback;
        }
    }

    if (btnPrev) {
        if (_lastPrev) {
            btnPrev.removeEventListener('click', _lastPrev);
            _lastPrev = null;
        }
        if (typeof previousCallback === 'function') {
            btnPrev.addEventListener('click', previousCallback);
            _lastPrev = previousCallback;
        }
    }

    if (btnStop) {
        if (_lastStop) {
            btnStop.removeEventListener('click', _lastStop);
            _lastStop = null;
        }
        if (typeof stopCallback === 'function') {
            btnStop.addEventListener('click', stopCallback);
            _lastStop = stopCallback;
        }
    }
}
export function targetHighlight(selectorOrElement: Selector, options: HighlightOptions = {}): void {
    currentSelector = selectorOrElement;
    currentOptions = { ...defaultOptions, ...options };

    const run = () => setTimeout(doShow, 0);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
        applyStepListeners(options)
    }
}

function onResize(): void {
    if (!currentSelector) return;
    doShow();
}

export const defaultConfig = defaultOptions;
