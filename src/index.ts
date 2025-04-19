type Selector = string | Element;

export interface HighlightOptions {
    overlayColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    overlayZIndex?: number;
    tooltip?: string;
    singleTooltip?: boolean;
    padding?: string;
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
    tip.textContent = opts.tooltip;
    Object.assign(tip.style, {
        position: 'absolute',
        visibility: 'hidden',
        zIndex: String(opts.overlayZIndex),
        whiteSpace: 'nowrap'
    });
    document.body.appendChild(tip);

    const w = tip.offsetWidth, h = tip.offsetHeight;
    const margin = 8;
    const vw = Math.max(document.body.clientWidth, document.documentElement.clientWidth);
    const vh = Math.max(document.body.clientHeight, document.documentElement.clientHeight);

    let left: number, top: number;
    if (rect.top >= h + margin) {
        top = rect.top + window.scrollY - h - margin;
        left = rect.left + window.scrollX + (rect.width - w) / 2;
    } else if (vh - rect.bottom >= h + margin) {
        top = rect.bottom + window.scrollY + margin;
        left = rect.left + window.scrollX + (rect.width - w) / 2;
    } else if (vw - rect.right >= w + margin) {
        top = rect.top + window.scrollY + (rect.height - h) / 2;
        left = rect.right + window.scrollX + margin;
    } else {
        top = rect.top + window.scrollY + (rect.height - h) / 2;
        left = rect.left + window.scrollX - w - margin;
    }

    Object.assign(tip.style, {
        top: `${top}px`,
        left: `${left}px`,
        visibility: 'visible'
    });
    return tip;
}

export function show(selectorOrElement: Selector, options: HighlightOptions = {}): void {
    currentSelector = selectorOrElement;
    currentOptions = { ...defaultOptions, ...options };

    const run = () => setTimeout(doShow, 0);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
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

    hide();

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

export function hide(): void {
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
