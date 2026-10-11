import { useEffect, useMemo, useId, useState } from 'react';
import FileCard from './components/FileCard';
import { cn } from './lib/utils';

type Field = {
  name: string;
  label: string;
  type: string;
  default?: string | number | boolean;
  options?: { value: string; label: string }[];
  required?: boolean;
  accept?: string;
  help?: string;
};

type Tool = {
  id: string;
  title: string;
  description: string;
  accept?: string;
  multiple?: boolean;
  fields?: Field[];
  available: boolean;
  reason?: string;
  category?: string;
  icon?: string;
};

type ExtraValue = string | number | boolean | File;

type Result = { url: string; name: string; text?: string };

const API = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const ICON_KEYS = new Set(['pdf', 'doc', 'md', 'mdx', 'csv', 'xls', 'xlsx', 'txt', 'ppt', 'pptx', 'zip', 'rar', 'tar', 'gz', 'code', 'html', 'js', 'jsx', 'tsx', 'css', 'json', 'img', 'png', 'jpg', 'jpeg', 'video']);
const CATEGORY_LABELS: Record<string, string> = { all: 'Semua', pdf: 'PDF', convert: 'Konversi', optimize: 'Gambar', data: 'Data' };

const iconFor = (tool: Tool) => {
  const candidate = (tool.icon || tool.accept?.split(',')[0]?.replace('.', '') || 'pdf').toLowerCase();
  return (ICON_KEYS.has(candidate) ? candidate : 'code') as NonNullable<Parameters<typeof FileCard>[0]['formatFile']>;
};

const routeIdFromHash = () => (window.location.hash.startsWith('#tool/') ? decodeURIComponent(window.location.hash.slice(6)) : '');

