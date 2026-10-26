'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Files,
  Layers,
  Users,
  Settings,
  LogOut,
  Plus,
  Search,
  Download,
  Mail,
  Trash2,
  FileText,
  ArrowUpRight,
  Folder,
  UserCircle,
  Copy,
  Eye,
  Share2,
  Save,
  ChevronDown,
  ChevronRight,
  Pencil,
  SlidersHorizontal,
  Power,
  PowerOff,
} from 'lucide-react';
import { api, downloadExport, saveBlob } from '@/lib/client';
import { Modal } from './modal';
import { PdfPreview } from './pdf-preview';
import type { Field, Values, PageSize } from '@/lib/fields';
import { PdfEditor } from './pdf-editor';
type User = {
  id: string;
  username: string;
  role: 'ADMIN' | 'USER';
  email: string | null;
  createdAt?: string;
};
type Template = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  folderId: string | null;
  pageSizes: PageSize[];
  fields?: Field[];
};
type Doc = {
  id: string;
  templateId: string;
  username: string;
  createdAt: string;
  downloadedAt: string | null;
  emailedAt: string | null;
  emailedTo: string | null;
  values: Values;
  template: { name: string; color: string };
};
type Bootstrap = {
  user: User;
  templates: Template[];
  folders: { id: string; name: string }[];
  documents: Doc[];
};
type Section = 'documents' | 'templates' | 'users' | 'settings' | 'generate' | 'editor' | 'profile';
export function Workspace({ section, id }: { section: Section; id?: string }) {
  const [data, setData] = useState<Bootstrap | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const b = await api<Bootstrap>('bootstrap');
      setData(b);
    } catch (e) {
      if ((e as Error).message === 'Connexion requise.') location.assign('/login');
      else setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function run(task: () => Promise<unknown>, message = 'Enregistré.') {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await task();
      setNotice(message);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="mx-auto max-w-lg p-12">
        <h1>GED By DZ</h1>
        <p className="muted mt-4">Ouverture de votre espace…</p>
        {error && (
          <p className="error mt-5" role="alert">
            {error}
          </p>
        )}
        <Link href="/login" className="mt-5 inline-block underline">
          Page de connexion
        </Link>
      </main>
    );
  const admin = data.user.role === 'ADMIN';
  const names = {
    documents: 'Documents',
    templates: 'Modèles',
    users: 'Utilisateurs',
    settings: 'Paramètres',
    generate: 'Nouveau document',
    editor: 'Éditeur de modèle',
    profile: 'Mon compte',
  };
  const nav = [
    { href: '/documents', icon: Files, title: 'Documents', key: 'documents' },
    { href: '/templates', icon: Layers, title: 'Modèles', key: 'templates' },
    ...(admin
      ? [
          { href: '/users', icon: Users, title: 'Utilisateurs', key: 'users' },
          { href: '/settings', icon: Settings, title: 'Paramètres', key: 'settings' },
        ]
      : []),
  ].filter((entry) => admin || entry.key !== 'templates');
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col">
        <Link href="/documents" className="flex items-center gap-3 px-6 py-7">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-800 text-white">
            <Files size={23} />
          </span>
          <span>
            <strong className="block text-base tracking-tight">GED By DZ</strong>
            <span className="text-[11px] text-slate-500">L’espace de vos documents</span>
          </span>
        </Link>
        <p className="hidden px-6 pb-3 pt-5 text-[10px] font-bold tracking-[.18em] text-slate-400 lg:block">
          VOTRE ESPACE
        </p>
        <nav className="flex gap-1 overflow-auto px-3 pb-3 lg:flex-col">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold ${section === n.key || (section === 'editor' && n.key === 'templates') ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <n.icon size={18} />
              {n.title}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-slate-100 p-5 lg:block">
          <Link href="/profile" className="mb-4 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-slate-100 font-bold">
              {data.user.username[0].toUpperCase()}
            </span>
            <span>
              <strong className="block text-xs">{data.user.username}</strong>
              <span className="text-[11px] text-slate-500">
                {admin ? 'Administrateur' : 'Utilisateur'}
              </span>
            </span>
          </Link>
          <button
            className="secondary w-full !justify-start !text-xs"
            onClick={() =>
              run(async () => {
                await api('auth/logout', 'POST');
                location.assign('/login');
              })
            }
          >
            <LogOut size={15} />
            Se déconnecter
          </button>
        </div>
      </aside>
      <header className="flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/75 px-6 lg:px-10">
        <span className="text-sm text-slate-400">
          Votre espace <span className="px-3">/</span>
          <span className="font-medium text-slate-700">{names[section]}</span>
        </span>
        <Link className="flex items-center gap-2 text-xs text-slate-600" href="/profile">
          <UserCircle size={19} />
          {data.user.username}
        </Link>
      </header>
      <main
        className={`mx-auto p-5 lg:p-9 ${section === 'editor' ? 'max-w-[1800px]' : 'max-w-[1400px]'}`}
      >
        {error && (
          <div className="error mb-5 flex justify-between" role="alert">
            {error}
            <button
              className="!bg-transparent !p-0 !text-inherit"
              onClick={() => setError('')}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        )}
        {notice && (
          <div className="notice mb-5" role="status">
            {notice}
          </div>
        )}
        {!admin && ['editor', 'templates', 'users', 'settings'].includes(section) ? (
          <div className="card">
            <h1>Accès réservé aux administrateurs</h1>
          </div>
        ) : (
          <>
            {section === 'documents' && <Documents data={data} run={run} busy={busy} />}
            {section === 'templates' && <Templates data={data} run={run} busy={busy} />}
            {section === 'editor' && id && <PdfEditor id={id} onError={setError} />}
            {section === 'generate' && id && (
              <Generate
                id={id}
                duplicate={
                  typeof window !== 'undefined'
                    ? new URLSearchParams(location.search).get('dup')
                    : null
                }
                run={run}
                busy={busy}
              />
            )}
            {section === 'users' && <UserManagement run={run} busy={busy} current={data.user.id} />}
            {section === 'settings' && <SettingsPanel run={run} busy={busy} />}
            {section === 'profile' && (
              <div className="card mx-auto max-w-lg">
                <h1>Mon compte</h1>
                <p className="muted mt-2">
                  {data.user.username} · {admin ? 'Administrateur' : 'Utilisateur'}
                </p>
                <form
                  className="mt-7 grid gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    run(async () => {
                      if (f.get('password') !== f.get('confirm'))
                        throw new Error('Les mots de passe ne correspondent pas.');
                      await api('profile/password', 'POST', {
                        current: f.get('current'),
                        password: f.get('password'),
                      });
                      location.assign('/login');
                    });
                  }}
                >
                  <label>
                    Mot de passe actuel
                    <input
                      name="current"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </label>
                  <label>
                    Nouveau mot de passe
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      maxLength={200}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    Confirmer
                    <input name="confirm" type="password" required autoComplete="new-password" />
                  </label>
                  <button disabled={busy}>Changer le mot de passe</button>
                </form>
                <button
                  className="secondary mt-5 w-full"
                  onClick={() =>
                    run(async () => {
                      await api('auth/logout', 'POST');
                      location.assign('/login');
                    })
                  }
                >
                  Se déconnecter
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
type Run = (task: () => Promise<unknown>, message?: string) => Promise<void>;
function formInputValue(field: Field, value: string | number[] | undefined) {
  const raw = String(value ?? field.default ?? '');
  if (field.type !== 'date') return raw;
  if (!raw || raw === 'auto') {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return /^\d{2}\/\d{2}\/\d{4}$/.test(raw) ? raw.split('/').reverse().join('-') : raw;
}
function Documents({ data, run, busy }: { data: Bootstrap; run: Run; busy: boolean }) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [email, setEmail] = useState(''),
    [choose, setChoose] = useState(false),
    [viewing, setViewing] = useState<Doc | null>(null),
    [sharing, setSharing] = useState<Doc | null>(null);
  const docs = data.documents.filter(
    (d) =>
      (!filter || d.templateId === filter) &&
      `${d.template.name} ${d.username} ${Object.values(d.values).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = data.templates.filter((t) => t.active);
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1>Vos documents</h1>
          <p className="muted mt-1">
            Préparez, retrouvez et partagez vos documents au même endroit.
          </p>
        </div>
        <button onClick={() => setChoose(!choose)}>
          <Plus size={17} />
          Nouveau document
        </button>
      </div>
      {choose && (
        <Modal title="Nouveau document" onClose={() => setChoose(false)}>
          <TemplatePicker templates={active} folders={data.folders} />
        </Modal>
      )}
      {viewing && (
        <Modal title={viewing.template.name} wide onClose={() => setViewing(null)}>
          <DocumentView id={viewing.id} />
        </Modal>
      )}
      {sharing && (
        <Modal title="Partager le document" onClose={() => setSharing(null)}>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const to = new FormData(e.currentTarget).get('email');
              run(async () => {
                await api('documents/export', 'POST', { ids: [sharing.id], email: to });
                setSharing(null);
              }, 'Document envoyé.');
            }}
          >
            <p className="muted text-xs">
              {sharing.template.name} sera envoyé en pièce jointe PDF à l’adresse indiquée.
            </p>
            <label>
              Adresse e-mail du destinataire
              <input
                name="email"
                type="email"
                required
                autoFocus
                placeholder="destinataire@exemple.fr"
              />
            </label>
            <button disabled={busy}>
              <Mail size={16} />
              Envoyer
            </button>
          </form>
        </Modal>
      )}
      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Documents enregistrés', value: data.documents.length, icon: Files },
          { label: 'Modèles disponibles', value: active.length, icon: Layers },
          {
            label: 'Documents envoyés',
            value: data.documents.filter((d) => d.emailedAt).length,
            icon: Mail,
          },
        ].map((c) => (
          <div className="card flex items-center gap-4 !p-5" key={c.label}>
            <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <c.icon size={21} />
            </span>
            <div>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="muted mt-1 text-xs">{c.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="card !p-0">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-5">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={17} />
            <input
              className="!pl-10"
              placeholder="Rechercher un document…"
              aria-label="Rechercher un document"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="!w-auto"
            aria-label="Filtrer par modèle"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Tous les modèles</option>
            {data.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-emerald-50 px-5 py-3">
            <span className="text-xs font-semibold">{selected.length} sélectionné(s)</span>
            <button
              disabled={busy}
              className="!py-2 !text-xs"
              onClick={() => run(() => downloadExport(selected), 'Archive téléchargée.')}
            >
              <Download size={14} />
              ZIP
            </button>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => api('documents/export', 'POST', { ids: selected, email }),
                  'Documents envoyés.',
                );
              }}
            >
              <input
                aria-label="Destinataire"
                placeholder="destinataire@exemple.fr"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="!w-56 !py-2"
              />
              <button className="!py-2 !text-xs" disabled={busy}>
                <Mail size={14} />
                Envoyer
              </button>
            </form>
          </div>
        )}
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Sélectionner les documents affichés"
                    checked={docs.length > 0 && docs.every((d) => selected.includes(d.id))}
                    onChange={(e) => setSelected(e.target.checked ? docs.map((d) => d.id) : [])}
                  />
                </th>
                <th>Document</th>
                <th>Données</th>
                <th>Créé par</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <input
                      aria-label={`Sélectionner ${d.template.name}`}
                      type="checkbox"
                      checked={selected.includes(d.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, d.id]
                            : selected.filter((id) => id !== d.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <span className="flex items-center gap-3 font-semibold">
                      <span className="rounded-lg bg-slate-50 p-2">
                        <FileText style={{ color: d.template.color }} size={20} />
                      </span>
                      {d.template.name}
                    </span>
                  </td>
                  <td className="max-w-64">
                    <p
                      className="truncate text-xs text-slate-600"
                      title={Object.values(d.values)
                        .filter((v) => typeof v === 'string')
                        .join(' · ')}
                    >
                      {Object.values(d.values)
                        .filter((v) => typeof v === 'string' && v)
                        .slice(0, 3)
                        .join(' · ') || '—'}
                    </p>
                  </td>
                  <td className="muted text-xs">{d.username}</td>
                  <td className="muted whitespace-nowrap text-xs">
                    {new Date(d.createdAt).toLocaleString('fr-FR')}
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${d.emailedAt ? 'bg-emerald-50 text-emerald-700' : d.downloadedAt ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}
                      title={d.emailedTo ?? ''}
                    >
                      {d.emailedAt ? 'Envoyé' : d.downloadedAt ? 'Téléchargé' : 'Enregistré'}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Voir', icon: Eye, onClick: () => setViewing(d) },
                        { label: 'Partager', icon: Share2, onClick: () => setSharing(d) },
                      ].map((x) => (
                        <button
                          key={x.label}
                          className="secondary !gap-1.5 !px-2.5 !py-1.5 !text-xs"
                          onClick={x.onClick}
                        >
                          <x.icon size={15} />
                          {x.label}
                        </button>
                      ))}
                      <a
                        href={`/api/documents/${d.id}/pdf`}
                        className="button secondary !gap-1.5 !px-2.5 !py-1.5 !text-xs"
                      >
                        <Download size={15} />
                        Télécharger
                      </a>
                      <Link
                        href={`/generate/${d.templateId}?dup=${d.id}`}
                        className="button secondary !gap-1.5 !px-2.5 !py-1.5 !text-xs"
                      >
                        <Copy size={15} />
                        Dupliquer
                      </Link>
                      <button
                        className="danger !gap-1.5 !px-2.5 !py-1.5 !text-xs"
                        onClick={() => {
                          if (confirm('Supprimer ce document ?'))
                            run(async () => {
                              await api(`documents/${d.id}`, 'DELETE');
                              setSelected(selected.filter((id) => id !== d.id));
                            }, 'Document supprimé.');
                        }}
                      >
                        <Trash2 size={15} />
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!docs.length && (
            <div className="py-20 text-center">
              <Files size={40} className="mx-auto text-slate-300" />
              <h2 className="mt-5">
                {search ? 'Aucun résultat' : 'Votre prochain document commence ici'}
              </h2>
              <p className="muted mt-2">
                Choisissez un modèle et remplissez votre premier formulaire.
              </p>
              <button className="mt-5" onClick={() => setChoose(true)}>
                <Plus size={16} />
                Créer un document
              </button>
            </div>
          )}
        </div>
        <p className="muted px-5 py-4 text-xs">
          {docs.length} document(s) affiché(s) · Jusqu’à 500 documents récents
        </p>
      </div>
    </>
  );
}
function DocumentView({ id }: { id: string }) {
  const source = useCallback(async () => {
    const r = await fetch(`/api/documents/${id}/view`);
    if (!r.ok) throw new Error((await r.json()).error ?? 'Document indisponible.');
    return r.arrayBuffer();
  }, [id]);
  return (
    <div className="mx-auto max-w-2xl">
      <PdfPreview source={source} />
    </div>
  );
}
function TemplatePicker({
  templates,
  folders,
}: {
  templates: Template[];
  folders: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState<string[]>([]),
    [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const groups = [...folders, { id: 'none', name: 'Sans dossier' }]
    .map((f) => ({
      ...f,
      items: templates.filter(
        (t) =>
          (f.id === 'none' ? !t.folderId : t.folderId === f.id) &&
          t.name.toLowerCase().includes(query),
      ),
    }))
    .filter((g) => g.items.length);
  return (
    <div className="grid gap-3">
      <input
        aria-label="Rechercher un modèle"
        placeholder="Rechercher un modèle…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {groups.map((g) => {
        const expanded = !!query || open.includes(g.id);
        return (
          <section key={g.id} className="rounded-xl border border-slate-200">
            <button
              type="button"
              aria-expanded={expanded}
              className="secondary w-full !justify-start !rounded-xl"
              onClick={() => setOpen(expanded ? open.filter((o) => o !== g.id) : [...open, g.id])}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Folder size={16} />
              {g.name}
              <span className="ml-auto text-xs opacity-60">{g.items.length}</span>
            </button>
            {expanded && (
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {g.items.map((t) => (
                  <Link
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:border-emerald-500"
                    href={`/generate/${t.id}`}
                    key={t.id}
                  >
                    <span className="flex items-center gap-3">
                      <FileText style={{ color: t.color }} size={20} />
                      {t.name}
                    </span>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {!groups.length && (
        <p className="muted">
          {query
            ? 'Aucun modèle ne correspond.'
            : 'Aucun modèle actif. Un administrateur doit préparer et activer un modèle.'}
        </p>
      )}
    </div>
  );
}
function Templates({ data, run, busy }: { data: Bootstrap; run: Run; busy: boolean }) {
  const [upload, setUpload] = useState(false),
    [search, setSearch] = useState(''),
    [dragId, setDragId] = useState<string | null>(null),
    [over, setOver] = useState<string | null>(null),
    [collapsed, setCollapsed] = useState<string[]>([]);
  const groups = [...data.folders, { id: 'none', name: 'Sans dossier' }]
    .map((g) => ({
      ...g,
      items: data.templates.filter(
        (t) =>
          (g.id === 'none' ? !t.folderId : t.folderId === g.id) &&
          t.name.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((g) => !search || g.items.length);
  function move(templateId: string, target: string) {
    const t = data.templates.find((x) => x.id === templateId);
    setDragId(null);
    setOver(null);
    if (!t || (t.folderId ?? 'none') === target) return;
    run(
      () => api(`templates/${t.id}`, 'PATCH', { folderId: target === 'none' ? null : target }),
      'Modèle déplacé.',
    );
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Vos modèles</h1>
          <p className="muted mt-1">Un PDF, des champs, un formulaire prêt pour votre équipe.</p>
        </div>
        <button onClick={() => setUpload(!upload)}>
          <Plus size={17} />
          Importer un PDF
        </button>
      </div>
      {upload && (
        <form
          className="card mb-5 grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            run(async () => {
              await api('templates', 'POST', f);
              form.reset();
              setUpload(false);
            }, 'PDF importé. Ouvrez l’éditeur pour placer les champs.');
          }}
        >
          <label>
            Nom du modèle
            <input name="name" required maxLength={120} />
          </label>
          <label>
            Fichier PDF (10 Mo maximum)
            <input name="file" type="file" accept=".pdf,application/pdf" required />
          </label>
          <label>
            Dossier
            <select name="folderId">
              <option value="">Sans dossier</option>
              {data.folders.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Couleur
            <input type="color" name="color" defaultValue="#087e70" />
          </label>
          <p className="muted text-xs">
            Les dimensions et les pages de votre PDF sont conservées. Les PDF protégés doivent être
            exportés sans mot de passe.
          </p>
          <button disabled={busy}>Importer le modèle</button>
        </form>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className="md:!w-80"
          aria-label="Rechercher un modèle"
          placeholder="Rechercher un modèle…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="muted text-xs">Glissez un modèle sur un dossier pour le déplacer.</p>
      </div>
      <div className="grid gap-4">
        {groups.map((g) => {
          const open = !collapsed.includes(g.id);
          return (
            <section
              key={g.id}
              aria-label={`Dossier ${g.name}`}
              className={`rounded-2xl border bg-white p-3 transition-colors ${over === g.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOver(g.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                move(e.dataTransfer.getData('text/plain') || dragId || '', g.id);
              }}
            >
              <button
                type="button"
                aria-expanded={open}
                className="secondary w-full !justify-start !bg-transparent !px-2 !py-1.5"
                onClick={() =>
                  setCollapsed(open ? [...collapsed, g.id] : collapsed.filter((c) => c !== g.id))
                }
              >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Folder size={17} />
                {g.name}
                <span className="ml-1 text-xs font-normal opacity-60">{g.items.length}</span>
              </button>
              {open && (
                <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
                  {g.items.map((t) => (
                    <TemplateTile
                      key={t.id}
                      t={t}
                      run={run}
                      busy={busy}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                    />
                  ))}
                  {!g.items.length && (
                    <p className="muted col-span-full px-2 py-4 text-xs">
                      Dossier vide. Déposez un modèle ici.
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {!data.templates.length && (
        <div className="card mt-5 py-16 text-center">
          <Layers size={40} className="mx-auto text-slate-300" />
          <h2 className="mt-4">Aucun modèle dans cet espace</h2>
          <p className="muted mt-2">Importez un PDF pour créer votre premier formulaire.</p>
        </div>
      )}
      <details className="card mt-7">
        <summary className="cursor-pointer font-bold">
          <Folder size={17} className="mr-2 inline" />
          Gérer les dossiers
        </summary>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.folders.map((f) => (
            <form
              key={f.id}
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  api(`folders/${f.id}`, 'PATCH', {
                    name: new FormData(e.currentTarget).get('name'),
                  }),
                );
              }}
            >
              <input
                name="name"
                defaultValue={f.name}
                aria-label="Nom du dossier"
                required
                maxLength={80}
              />
              <button className="secondary !text-xs">Renommer</button>
              <button
                type="button"
                className="secondary !p-2"
                aria-label="Supprimer le dossier"
                onClick={() => {
                  if (confirm('Supprimer le dossier et conserver ses modèles ?'))
                    run(() => api(`folders/${f.id}`, 'DELETE'));
                }}
              >
                <Trash2 size={15} />
              </button>
            </form>
          ))}
        </div>
        <form
          className="mt-5 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const name = new FormData(f).get('name');
            run(async () => {
              await api('folders', 'POST', { name });
              f.reset();
            }, 'Dossier créé.');
          }}
        >
          <input
            name="name"
            placeholder="Nouveau dossier"
            aria-label="Nouveau dossier"
            maxLength={80}
            required
          />
          <button disabled={busy}>Créer</button>
        </form>
      </details>
    </>
  );
}
function TemplateTile({
  t,
  run,
  busy,
  onDragStart,
  onDragEnd,
}: {
  t: Template;
  run: Run;
  busy: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const iconButton = 'secondary !p-1.5';
  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`flex cursor-grab flex-col items-center gap-1 rounded-xl border border-slate-200 p-3 text-center hover:border-emerald-400 hover:bg-emerald-50/40 ${t.active ? '' : 'bg-slate-50'}`}
    >
      <FileText size={38} style={{ color: t.color }} className={t.active ? '' : 'opacity-50'} />
      {renaming ? (
        <input
          aria-label="Nom du modèle"
          autoFocus
          defaultValue={t.name}
          maxLength={120}
          className="!px-1 !py-1 text-center !text-xs"
          onBlur={(e) => {
            setRenaming(false);
            const name = e.target.value.trim();
            if (name && name !== t.name) run(() => api(`templates/${t.id}`, 'PATCH', { name }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.currentTarget.value = t.name;
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <span className="line-clamp-2 w-full break-words text-xs font-semibold" title={t.name}>
          {t.name}
        </span>
      )}
      <span className="muted text-[10px]">
        {t.pageSizes.length} p. · {t.active ? 'Actif' : 'Brouillon'}
      </span>
      <div className="mt-1 flex gap-1">
        <Link
          className={`button ${iconButton}`}
          href={`/templates/${t.id}`}
          aria-label="Définir les champs"
          title="Définir les champs"
        >
          <SlidersHorizontal size={14} />
        </Link>
        <button
          className={iconButton}
          aria-label="Renommer"
          title="Renommer"
          onClick={() => setRenaming(true)}
        >
          <Pencil size={14} />
        </button>
        <button
          className={iconButton}
          disabled={busy}
          aria-label={t.active ? 'Désactiver' : 'Activer'}
          title={t.active ? 'Désactiver' : 'Activer'}
          onClick={() => run(() => api(`templates/${t.id}`, 'PATCH', { active: !t.active }))}
        >
          {t.active ? <PowerOff size={14} /> : <Power size={14} />}
        </button>
        <button
          className={iconButton}
          aria-label="Supprimer le modèle"
          title="Supprimer le modèle"
          onClick={() => {
            if (confirm('Supprimer ce modèle ? Les documents existants seront conservés.'))
              run(() => api(`templates/${t.id}`, 'DELETE'), 'Modèle supprimé.');
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
function Generate({
  id,
  duplicate,
  run,
  busy,
}: {
  id: string;
  duplicate: string | null;
  run: Run;
  busy: boolean;
}) {
  const router = useRouter(),
    [template, setTemplate] = useState<Template | null>(null),
    [rows, setRows] = useState<Values[]>([{}]),
    [activeRow, setActiveRow] = useState(0),
    [previewValues, setPreviewValues] = useState<Values>({});
  useEffect(() => {
    const timer = setTimeout(
      () => setPreviewValues(rows[Math.min(activeRow, rows.length - 1)] ?? {}),
      350,
    );
    return () => clearTimeout(timer);
  }, [rows, activeRow]);
  const previewSource = useCallback(async () => {
    const r = await fetch(`/api/templates/${id}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: previewValues }),
    });
    if (!r.ok) throw new Error((await r.json()).error ?? 'Aperçu indisponible.');
    return r.arrayBuffer();
  }, [id, previewValues]);
  useEffect(() => {
    run(async () => {
      const t = await api<Template>(`templates/${id}`);
      setTemplate(t);
      const values = duplicate ? (await api<Doc>(`documents/${duplicate}`)).values : {};
      setRows([values]);
    }, '');
  }, [id, duplicate]);
  if (!template) return <p>Chargement du formulaire…</p>;
  const fields = (template.fields ?? []).filter(
    (f, i, all) => all.findIndex((o) => o.key === f.key) === i,
  );
  function update(row: number, key: string, value: string | number[]) {
    setRows((old) => old.map((r, i) => (i === row ? { ...r, [key]: value } : r)));
  }
  return (
    <>
      <div className="mb-7">
        <Link href="/documents" className="muted text-xs">
          ← Documents
        </Link>
        <h1 className="mt-3">{template.name}</h1>
        <p className="muted mt-1">
          Remplissez les champs. Votre document conservera sa mise en page et son format.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const download =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'download';
            run(async () => {
              const docs = await api<Doc[]>('documents', 'POST', { templateId: id, rows });
              if (download) {
                if (docs.length === 1) {
                  const r = await fetch(`/api/documents/${docs[0].id}/pdf`);
                  if (!r.ok)
                    throw new Error((await r.json()).error ?? 'Téléchargement impossible.');
                  saveBlob(await r.blob(), `${template!.name}.pdf`);
                } else await downloadExport(docs.map((d) => d.id));
              }
              router.push('/documents');
            }, 'Document(s) enregistré(s).');
          }}
        >
          {rows.map((row, ri) => (
            <section
              className={`card mb-5 ${rows.length > 1 && ri === activeRow ? 'ring-2 ring-emerald-500' : ''}`}
              key={ri}
              onFocusCapture={() => setActiveRow(ri)}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2>Document {ri + 1}</h2>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="secondary !p-2"
                    aria-label="Retirer ce document"
                    onClick={() => setRows(rows.filter((_, i) => i !== ri))}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {fields.map((f) => (
                  <div
                    key={f.key}
                    className={
                      f.type === 'textarea' || f.type === 'checkbox' ? 'sm:col-span-2' : ''
                    }
                  >
                    {f.type === 'checkbox' ? (
                      <fieldset>
                        <legend className="mb-2 text-sm font-semibold">
                          {f.label}
                          {f.required ? ' *' : ''}
                        </legend>
                        <div className="flex flex-wrap gap-4">
                          {f.options.map((o, i) => (
                            <label className="!flex items-center gap-2" key={i}>
                              <input
                                type="checkbox"
                                checked={
                                  Array.isArray(row[f.key]) && (row[f.key] as number[]).includes(i)
                                }
                                onChange={(e) => {
                                  const selected = Array.isArray(row[f.key])
                                    ? (row[f.key] as number[])
                                    : [];
                                  update(
                                    ri,
                                    f.key,
                                    e.target.checked
                                      ? [...selected, i]
                                      : selected.filter((n) => n !== i),
                                  );
                                }}
                              />
                              {typeof o === 'string' ? o : o.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ) : (
                      <label>
                        {f.label}
                        {f.required ? ' *' : ''}
                        {f.type === 'textarea' ? (
                          <textarea
                            rows={4}
                            maxLength={f.max_chars || 5000}
                            required={f.required}
                            value={String(row[f.key] ?? f.default ?? '')}
                            onChange={(e) => update(ri, f.key, e.target.value)}
                          />
                        ) : f.type === 'select' || f.type === 'rating' ? (
                          <select
                            required={f.required}
                            value={String(row[f.key] ?? f.default ?? '')}
                            onChange={(e) => update(ri, f.key, e.target.value)}
                          >
                            <option value="">Choisir…</option>
                            {(f.type === 'rating'
                              ? ['1', '2', '3', '4', '5']
                              : f.options.filter((o) => typeof o === 'string')
                            ).map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={
                              f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'
                            }
                            step={f.type === 'number' ? 'any' : undefined}
                            required={f.required}
                            maxLength={f.max_chars || 5000}
                            value={formInputValue(f, row[f.key])}
                            onChange={(e) => update(ri, f.key, e.target.value)}
                          />
                        )}
                      </label>
                    )}
                  </div>
                ))}
                {!fields.length && (
                  <p className="muted">
                    Ce modèle ne contient aucun champ. Vous pouvez générer une copie du document.
                  </p>
                )}
              </div>
            </section>
          ))}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="secondary"
              disabled={rows.length >= 100}
              onClick={() => setRows([...rows, {}])}
            >
              <Plus size={16} />
              Ajouter un document
            </button>
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} value="save">
                <Save size={17} />
                Générer
              </button>
              <button disabled={busy} value="download">
                <Download size={17} />
                Générer et télécharger
              </button>
            </div>
          </div>
        </form>
        <aside className="card xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
          <h2 className="mb-1">Aperçu en direct</h2>
          <p className="muted mb-4 text-xs">
            {rows.length > 1 ? `Document ${Math.min(activeRow, rows.length - 1) + 1} · ` : ''}
            Le document se met à jour pendant la saisie.
          </p>
          <PdfPreview source={previewSource} />
        </aside>
      </div>
    </>
  );
}
function UserManagement({ run, busy, current }: { run: Run; busy: boolean; current: string }) {
  const [users, setUsers] = useState<User[]>([]),
    [create, setCreate] = useState(false);
  async function load() {
    setUsers(await api<User[]>('users'));
  }
  useEffect(() => {
    run(load, '');
  }, []);
  return (
    <>
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1>Utilisateurs</h1>
          <p className="muted mt-1">Les bons accès pour chaque membre de votre équipe.</p>
        </div>
        <button onClick={() => setCreate(!create)}>
          <Plus size={16} />
          Ajouter
        </button>
      </div>
      {create && (
        <form
          className="card mb-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              b = Object.fromEntries(new FormData(form));
            run(async () => {
              await api('users', 'POST', b);
              await load();
              setCreate(false);
            }, 'Utilisateur créé.');
          }}
        >
          <label>
            Identifiant
            <input name="username" pattern="[A-Za-z0-9._-]{3,32}" required />
          </label>
          <label>
            Adresse e-mail
            <input type="email" name="email" />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              name="password"
              minLength={8}
              maxLength={200}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            Rôle
            <select name="role">
              <option value="USER">Utilisateur</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </label>
          <button disabled={busy}>Créer le compte</button>
        </form>
      )}
      <div className="grid gap-4">
        {users.map((u) => (
          <form
            className="card grid items-end gap-4 md:grid-cols-[1fr_1fr_1fr_auto]"
            key={u.id}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                await api(`users/${u.id}`, 'PATCH', {
                  email: f.get('email'),
                  password: f.get('password') || undefined,
                });
                if (u.id === current && f.get('password')) {
                  location.assign('/login');
                  return;
                }
                await load();
              }, 'Compte mis à jour.');
            }}
          >
            <div>
              <h2>
                {u.username} {u.id === current && <span className="muted text-xs">(vous)</span>}
              </h2>
              <p className="muted mt-2 text-xs">
                {u.role === 'ADMIN' ? 'Administrateur' : 'Utilisateur'}
              </p>
            </div>
            <label>
              E-mail de récupération
              <input type="email" name="email" defaultValue={u.email ?? ''} />
            </label>
            <label>
              Nouveau mot de passe
              <input
                type="password"
                name="password"
                minLength={8}
                maxLength={200}
                placeholder="Inchangé"
                autoComplete="new-password"
              />
            </label>
            <div className="flex gap-2">
              <button disabled={busy} className="!text-xs">
                Enregistrer
              </button>
              {u.id !== current && (
                <button
                  className="secondary !p-2"
                  aria-label="Supprimer le compte"
                  type="button"
                  onClick={() => {
                    if (confirm(`Supprimer le compte ${u.username} ?`))
                      run(async () => {
                        await api(`users/${u.id}`, 'DELETE');
                        await load();
                      }, 'Compte supprimé.');
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </form>
        ))}
      </div>
    </>
  );
}
function SettingsPanel({ run, busy }: { run: Run; busy: boolean }) {
  const [settings, setSettings] = useState<Record<string, string | number | boolean> | null>(null);
  useEffect(() => {
    run(async () => setSettings(await api('settings')), '');
  }, []);
  if (!settings) return <p>Chargement des paramètres…</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <h1>Paramètres</h1>
      <p className="muted mb-7 mt-1">
        Configurez l’envoi des documents et les e-mails de récupération.
      </p>
      <form
        className="card grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          run(
            () =>
              api('settings', 'PATCH', { ...f, smtp_port: Number(f.smtp_port), smtp_timeout: 20 }),
            'Configuration enregistrée.',
          );
        }}
      >
        <h2 className="sm:col-span-2">Envoi par e-mail</h2>
        {[
          { key: 'from_name', label: 'Nom de l’expéditeur', type: 'text' },
          { key: 'from_email', label: 'Adresse d’expédition', type: 'email' },
          { key: 'smtp_host', label: 'Serveur SMTP', type: 'text' },
          { key: 'smtp_port', label: 'Port', type: 'number' },
          { key: 'smtp_user', label: 'Identifiant SMTP', type: 'text' },
          { key: 'smtp_pass', label: 'Mot de passe SMTP', type: 'password' },
        ].map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              name={f.key}
              type={f.type}
              defaultValue={f.key === 'smtp_pass' ? '' : String(settings[f.key] ?? '')}
              placeholder={
                f.key === 'smtp_pass' && settings.hasPassword
                  ? 'Déjà enregistré — laisser vide pour conserver'
                  : ''
              }
              autoComplete={f.type === 'password' ? 'new-password' : 'off'}
            />
          </label>
        ))}
        <label>
          Chiffrement
          <select name="smtp_secure" defaultValue={String(settings.smtp_secure)}>
            <option value="tls">STARTTLS</option>
            <option value="ssl">TLS implicite</option>
            <option value="none">Aucun (relais local)</option>
          </select>
        </label>
        <div className="flex items-end">
          <button disabled={busy}>Enregistrer</button>
        </div>
        <p className="muted text-xs sm:col-span-2">
          Le mot de passe SMTP est chiffré côté serveur et n’est jamais renvoyé au navigateur.
        </p>
      </form>
      <form
        className="card mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const email = new FormData(e.currentTarget).get('email');
          run(() => api('settings/test', 'POST', { email }), 'E-mail de test envoyé.');
        }}
      >
        <label className="flex-1">
          Destinataire du test
          <input name="email" type="email" required />
        </label>
        <button disabled={busy}>Envoyer un test</button>
      </form>
    </div>
  );
}
