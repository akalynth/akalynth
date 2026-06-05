import { useEffect, useRef, useState } from 'react';

/**
 * Loads a fixed set of images once and returns them keyed however the caller
 * chooses. `ready` increments as each image finishes loading so consumers can
 * include it in an imperative-redraw dependency list (canvas drawing is
 * imperative, so a mutable Map plus a version counter is the simplest way to
 * trigger redraws). The returned Map identity is stable across renders.
 *
 * `entries` is read once on mount; pass a module-level (stable) array.
 */
export function useImagePreloader<K>(
  entries: ReadonlyArray<{ key: K; src: string }>,
): { images: Map<K, HTMLImageElement>; ready: number } {
  const imagesRef = useRef<Map<K, HTMLImageElement>>(new Map());
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let cancelled = false;
    for (const { key, src } of entries) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        imagesRef.current.set(key, img);
        setReady((n) => n + 1);
      };
      img.src = src;
    }
    return () => {
      cancelled = true;
    };
    // entries is a stable module-level constant; load once on mount.
  }, [entries]);

  return { images: imagesRef.current, ready };
}
