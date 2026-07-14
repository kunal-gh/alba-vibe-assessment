import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceRoleKey || serviceRoleKey.startsWith('your_')) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and a real SUPABASE_SERVICE_ROLE_KEY (Supabase Secret/service_role key) before seeding.');
}
if (serviceRoleKey === publishableKey || serviceRoleKey.startsWith('sb_publishable_')) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY contains the browser publishable/anon key. Use a Supabase Secret key or legacy service_role key instead.');
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const email = process.env.DEMO_EMAIL ?? 'demo@studioflow.local';
const password = process.env.DEMO_PASSWORD ?? 'StudioFlow-demo-2026';

const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
let user = existing?.users.find((item) => item.email === email);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
}

const { data: project, error: projectError } = await supabase
  .from('projects')
  .upsert({ user_id: user.id, name: 'Launch Editorial', slug: 'launch-editorial', description: 'Campaign selects and visual notes for the product launch.', color: '#c7ff45' }, { onConflict: 'user_id,slug' })
  .select()
  .single();
if (projectError) throw projectError;

const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true }).eq('project_id', project.id);
if (!count) {
  const { error } = await supabase.from('assets').insert([
    { user_id: user.id, project_id: project.id, title: 'Opening frame', image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80', tags: ['editorial', 'launch'], featured: true },
    { user_id: user.id, project_id: project.id, title: 'Campaign texture', image_url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1200&q=80', tags: ['texture', 'palette'] },
  ]);
  if (error) throw error;
}

console.log(`Seeded StudioFlow. Demo sign-in: ${email} / ${password}`);
