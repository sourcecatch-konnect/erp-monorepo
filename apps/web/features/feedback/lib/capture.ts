import type { FeedbackElement } from "@skerp/types";
import { canvasToScreenshot, tokenColor, type Screenshot } from "./images";

/**
 * B6 — pictures of the page, made in the browser (no upload until submit).
 *
 * html-to-image is loaded only when someone asks for a picture. It renders the
 * DOM through the browser itself, so oklch colours and modern CSS come out
 * right. Password fields are left out of every picture.
 */

const loadRenderer = () => import("html-to-image");

const skipSensitive = (node: HTMLElement) =>
  !(node instanceof HTMLInputElement && node.type === "password");

const backgroundColor = () =>
  getComputedStyle(document.body).backgroundColor || tokenColor("--background", "white");

/** The scrolling work area of the app shell (falls back to the whole page). */
const workArea = (): HTMLElement =>
  document.querySelector<HTMLElement>("main") ?? document.body;

/**
 * What the user can see of the current page. The work area scrolls inside
 * <main>, and a DOM copy always starts at the top, so the copy is shifted up
 * by the scroll position and clipped to the visible height.
 */
export async function capturePage(): Promise<Screenshot> {
  const { toCanvas } = await loadRenderer();
  const area = workArea();
  const content = (area.firstElementChild as HTMLElement | null) ?? area;
  const canvas = await toCanvas(content, {
    width: area.clientWidth,
    height: area.clientHeight,
    backgroundColor: backgroundColor(),
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    filter: skipSensitive,
    style: { transform: `translateY(-${area.scrollTop}px)` },
  });
  return canvasToScreenshot(canvas, "page");
}

/** A picture of the picked part with a box around it, plus some of what's around it. */
export async function captureElement(element: HTMLElement): Promise<Screenshot> {
  const { toCanvas } = await loadRenderer();

  // A lone button makes a useless tiny picture — climb to a parent big enough
  // to show where on the page it is.
  let frame: HTMLElement = element;
  while (frame.parentElement && frame !== workArea()) {
    const rect = frame.getBoundingClientRect();
    if (rect.width >= 360 && rect.height >= 180) break;
    frame = frame.parentElement;
  }

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = await toCanvas(frame, {
    backgroundColor: backgroundColor(),
    pixelRatio: ratio,
    filter: skipSensitive,
  });

  const frameRect = frame.getBoundingClientRect();
  const target = element.getBoundingClientRect();
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const pad = 4 * ratio;
    ctx.lineWidth = 3 * ratio;
    ctx.strokeStyle = tokenColor("--destructive", "red");
    ctx.strokeRect(
      (target.left - frameRect.left) * ratio - pad,
      (target.top - frameRect.top) * ratio - pad,
      target.width * ratio + pad * 2,
      target.height * ratio + pad * 2,
    );
  }
  return canvasToScreenshot(canvas, "element");
}

/** Short, stable-ish path such as "main > div > table > tbody > tr:nth-of-type(3)". */
function cssPath(element: Element): string {
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node !== document.body && parts.length < 8) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`${part}#${node.id}`);
      break;
    }
    const slot = node.getAttribute("data-slot");
    if (slot) part += `[data-slot="${slot}"]`;
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (child) => child.tagName === node!.tagName,
      );
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(" > ").slice(0, 500);
}

export type PickedElement = { element: HTMLElement; info: FeedbackElement };

/**
 * Lets the user hover and click the part of the screen that's wrong.
 * Resolves null if they press Esc. While picking, clicks don't reach the page.
 */
export function pickElement(): Promise<PickedElement | null> {
  return new Promise((resolve) => {
    const highlight = document.createElement("div");
    Object.assign(highlight.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "2147483646",
      border: "2px solid var(--primary)",
      background: "color-mix(in oklch, var(--primary) 12%, transparent)",
      borderRadius: "var(--radius)",
      transition: "all 80ms",
      display: "none",
    });

    const banner = document.createElement("div");
    banner.setAttribute("role", "status");
    banner.textContent =
      "Click the part of the screen that has the problem. Press Esc to cancel.";
    Object.assign(banner.style, {
      position: "fixed",
      top: "12px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      padding: "10px 16px",
      font: "500 14px/1.4 var(--font-sans, system-ui)",
      color: "var(--popover-foreground)",
      background: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      boxShadow: "0 4px 12px rgb(0 0 0 / 0.12)",
      pointerEvents: "none",
    });

    document.body.append(highlight, banner);
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    let current: HTMLElement | null = null;

    const targetAt = (x: number, y: number): HTMLElement | null => {
      const el = document.elementFromPoint(x, y);
      return el instanceof HTMLElement && el !== highlight && el !== banner ? el : null;
    };

    const onMove = (event: PointerEvent) => {
      current = targetAt(event.clientX, event.clientY);
      if (!current) return;
      const rect = current.getBoundingClientRect();
      Object.assign(highlight.style, {
        display: "block",
        left: `${rect.left - 2}px`,
        top: `${rect.top - 2}px`,
        width: `${rect.width + 4}px`,
        height: `${rect.height + 4}px`,
      });
    };

    const block = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const finish = (picked: HTMLElement | null) => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerdown", block, true);
      document.removeEventListener("mousedown", block, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      highlight.remove();
      banner.remove();
      document.body.style.cursor = previousCursor;
      if (!picked) return resolve(null);
      const rect = picked.getBoundingClientRect();
      resolve({
        element: picked,
        info: {
          selector: cssPath(picked),
          tag: picked.tagName.toLowerCase(),
          text: picked.innerText?.replace(/\s+/g, " ").trim().slice(0, 120) || undefined,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        },
      });
    };

    const onClick = (event: MouseEvent) => {
      block(event);
      finish(targetAt(event.clientX, event.clientY) ?? current);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        block(event);
        finish(null);
      }
    };

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerdown", block, true);
    document.addEventListener("mousedown", block, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
  });
}
