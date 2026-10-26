'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Save, Copy, Trash2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, saveBlob } from '@/lib/client';
import type { Field, PageSize } from '@/lib/fields';
type Template = { id: string; name: string; fields: Field[]; pageSizes: PageSize[] };
type Pdf = import('pdfjs-dist').PDFDocumentProxy;
export function PdfEditor({ id, onError }: { id: string; onError: (message: string) => void }) {
  const [template, setTemplate] = useState<Template | null>(null),
    [fields, setFields] = useState<Field[]>([]),
    [active, setActive] = useState(0),
    [page, setPage] = useState(0),
    [zoom, setZoom] = useState(1),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null),
    pdf = useRef<Pdf | null>(null),
    frame = useRef<HTMLDivElement>(null),
    labelInput = useRef<HTMLInputElement>(null),
    // Index of a field added this session whose key still follows its label.
    fresh = useRef<number | null>(null);
  const [focusLabel, setFocusLabel] = useState(0);
  useEffect(() => {
    let alive = true;
    api<Template>(`templates/${id}`)
      .then((t) => {
        if (alive) {
          setTemplate(t);
          setFields(t.fields);
        }
      })
      .catch((e) => onError(e.message));
    import('pdfjs-dist')
      .then(async (lib) => {
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const loaded = await lib.getDocument({ url: `/api/templates/${id}/file` }).promise;
        if (!alive) {
          await loaded.loadingTask.destroy();
          return;
        }
        pdf.current = loaded;
        setStatus('loaded');
      })
      .catch((e) => {
        if (alive) onError(e.message);
      });
    return () => {
      alive = false;
      pdf.current?.loadingTask.destroy();
      pdf.current = null;
    };
  }, [id]);
  useEffect(() => {
    if (!pdf.current || !canvas.current) return;
    let cancelled = false;
    let task: import('pdfjs-dist').RenderTask | undefined;
    pdf.current
      .getPage(page + 1)
      .then(async (p) => {
        if (cancelled || !canvas.current) return;
        const viewport = p.getViewport({ scale: zoom });
        const c = canvas.current;
        delete c.dataset.renderedPage;
        const ratio = devicePixelRatio || 1;
        c.width = Math.floor(viewport.width * ratio);
        c.height = Math.floor(viewport.height * ratio);
        c.style.width = `${viewport.width}px`;
        c.style.height = `${viewport.height}px`;
        task = p.render({
          canvas: c,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        });
        await task.promise;
        if (!cancelled) c.dataset.renderedPage = String(page + 1);
      })
      .catch((e) => {
        if (!cancelled && e.name !== 'RenderingCancelledException') onError(e.message);
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [status, page, zoom]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const current = fields[active],
    size = template?.pageSizes[page];
  function changePage(next: number) {
    setPage(next);
    setActive(fields.findIndex((f) => (f.page ?? 0) === next));
  }
  function update(index: number, patch: Partial<Field>) {
    setFields((old) => old.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    setDirty(true);
  }
  useEffect(() => {
    if (!focusLabel) return;
    labelInput.current?.focus();
    labelInput.current?.select();
  }, [focusLabel]);
  function slug(label: string, index: number) {
    const base =
      label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 36) || 'champ';
    const taken = new Set(fields.filter((_, i) => i !== index).map((f) => f.key));
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
    return key;
  }
  function add() {
    const next: Field = {
      key: `champ_${Date.now()}`,
      label: `Champ ${fields.length + 1}`,
      type: 'text',
      page,
      x: 20,
      y: 30,
      size: 10,
      bold: false,
      required: false,
      max_chars: 0,
      max_width_mm: 0,
      default: '',
      clear_before: false,
      options: [],
    };
    setFields([...fields, next]);
    setActive(fields.length);
    fresh.current = fields.length;
    setFocusLabel((n) => n + 1);
    setDirty(true);
  }
  function position(e: { clientX: number; clientY: number }) {
    const r = frame.current!.getBoundingClientRect();
    return {
      x:
        Math.round(
          Math.max(0, Math.min(size!.width, ((e.clientX - r.left) / r.width) * size!.width)) * 10,
        ) / 10,
      y:
        Math.round(
          Math.max(0, Math.min(size!.height, ((e.clientY - r.top) / r.height) * size!.height)) * 10,
        ) / 10,
    };
  }
  function drag(e: React.PointerEvent, index: number, option?: number) {
    e.stopPropagation();
    e.preventDefault();
    setActive(index);
    const move = (ev: PointerEvent) => {
      const p = position(ev);
      if (option === undefined) update(index, p);
      else
        setFields((old) =>
          old.map((f, i) =>
            i === index
              ? {
                  ...f,
                  options: f.options.map((o, j) =>
                    j === option && typeof o !== 'string' ? { ...o, ...p } : o,
                  ),
                }
              : f,
          ),
        );
      setDirty(true);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }
  async function save() {
    setBusy(true);
    try {
      await api(`templates/${id}`, 'PATCH', { fields });
      setDirty(false);
      setStatus('Enregistré');
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    try {
      const r = await fetch(`/api/templates/${id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      saveBlob(await r.blob(), 'GED-by-DZ_test.pdf');
    } catch (e) {
      onError((e as Error).message);
    }
  }
  if (!template || !size) return <p className="muted">Chargement de l’éditeur…</p>;
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>{template.name}</h1>
          <p className="muted mt-1">
            {size.width.toFixed(1)} × {size.height.toFixed(1)} mm · {template.pageSizes.length}{' '}
            page(s) · {dirty ? 'Modifications non enregistrées' : 'Modèle prêt à éditer'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="secondary" onClick={preview}>
            PDF test
          </button>
          <button disabled={busy} onClick={save}>
            <Save size={16} />
            Enregistrer
          </button>
        </div>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[210px_minmax(0,1fr)_260px]">
        <aside className="card !p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2>Champs</h2>
            <button onClick={add} aria-label="Ajouter un champ" className="!p-2">
              <Plus size={16} />
            </button>
          </div>
          <div className="grid max-h-[65vh] gap-2 overflow-y-auto">
            {fields.map((f, i) => (
              <button
                className={`!justify-start text-left text-xs ${active === i ? '' : 'secondary'}`}
                key={i}
                onClick={() => {
                  fresh.current = null;
                  setActive(i);
                  setPage(f.page ?? 0);
                }}
              >
                {i + 1}. {f.label}
                <span className="ml-auto opacity-60">p.{(f.page ?? 0) + 1}</span>
              </button>
            ))}
            {!fields.length && (
              <p className="muted p-2 text-xs leading-6">
                Ajoutez un champ, puis cliquez sur le PDF pour le positionner.
              </p>
            )}
          </div>
        </aside>
        <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-200/70">
          <div className="flex flex-wrap items-center justify-center gap-3 border-b border-slate-300 p-3">
            <button
              className="secondary !p-2"
              disabled={!page}
              onClick={() => changePage(page - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {page + 1} / {template.pageSizes.length}
            </span>
            <button
              className="secondary !p-2"
              disabled={page === template.pageSizes.length - 1}
              onClick={() => changePage(page + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="secondary !p-2"
              onClick={() => setZoom(Math.max(0.25, zoom - 0.15))}
              aria-label="Réduire"
            >
              <ZoomOut size={16} />
            </button>
            <span>{Math.round(zoom * 100)} %</span>
            <button
              className="secondary !p-2"
              onClick={() => setZoom(Math.min(3, zoom + 0.15))}
              aria-label="Agrandir"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <div className="max-h-[72vh] overflow-auto p-5">
            <div
              ref={frame}
              className="relative w-max bg-white shadow-lg"
              onClick={(e) => {
                if (current && current.type !== 'checkbox')
                  update(active, { ...position(e), page });
              }}
            >
              <canvas ref={canvas} className="block" />
              {fields.flatMap((f, i) => {
                if ((f.page ?? 0) !== page) return [];
                const points =
                  f.type === 'checkbox'
                    ? f.options.flatMap((o, j) =>
                        typeof o === 'string' ? [] : [{ ...o, option: j }],
                      )
                    : [{ x: f.x, y: f.y, option: undefined }];
                return points.map((p, j) => (
                  <div
                    key={`${i}-${j}`}
                    onPointerDown={(e) => drag(e, i, p.option)}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none rounded border-2 px-1 text-[10px] font-bold shadow-sm ${active === i ? 'border-emerald-700 bg-emerald-100 text-emerald-900' : 'border-blue-500 bg-blue-50 text-blue-800'}`}
                    style={{
                      left: `${(p.x / size.width) * 100}%`,
                      top: `${(p.y / size.height) * 100}%`,
                      touchAction: 'none',
                    }}
                    title={f.label}
                  >
                    {i + 1}
                    {p.option !== undefined ? `.${p.option + 1}` : ''} +
                  </div>
                ));
              })}
            </div>
          </div>
        </section>
        <aside className="card grid gap-4 !p-4">
          {current ? (
            <>
              <h2>Propriétés</h2>
              <label>
                Libellé
                <input
                  ref={labelInput}
                  value={current.label}
                  maxLength={120}
                  onChange={(e) =>
                    update(
                      active,
                      fresh.current === active
                        ? { label: e.target.value, key: slug(e.target.value, active) }
                        : { label: e.target.value },
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                />
              </label>
              <label>
                Clé
                <input
                  value={current.key}
                  maxLength={40}
                  onChange={(e) => {
                    fresh.current = null;
                    update(active, {
                      key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                    });
                  }}
                />
              </label>
              <label>
                Type
                <select
                  value={current.type}
                  onChange={(e) =>
                    update(active, { type: e.target.value as Field['type'], options: [] })
                  }
                >
                  {Object.entries({
                    text: 'Texte',
                    textarea: 'Texte long',
                    number: 'Nombre',
                    date: 'Date',
                    rating: 'Note 1–5',
                    select: 'Liste',
                    checkbox: 'Cases à cocher',
                  }).map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y'] as const).map((axis) => (
                  <label key={axis}>
                    {axis.toUpperCase()} (mm)
                    <input
                      type="number"
                      min={0}
                      max={axis === 'x' ? size.width : size.height}
                      step="0.1"
                      value={current[axis]}
                      onChange={(e) => update(active, { [axis]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  Taille (pt)
                  <input
                    type="number"
                    min={4}
                    max={48}
                    value={current.size}
                    onChange={(e) => update(active, { size: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Largeur (mm)
                  <input
                    type="number"
                    min={0}
                    max={size.width}
                    value={current.max_width_mm}
                    onChange={(e) => update(active, { max_width_mm: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label>
                Limite de caractères
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={current.max_chars}
                  onChange={(e) => update(active, { max_chars: Number(e.target.value) })}
                />
              </label>
              <label>
                Valeur par défaut
                <input
                  value={current.default}
                  onChange={(e) => update(active, { default: e.target.value })}
                />
              </label>
              {(['required', 'bold', 'clear_before'] as const).map((key, i) => (
                <label className="!flex items-center gap-2" key={key}>
                  <input
                    type="checkbox"
                    checked={current[key]}
                    onChange={(e) => update(active, { [key]: e.target.checked })}
                  />
                  {['Obligatoire', 'Gras', 'Effacer le fond du champ'][i]}
                </label>
              ))}
              {current.type === 'select' && (
                <label>
                  Options (une par ligne)
                  <textarea
                    rows={5}
                    value={current.options.filter((o) => typeof o === 'string').join('\n')}
                    onChange={(e) => update(active, { options: e.target.value.split('\n') })}
                  />
                </label>
              )}
              {current.type === 'checkbox' && (
                <div className="grid gap-2">
                  <h2>Cases</h2>
                  {current.options.map(
                    (o, j) =>
                      typeof o !== 'string' && (
                        <div className="grid gap-2 rounded-lg bg-slate-50 p-2" key={j}>
                          <input
                            aria-label={`Libellé case ${j + 1}`}
                            value={o.label}
                            onChange={(e) =>
                              update(active, {
                                options: current.options.map((v, k) =>
                                  k === j ? { ...o, label: e.target.value } : v,
                                ),
                              })
                            }
                          />
                          <div className="grid grid-cols-2 gap-2">
                            {(['x', 'y'] as const).map((axis) => (
                              <label key={axis}>
                                {axis.toUpperCase()}
                                <input
                                  type="number"
                                  min={0}
                                  max={axis === 'x' ? size.width : size.height}
                                  step=".1"
                                  value={o[axis]}
                                  onChange={(e) =>
                                    update(active, {
                                      options: current.options.map((v, k) =>
                                        k === j ? { ...o, [axis]: Number(e.target.value) } : v,
                                      ),
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          <button
                            className="secondary"
                            onClick={() =>
                              update(active, { options: current.options.filter((_, k) => k !== j) })
                            }
                          >
                            Retirer
                          </button>
                        </div>
                      ),
                  )}
                  <button
                    className="secondary"
                    onClick={() =>
                      update(active, {
                        options: [
                          ...current.options,
                          {
                            label: `Option ${current.options.length + 1}`,
                            x: current.x,
                            y: Math.min(size.height, current.y + current.options.length * 6),
                          },
                        ],
                      })
                    }
                  >
                    Ajouter une case
                  </button>
                </div>
              )}
              <div className="flex gap-2 border-t border-slate-200 pt-3">
                <button
                  className="secondary !p-2"
                  aria-label="Dupliquer le champ"
                  onClick={() => {
                    setFields([
                      ...fields,
                      {
                        ...structuredClone(current),
                        x: Math.min(size.width, current.x + 6),
                        y: Math.min(size.height, current.y + 6),
                        _duplicate: true,
                        _dup_id: crypto.randomUUID(),
                      },
                    ]);
                    setActive(fields.length);
                    setDirty(true);
                  }}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="danger !p-2"
                  aria-label="Supprimer le champ"
                  onClick={() => {
                    fresh.current = null;
                    setFields(fields.filter((_, i) => i !== active));
                    setActive(Math.max(0, active - 1));
                    setDirty(true);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Sélectionnez ou ajoutez un champ.</p>
          )}
        </aside>
      </div>
    </>
  );
}
