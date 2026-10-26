'use client';
import { useEffect, useRef, useState } from 'react';
type Lib = typeof import('pdfjs-dist');
// Renders every page of a PDF, fitted to the container width, keeping page proportions.
// A refresh draws offscreen first, so the previous image stays visible until the new one is ready.
// `source` must be memoized: a new function identity triggers a reload.
export function PdfPreview({ source }: { source: () => Promise<ArrayBuffer> }) {
  const host = useRef<HTMLDivElement>(null),
    [pages, setPages] = useState(0),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [width, setWidth] = useState(0);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    let doc: import('pdfjs-dist').PDFDocumentProxy | undefined;
    setLoading(true);
    (async () => {
      try {
        const [lib, data]: [Lib, ArrayBuffer] = await Promise.all([import('pdfjs-dist'), source()]);
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        doc = await lib.getDocument({ data: new Uint8Array(data) }).promise;
        if (cancelled) return;
        setPages(doc.numPages);
        await new Promise((r) => requestAnimationFrame(r));
        const ratio = devicePixelRatio || 1;
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: width / base.width });
          const off = document.createElement('canvas');
          off.width = Math.floor(viewport.width * ratio);
          off.height = Math.floor(viewport.height * ratio);
          await page.render({
            canvas: off,
            viewport,
            transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
          }).promise;
          const target = canvases.current[n - 1];
          if (cancelled || !target) return;
          target.width = off.width;
          target.height = off.height;
          target.style.width = `${viewport.width}px`;
          target.style.height = `${viewport.height}px`;
          target.getContext('2d')?.drawImage(off, 0, 0);
          target.dataset.rendered = 'true';
        }
        setError('');
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      doc?.loadingTask.destroy();
    };
  }, [source, width]);
  return (
    <div ref={host} className="relative w-full" aria-busy={loading}>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-4">
        {Array.from({ length: pages }, (_, i) => (
          <canvas
            key={i}
            ref={(c) => {
              canvases.current[i] = c;
            }}
            className="block max-w-full bg-white shadow-md"
          />
        ))}
      </div>
      {loading && (
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] text-slate-500 shadow">
          Mise à jour…
        </span>
      )}
    </div>
  );
}
