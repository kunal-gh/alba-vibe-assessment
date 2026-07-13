'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FolderKanban, ImagePlus, LoaderCircle, LogOut, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  created_at: string;
};

type Asset = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  image_url: string;
  tags: string[];
  featured: boolean;
  captured_at: string | null;
  created_at: string;
};

const colors = ['#c7ff45', '#9ab7ff', '#ffad8a', '#e5a8ff', '#62e6c4'];

const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function StudioDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [assetForm, setAssetForm] = useState({ title: '', projectId: '', imageUrl: '', description: '', tags: '' });

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white grid place-items-center p-5">
        <section className="max-w-lg rounded-3xl border border-amber-300/20 bg-amber-300/10 p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-200">Configuration needed</p>
          <h1 className="mt-3 text-3xl font-semibold">Connect Supabase to open StudioFlow.</h1>
          <p className="mt-3 text-sm leading-6 text-amber-50/70">Copy <code>.env.example</code> to <code>.env.local</code>, add the project URL and publishable key, then run <code>node scripts/seed-studioflow.mjs</code> to provision a demo account.</p>
        </section>
      </main>
    );
  }

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  };

  const loadWorkspace = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace('/studio/login');
      return;
    }

    const [projectResult, assetResult] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('assets').select('*').order('created_at', { ascending: false }),
    ]);

    if (projectResult.error || assetResult.error) {
      showNotice(projectResult.error?.message ?? assetResult.error?.message ?? 'Could not load the workspace.');
    } else {
      const nextProjects = (projectResult.data ?? []) as Project[];
      setProjects(nextProjects);
      setAssets((assetResult.data ?? []) as Asset[]);
      setAssetForm((current) => ({ ...current, projectId: current.projectId || nextProjects[0]?.id || '' }));
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const channel = supabase
      .channel('studioflow-live-workspace')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, loadWorkspace)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, loadWorkspace)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadWorkspace]);

  const filteredAssets = activeProjectId === 'all' ? assets : assets.filter((asset) => asset.project_id === activeProjectId);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const assetsByProject = projects.map((project) => ({ name: project.name, assets: assets.filter((asset) => asset.project_id === project.id).length, fill: project.color }));
  const uploadsByDay = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - offset));
    const key = day.toISOString().slice(0, 10);
    return { day: day.toLocaleDateString(undefined, { weekday: 'short' }), uploads: assets.filter((asset) => asset.created_at.slice(0, 10) === key).length };
  });

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return router.replace('/studio/login');

    const temporaryId = `optimistic-${Date.now()}`;
    const optimistic: Project = { id: temporaryId, name, slug: slugify(name), description: projectDescription.trim() || null, color: colors[projects.length % colors.length], created_at: new Date().toISOString() };
    setProjects((current) => [optimistic, ...current]);
    setProjectName('');
    setProjectDescription('');

    const { data, error } = await supabase.from('projects').insert({ user_id: userData.user.id, name, slug: optimistic.slug, description: optimistic.description, color: optimistic.color }).select().single();
    if (error) {
      setProjects((current) => current.filter((project) => project.id !== temporaryId));
      showNotice(error.message);
    } else {
      setProjects((current) => current.map((project) => project.id === temporaryId ? data as Project : project));
      setAssetForm((current) => ({ ...current, projectId: current.projectId || data.id }));
    }
  };

  const createAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = assetForm.title.trim();
    if (!title || !assetForm.projectId || !assetForm.imageUrl.trim()) return showNotice('Add a title, project, and image URL.');
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return router.replace('/studio/login');

    const temporaryId = `optimistic-${Date.now()}`;
    const optimistic: Asset = { id: temporaryId, project_id: assetForm.projectId, title, description: assetForm.description.trim() || null, image_url: assetForm.imageUrl.trim(), tags: assetForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean), featured: false, captured_at: null, created_at: new Date().toISOString() };
    setAssets((current) => [optimistic, ...current]);
    setAssetForm((current) => ({ ...current, title: '', imageUrl: '', description: '', tags: '' }));

    const { data, error } = await supabase.from('assets').insert({ ...optimistic, id: undefined, user_id: userData.user.id }).select().single();
    if (error) {
      setAssets((current) => current.filter((asset) => asset.id !== temporaryId));
      showNotice(error.message);
    } else {
      setAssets((current) => current.map((asset) => asset.id === temporaryId ? data as Asset : asset));
    }
  };

  const renameProject = async (project: Project) => {
    const name = window.prompt('Project name', project.name)?.trim();
    if (!name || name === project.name) return;
    const before = projects;
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, name, slug: slugify(name) } : item));
    const { error } = await supabase.from('projects').update({ name, slug: slugify(name) }).eq('id', project.id);
    if (error) { setProjects(before); showNotice(error.message); }
  };

  const deleteProject = async (project: Project) => {
    if (!window.confirm(`Delete “${project.name}” and its ${assets.filter((asset) => asset.project_id === project.id).length} linked assets?`)) return;
    const beforeProjects = projects;
    const beforeAssets = assets;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setAssets((current) => current.filter((asset) => asset.project_id !== project.id));
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) { setProjects(beforeProjects); setAssets(beforeAssets); showNotice(error.message); }
  };

  const toggleFeatured = async (asset: Asset) => {
    setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, featured: !item.featured } : item));
    const { error } = await supabase.from('assets').update({ featured: !asset.featured }).eq('id', asset.id);
    if (error) { setAssets((current) => current.map((item) => item.id === asset.id ? asset : item)); showNotice(error.message); }
  };

  const editAsset = async (asset: Asset) => {
    const title = window.prompt('Asset title', asset.title)?.trim();
    if (!title || title === asset.title) return;
    const before = assets;
    setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, title } : item));
    const { error } = await supabase.from('assets').update({ title }).eq('id', asset.id);
    if (error) { setAssets(before); showNotice(error.message); }
  };

  const deleteAsset = async (asset: Asset) => {
    if (!window.confirm(`Delete “${asset.title}”?`)) return;
    const before = assets;
    setAssets((current) => current.filter((item) => item.id !== asset.id));
    const { error } = await supabase.from('assets').delete().eq('id', asset.id);
    if (error) { setAssets(before); showNotice(error.message); }
  };

  const signOut = async () => { await supabase.auth.signOut(); router.replace('/studio/login'); router.refresh(); };

  if (isLoading) return <main className="min-h-screen bg-[#0a0a0a] grid place-items-center"><LoaderCircle className="w-7 h-7 animate-spin text-[#c7ff45]" /></main>;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#c7ff45] selection:text-black">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0a]/85 backdrop-blur px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="grid place-items-center w-9 h-9 rounded-xl bg-[#c7ff45] text-black"><Sparkles className="w-4 h-4" /></span><div><p className="font-semibold">StudioFlow</p><p className="text-xs text-white/45">Asset operations dashboard</p></div></div>
        <button onClick={signOut} className="text-xs text-white/55 hover:text-white flex items-center gap-2"><LogOut className="w-4 h-4" /> Sign out</button>
      </header>

      <div className="max-w-7xl mx-auto p-5 sm:p-8 space-y-7">
        {notice && <div className="fixed right-5 top-20 z-50 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100 shadow-xl">{notice}</div>}
        <section className="grid lg:grid-cols-[1.4fr,1fr] gap-5">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-[#c7ff45]">Live workspace</p>
            <h1 className="mt-3 max-w-xl text-3xl sm:text-5xl font-semibold tracking-tight">Keep the creative operation as considered as the work.</h1>
            <p className="mt-4 max-w-lg text-white/55 leading-7">Projects and their assets are stored in Supabase, scoped to the signed-in user by row-level security, and reflected live across open tabs.</p>
          </div>
          <div className="rounded-3xl bg-[#c7ff45] text-black p-6 flex flex-col justify-between"><p className="text-sm font-medium">Portfolio inventory</p><div><p className="text-6xl font-semibold tracking-tight">{assets.length}</p><p className="mt-1 text-sm opacity-65">assets across {projects.length} projects</p></div></div>
        </section>

        <section className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6 min-h-[290px]"><div className="flex items-center justify-between mb-4"><h2 className="font-medium">Assets by project</h2><FolderKanban className="w-4 h-4 text-white/40" /></div><ResponsiveContainer width="100%" height={220}><BarChart data={assetsByProject}><XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} /><Bar dataKey="assets" radius={[8, 8, 0, 0]} fill="#c7ff45" /></BarChart></ResponsiveContainer></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6 min-h-[290px]"><div className="flex items-center justify-between mb-4"><h2 className="font-medium">Seven-day upload cadence</h2><ImagePlus className="w-4 h-4 text-white/40" /></div><ResponsiveContainer width="100%" height={220}><AreaChart data={uploadsByDay}><defs><linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#9ab7ff" stopOpacity={0.8}/><stop offset="95%" stopColor="#9ab7ff" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="day" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} /><Area type="monotone" dataKey="uploads" stroke="#9ab7ff" strokeWidth={3} fill="url(#uploadGradient)" /></AreaChart></ResponsiveContainer></div>
        </section>

        <section className="grid xl:grid-cols-[360px,1fr] gap-5 items-start">
          <aside className="space-y-5 xl:sticky xl:top-24">
            <form onSubmit={createProject} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 space-y-3"><div className="flex items-center gap-2"><Plus className="w-4 h-4 text-[#c7ff45]" /><h2 className="font-medium">New project</h2></div><input className="field" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. Editorial launch" required /><textarea className="field min-h-20 resize-y" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="One-line brief (optional)" /><button className="action w-full">Create project</button></form>
            <form onSubmit={createAsset} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 space-y-3"><div className="flex items-center gap-2"><ImagePlus className="w-4 h-4 text-[#9ab7ff]" /><h2 className="font-medium">Add asset</h2></div><input className="field" value={assetForm.title} onChange={(event) => setAssetForm({ ...assetForm, title: event.target.value })} placeholder="Asset title" required /><select className="field" value={assetForm.projectId} onChange={(event) => setAssetForm({ ...assetForm, projectId: event.target.value })} required><option value="">Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input className="field" type="url" value={assetForm.imageUrl} onChange={(event) => setAssetForm({ ...assetForm, imageUrl: event.target.value })} placeholder="Image URL" required /><textarea className="field min-h-20 resize-y" value={assetForm.description} onChange={(event) => setAssetForm({ ...assetForm, description: event.target.value })} placeholder="Short description" /><input className="field" value={assetForm.tags} onChange={(event) => setAssetForm({ ...assetForm, tags: event.target.value })} placeholder="Tags, comma separated" /><button className="action w-full">Save asset</button></form>
          </aside>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] overflow-hidden"><div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="font-medium">Asset library</h2><p className="text-sm text-white/45 mt-1">Create, edit, feature, or delete assets with optimistic feedback.</p></div><select className="field !w-auto" value={activeProjectId} onChange={(event) => setActiveProjectId(event.target.value)}><option value="all">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
            <div className="p-4 sm:p-5 space-y-3">{filteredAssets.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-white/45"><ImagePlus className="w-6 h-6 mx-auto mb-3" />No assets here yet. Add one from the form.</div> : filteredAssets.map((asset) => <article key={asset.id} className="group grid sm:grid-cols-[96px,1fr,auto] gap-4 items-center rounded-2xl border border-white/10 bg-black/15 p-3"><img src={asset.image_url} alt="" className="w-24 h-20 object-cover rounded-xl bg-white/5" /><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="font-medium truncate">{asset.title}</h3>{asset.featured && <span className="inline-flex items-center gap-1 rounded-full bg-[#c7ff45]/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#d7ff77]"><Star className="w-3 h-3 fill-current" />Featured</span>}</div><p className="text-sm text-white/45 mt-1 truncate">{projectMap.get(asset.project_id)?.name ?? 'Unknown project'}{asset.tags.length ? ` · ${asset.tags.join(', ')}` : ''}</p></div><div className="flex sm:flex-col gap-2"><button onClick={() => toggleFeatured(asset)} aria-label="Toggle featured asset" className="icon-button"><Star className={`w-4 h-4 ${asset.featured ? 'fill-[#c7ff45] text-[#c7ff45]' : ''}`} /></button><button onClick={() => editAsset(asset)} aria-label="Edit asset title" className="icon-button"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteAsset(asset)} aria-label="Delete asset" className="icon-button hover:!text-red-300"><Trash2 className="w-4 h-4" /></button></div></article>)}</div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><div className="flex items-center justify-between mb-4"><div><h2 className="font-medium">Projects</h2><p className="text-sm text-white/45 mt-1">Assets retain their relationship through a foreign key, even when project names change.</p></div><FolderKanban className="w-5 h-5 text-white/35" /></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{projects.map((project) => <article key={project.id} className="rounded-2xl border border-white/10 p-4 bg-black/15"><span className="block h-1 rounded-full mb-4" style={{ background: project.color }} /><h3 className="font-medium">{project.name}</h3><p className="mt-1 text-sm text-white/45 min-h-10">{project.description || 'No project brief yet.'}</p><p className="mt-4 text-xs text-white/35">{assets.filter((asset) => asset.project_id === project.id).length} assets</p><div className="mt-4 flex gap-2"><button onClick={() => renameProject(project)} className="icon-button"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteProject(project)} className="icon-button hover:!text-red-300"><Trash2 className="w-4 h-4" /></button></div></article>)}</div></section>
      </div>
    </main>
  );
}
