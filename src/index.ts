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
    nextCallback: () => {},
    previousCallback: () => {}
};

let svgOverlay: SVGSVGElement | null = null;
let highlightBorders: HTMLElement[] = [];
let tooltips: HTMLElement[] = [];
let currentSelector: Selector | null = null;
let currentOptions: Required<HighlightOptions> = { ...defaultOptions };

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

function createSvgOverlay(rects: DOMRect[], opts: Required<HighlightOptions>): SVGSVGElement {
    const XMLNS = 'http://www.w3.org/2000/svg';
    const pageWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
    const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

    const svg = document.createElementNS(XMLNS, 'svg');
    Object.assign(svg.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        pointerEvents: 'auto',
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

    // punch-holes with rounded corners
    rects.forEach(r => {
        const hole = document.createElementNS(XMLNS, 'rect');
        hole.setAttribute('x', String(r.left + window.scrollX));
        hole.setAttribute('y', String(r.top + window.scrollY));
        hole.setAttribute('width', String(r.width));
        hole.setAttribute('height', String(r.height));
        // apply borderRadius to hole corners
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
    svg.style.pointerEvents = opts.hidePointerEvents ? 'none' : 'all';

    document.body.appendChild(svg);
    return svg;
}

function createBorder(rect: DOMRect, opts: Required<HighlightOptions>): HTMLElement {
    const border = document.createElement('div');
    Object.assign(border.style, {
        position: 'absolute',
        left: `${rect.left + window.scrollX - opts.borderWidth}px`,
        top: `${rect.top + window.scrollY - opts.borderWidth}px`,
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

function createTooltip(rect: DOMRect, opts: Required<HighlightOptions>): HTMLElement {
    const tip = document.createElement('div');
    tip.className = 'target-highlight-tooltip';
    if (typeof opts.tooltip === 'function') {
        tip.innerHTML = opts.tooltip();
    } else {
        tip.textContent = opts.tooltip;
    }
    Object.assign(tip.style, {
        position: 'absolute',
        visibility: 'hidden',
        zIndex: String(opts.overlayZIndex),
        whiteSpace: 'nowrap',
    });

    document.body.appendChild(tip);

    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const clamp = (val: number, min: number, max: number) =>
        Math.min(Math.max(val, min), max);

    const overlapsElement = (l: number, t: number) =>
        l < rect.left + rect.width &&
        l + w > rect.left &&
        t < rect.top + rect.height &&
        t + h > rect.top;

    // Define placements in priority order
    const placements: Array<{
        name: 'top' | 'bottom' | 'right' | 'left';
        compute: () => { l: number; t: number };
    }> = [
            {
                name: 'top',
                compute: () => ({
                    l: rect.left + (rect.width - w) / 2,
                    t: rect.top - h - margin
                })
            },
            {
                name: 'bottom',
                compute: () => ({
                    l: rect.left + (rect.width - w) / 2,
                    t: rect.bottom + margin
                })
            },
            {
                name: 'right',
                compute: () => ({
                    l: rect.right + margin,
                    t: rect.top + (rect.height - h) / 2
                })
            },
            {
                name: 'left',
                compute: () => ({
                    l: rect.left - w - margin,
                    t: rect.top + (rect.height - h) / 2
                })
            }
        ];

    type Choice = { name: string; l: number; t: number };
    let choice: Choice | null = null;

    // Try each placement **ideal** position: fits viewport & no overlap
    for (const { name, compute } of placements) {
        const { l, t } = compute();
        if (
            l >= margin &&
            t >= margin &&
            l + w <= vw - margin &&
            t + h <= vh - margin &&
            !overlapsElement(l, t)
        ) {
            choice = { name, l, t };
            break;
        }
    }

    // Fallback: try clamped positions that avoid overlap
    if (!choice) {
        for (const { name, compute } of placements) {
            const { l: rawL, t: rawT } = compute();
            const l = clamp(rawL, margin, vw - margin - w);
            const t = clamp(rawT, margin, vh - margin - h);
            if (!overlapsElement(l, t)) {
                choice = { name, l, t };
                break;
            }
        }
    }

    // Fallback: any placement that fits viewport (even if overlaps), clamped
    if (!choice) {
        for (const { name, compute } of placements) {
            const { l: rawL, t: rawT } = compute();
            if (
                rawL >= margin &&
                rawT >= margin &&
                rawL + w <= vw - margin &&
                rawT + h <= vh - margin
            ) {
                const l = clamp(rawL, margin, vw - margin - w);
                const t = clamp(rawT, margin, vh - margin - h);
                choice = { name, l, t };
                break;
            }
        }
    }

    // Last resort: clamp “top” into viewport
    if (!choice) {
        const { l: rawL, t: rawT } = placements[0].compute();
        const l = clamp(rawL, margin, vw - margin - w);
        const t = clamp(rawT, margin, vh - margin - h);
        choice = { name: 'top', l, t };
    }

    // Position and expose placement
    tip.setAttribute('data-placement', choice.name);
    tip.style.left = `${choice.l + window.scrollX}px`;
    tip.style.top = `${choice.t + window.scrollY}px`;
    tip.style.visibility = 'visible';

    return tip;
}

export function applyStepListeners(options: HighlightOptions = {}) {
    const buttonNext = document.querySelector('#target-highlight-button-next');
    const buttonPrevious = document.querySelector('#target-highlight-button-previous');
    if (buttonNext && options.nextCallback) {
        buttonNext.addEventListener('click', options.nextCallback)
    }
    if (buttonPrevious && options.previousCallback) {
        buttonPrevious.addEventListener('click', options.previousCallback)
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

function doShow(): void {
    if (!currentSelector) return;
    const elements = typeof currentSelector === 'string'
        ? Array.from(document.querySelectorAll(currentSelector))
        : [currentSelector];
    if (elements.length === 0) {
        throw new Error(`Element not found: ${currentSelector}`);
    }

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

    svgOverlay = createSvgOverlay(rects, currentOptions);
    highlightBorders = rects.map(r => createBorder(r, currentOptions));

    if (currentOptions.tooltip) {
        if (elements.length > 1 && currentOptions.singleTooltip) {
            const union = rects.reduce((u, r) => ({
                top: Math.min(u.top, r.top),
                left: Math.min(u.left, r.left),
                bottom: Math.max(u.bottom, r.bottom),
                right: Math.max(u.right, r.right)
            }), { top: Infinity, left: Infinity, bottom: -Infinity, right: -Infinity } as any);
            (union as any).width = union.right - union.left;
            (union as any).height = union.bottom - union.top;
            tooltips = [createTooltip(union as DOMRect, currentOptions)];
        } else {
            tooltips = rects.map(r => createTooltip(r, currentOptions));
        }
    }

    window.addEventListener('resize', onResize);
}

export function targetHide(): void {
    if (svgOverlay) { svgOverlay.remove(); svgOverlay = null; }
    highlightBorders.forEach(b => b.remove());
    highlightBorders = [];
    tooltips.forEach(t => t.remove());
    tooltips = [];
    window.removeEventListener('resize', onResize);
}

function onResize(): void {
    if (!currentSelector) return;
    doShow();
}

export const defaultConfig = defaultOptions;
