import { useLayoutEffect, useState } from "react";

let measurer: CanvasRenderingContext2D | null | undefined;

/** A text's drawn width in px, in the page's own font at `size` and `weight`, so labels are laid out where they end. */
export function textWidth(text: string, size: number, weight = 400): number {
  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return text.length * size * 0.55;
  measurer.font = `${weight} ${size}px ${getComputedStyle(document.body).fontFamily}`;
  return measurer.measureText(text).width;
}

/** An element's width in px, kept up to date as it resizes; 0 until it has been laid out. */
export function useWidth(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
}