function ToolPage({ tool, onHome }: { tool: Tool; onHome: () => void }) {
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [extra, setExtra] = useState<Record<string, ExtraValue>>(() =>
    Object.fromEntries((tool.fields ?? []).map((field) => [field.name, field.default ?? (field.type === 'checkbox' ? false : '')]))
  );
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const addFiles = (incoming: FileList | File[]) => {
    if (!tool.available) return;
    const next = Array.from(incoming);
    const allowed = (tool.accept || '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    const rejected = allowed.length ? next.find((file) => !allowed.some((extension) => file.name.toLowerCase().endsWith(extension))) : undefined;
    if (rejected) { setError(`${rejected.name}: format file tidak sesuai (${tool.accept}).`); return; }
    if (!next.length) return;
    setError('');
    setFiles((previous) => (tool.multiple ? [...previous, ...next] : next.slice(0, 1)));
  };

  const move = (index: number, direction: number) => setFiles((previous) => {
    const target = index + direction;
    if (target < 0 || target >= previous.length) return previous;
    const reordered = [...previous];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    return reordered;
  });

  const submit = async () => {
    setError('');
    if (result) { URL.revokeObjectURL(result.url); setResult(null); }
    if (!tool.available) { setError(tool.reason || 'Tool ini belum tersedia di server.'); return; }
    const hasAlternativeInput = (tool.fields ?? []).some(
      (field) => (field.type === 'textarea' || field.name === 'text' || field.name === 'html') && Boolean(extra[field.name])
    );
    if (!files.length && !hasAlternativeInput) { setError('Pilih setidaknya satu file atau isi konten yang diperlukan.'); return; }
    for (const field of tool.fields ?? []) {
      if (field.required && !extra[field.name]) { setError(`${field.label} wajib diisi.`); return; }
    }
    setBusy(true);
    try {
      const body = new FormData();
      files.forEach((file) => body.append('files', file));
      for (const field of tool.fields ?? []) {
        const value = extra[field.name];
        if (value instanceof File) body.append(field.name, value);
        else if (value !== undefined) body.append(field.name, String(value));
      }
      const response = await fetch(`${API}/api/convert/${encodeURIComponent(tool.id)}`, { method: 'POST', body });
      if (!response.ok) {
        const raw = await response.text();
        let message = raw;
        try { message = JSON.parse(raw).error || raw; } catch { /* plain-text error */ }
        throw new Error(message || `Server error (${response.status})`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if ('error' in data) throw new Error(data.error);
        const text = typeof data.result === 'string' ? data.result : JSON.stringify(data.result ?? data, null, 2);
        setResult({ url: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), name: `${tool.id}-result.txt`, text });
      } else {
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') || '';
        const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
        const name = encoded ? decodeURIComponent(encoded) : plain || `${tool.id}-result`;
        setResult({ url: URL.createObjectURL(blob), name: name.split(/[\\/]/).pop() || `${tool.id}-result` });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pemrosesan gagal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-border/80 bg-panel/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <button type="button" onClick={onHome} className="group flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
            <span className="text-lg transition-transform group-hover:-translate-x-0.5">←</span> Semua alat
          </button>
          <img src="/bprconvert-logo.png" alt="BPRCONVERT" className="h-9 w-auto object-contain" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-9 text-center">
          <div className="bg-panel mx-auto mb-5 w-fit rounded-2xl p-3 shadow-[var(--shadow-card)]"><FileCard formatFile={iconFor(tool)} /></div>
          <p className="text-primary text-sm font-bold">Alat konverter file</p>
          <h1 className="text-foreground mt-3 text-3xl font-black tracking-tight sm:text-4xl">{tool.title}</h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-6">{tool.description}</p>
        </div>

        {!tool.available && (
          <p className="panel-warning mb-5 rounded-lg p-4 text-sm leading-6">
            {tool.reason || 'Tool ini belum tersedia.'}
          </p>
        )}

        <div
          className={cn('group bg-panel has-[input:focus-visible]:border-primary has-[input:focus-visible]:outline-primary rounded-2xl border-2 border-dashed p-5 shadow-[var(--shadow-card)] transition has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-4 sm:p-8', dragging ? 'border-primary bg-[var(--surface-soft)]' : 'border-border hover:border-primary', !tool.available && 'opacity-60')}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
        >
          <label htmlFor={inputId} className={cn('flex min-h-48 flex-col items-center justify-center rounded-xl px-4 text-center', tool.available ? 'cursor-pointer' : 'cursor-not-allowed')}>
            <span className="bg-[var(--surface-soft)] text-primary mb-4 flex size-14 items-center justify-center rounded-2xl text-2xl font-bold transition-transform group-hover:-translate-y-0.5">↑</span>
            <span className="text-foreground text-base font-bold">Pilih file atau tarik ke sini</span>
            <span className="text-muted-foreground mt-2 text-xs">{tool.accept || 'Isi opsi di bawah'}{tool.multiple ? ' · beberapa file didukung' : ''}</span>
            <span className="text-muted-foreground bg-panel-soft mt-5 rounded-full px-3 py-1 text-[11px]">Ukuran maksimal sesuai konfigurasi server</span>
          </label>
          <input id={inputId} type="file" multiple={tool.multiple} accept={tool.accept} disabled={!tool.available} className="sr-only" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} />
        </div>

        {files.length > 0 && (
          <section className="border-border bg-panel mt-5 rounded-xl border p-5 shadow-sm">
            <h2 className="font-bold">File dipilih ({files.length})</h2>
            <ul className="mt-3 space-y-2">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="bg-panel-soft flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{index + 1}. {file.name}</span>
                  {tool.multiple && (
                    <>
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Naikkan ${file.name}`} className="text-foreground rounded px-1 disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === files.length - 1} aria-label={`Turunkan ${file.name}`} className="text-foreground rounded px-1 disabled:opacity-30">↓</button>
                    </>
                  )}
                  <button type="button" onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))} aria-label={`Hapus ${file.name}`} className="text-danger text-xs font-semibold">Hapus</button>
                </li>
              ))}
            </ul>
            {tool.multiple && <p className="text-muted-foreground mt-3 text-xs">Urutan di atas menentukan urutan pemrosesan.</p>}
          </section>
        )}

        {(tool.fields ?? []).length > 0 && (
          <section className="border-border bg-panel mt-5 space-y-4 rounded-xl border p-5 shadow-sm">
            <h2 className="font-bold">Pengaturan</h2>
            {tool.fields?.map((field) => (
              <label key={field.name} className="block text-sm font-semibold">
                {field.label}{field.required && ' *'}
                {field.type === 'file' ? (
                  <input type="file" accept={field.accept} onChange={(event) => setExtra({ ...extra, [field.name]: event.target.files?.[0] || '' })} className="border-border bg-panel text-foreground mt-1 block w-full rounded-lg border p-2 text-sm font-normal" />
                ) : field.type === 'select' ? (
                  <select value={String(extra[field.name] ?? '')} onChange={(event) => setExtra({ ...extra, [field.name]: event.target.value })} className="border-border bg-panel text-foreground mt-1 block w-full rounded-lg border p-2 font-normal">
                    {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <input type="checkbox" checked={Boolean(extra[field.name])} onChange={(event) => setExtra({ ...extra, [field.name]: event.target.checked })} className="ml-2" />
                ) : field.type === 'textarea' ? (
                  <textarea value={String(extra[field.name] ?? '')} onChange={(event) => setExtra({ ...extra, [field.name]: event.target.value })} className="border-border bg-panel text-foreground mt-1 block min-h-28 w-full rounded-lg border p-2 font-normal" />
                ) : (
                  <input
                    type={field.type === 'number' || field.type === 'password' ? field.type : 'text'}
                    value={String(extra[field.name] ?? '')}
                    onChange={(event) => setExtra({ ...extra, [field.name]: event.target.value })}
                    className="border-border bg-panel text-foreground mt-1 block w-full rounded-lg border p-2 font-normal"
                  />
                )}
                {field.help && <span className="text-muted-foreground mt-1 block text-xs font-normal">{field.help}</span>}
              </label>
            ))}
          </section>
        )}

        {error && <p role="alert" className="panel-danger mt-4 rounded-lg p-3 text-sm">{error}</p>}

        <p role="status" className="sr-only">{busy ? 'Sedang memproses file.' : ''}</p>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !tool.available}
          aria-busy={busy}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 w-full rounded-lg px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Memproses…' : 'Mulai proses'}
        </button>

        {result && (
          <div className="panel-success mt-5 rounded-xl p-5">
            <p className="font-semibold">Pemrosesan selesai.</p>
            {result.text && <pre className="bg-panel text-foreground mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded p-3 text-xs">{result.text}</pre>}
            <a href={result.url} download={result.name} className="bg-success text-success-foreground mt-4 inline-block rounded-lg px-4 py-2 text-sm font-bold">Unduh {result.name}</a>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [filter, setFilter] = useState('all');
  const [routeId, setRouteId] = useState(routeIdFromHash);

  useEffect(() => {
    const syncRoute = () => setRouteId(routeIdFromHash());
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadCatalog = async () => {
      try {
        const response = await fetch(`${API}/api/tools`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Katalog tidak tersedia (HTTP ${response.status})`);
        const data = await response.json();
        setTools(Array.isArray(data) ? data : data.tools || []);
      } catch (error) {
        if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : 'Katalog tidak tersedia');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadCatalog();
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => {
    const seen = new Set(tools.map((tool) => tool.category).filter((category): category is string => Boolean(category)));
    return ['all', ...seen];
  }, [tools]);

  const selected = useMemo(() => (routeId ? tools.find((tool) => tool.id === routeId) : undefined), [routeId, tools]);

  if (routeId) {
    if (loading) {
      return <div role="status" className="bg-background text-muted-foreground flex min-h-screen items-center justify-center">Memuat alat…</div>;
    }
    if (selected) {
      return <ToolPage tool={selected} onHome={() => { window.location.hash = ''; }} />;
    }
    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <img src="/bprconvert-logo.png" alt="BPRCONVERT" className="h-10 w-auto" />
        <p className="text-foreground font-bold">Alat tidak ditemukan</p>
        <p className="text-muted-foreground text-sm">Alat “{routeId}” tidak ada di katalog backend.</p>
        <a href="#" className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-bold">Kembali ke semua alat</a>
      </div>
    );
  }

  const shown = filter === 'all' ? tools : tools.filter((tool) => tool.category === filter);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-border/80 bg-panel/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <img src="/bprconvert-logo.png" alt="BPRCONVERT" className="h-10 w-auto object-contain" />
          <a href="#tools" className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-bold shadow-sm hover:-translate-y-0.5 hover:shadow-md">Pilih alat</a>
        </div>
      </header>

      <section className="bg-panel relative overflow-hidden px-4 py-16 sm:py-24">
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-primary text-sm font-bold">Alat konverter file</p>
          <h1 className="text-foreground text-4xl font-black tracking-[-0.04em] sm:text-6xl">Kerjakan file. Selesai lebih cepat.</h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base leading-7 sm:text-lg">Pilih alat yang tepat, unggah file di halaman khusus, lalu unduh hasilnya dari satu alur yang jelas.</p>
          <a href="#tools" className="bg-primary text-primary-foreground mt-8 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-[var(--shadow-card)]">Lihat semua alat</a>
        </div>
        {!loading && !catalogError && tools.length > 0 && (
          <p className="text-muted-foreground relative mx-auto mt-10 max-w-3xl text-center text-sm">
            <span className="text-foreground font-bold">{tools.length} alat</span> di katalog, <span className="text-foreground font-bold">{tools.filter((tool) => tool.available).length} siap dipakai</span>.
          </p>
        )}
      </section>

      <main id="tools" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 className="text-foreground text-2xl font-black tracking-tight">Pilih alat yang Anda butuhkan</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => <button key={category} type="button" onClick={() => setFilter(category)} aria-pressed={filter === category} className={cn('rounded-lg px-3 py-2 text-xs font-bold', filter === category ? 'bg-foreground text-background' : 'bg-panel text-muted-foreground border-border hover:border-primary hover:text-primary border')}>{CATEGORY_LABELS[category] ?? category}</button>)}
          </div>
        </div>

        {loading && <p role="status" aria-live="polite" className="text-muted-foreground py-12 text-center">Memuat katalog…</p>}
        {catalogError && <div role="alert" className="panel-danger rounded-xl p-4 text-center text-sm">{catalogError}</div>}
        {!loading && !catalogError && shown.length === 0 && (
          <p className="text-muted-foreground py-12 text-center">Katalog backend masih kosong.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && [0, 1, 2].map((placeholder) => (
            <div key={placeholder} aria-hidden="true" className="bpr-skeleton border-border bg-panel-soft min-h-56 rounded-2xl border" />
          ))}
          {shown.map((tool) => (
            <a key={tool.id} href={`#tool/${encodeURIComponent(tool.id)}`} className="group border-border bg-panel hover:border-primary/50 flex min-h-56 flex-col justify-between rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
              <div>
                <div className="flex items-center justify-between">
                  <FileCard formatFile={iconFor(tool)} />
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', tool.available ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
                    {tool.available ? 'Siap' : 'Tidak tersedia'}
                  </span>
                </div>
                <h2 className="text-foreground group-hover:text-primary mt-4 text-base font-bold">{tool.title}</h2>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{tool.description}</p>
              </div>
              <span className="text-primary mt-4 text-xs font-bold">Buka alat</span>
            </a>
          ))}
        </div>
      </main>

      <footer className="border-border bg-panel text-muted-foreground mt-20 border-t py-10 text-center text-xs">
        <div className="mx-auto max-w-7xl space-y-2 px-4 sm:px-6">
          <p className="text-foreground font-semibold">© BPRCONVERT 2026 ®</p>
          <p>File dikirim ke backend yang Anda konfigurasi untuk diproses. Lihat README untuk detail deployment dan ketersediaan tiap tool.</p>
        </div>
      </footer>
    </div>
  );
}
