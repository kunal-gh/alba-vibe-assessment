'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole, Sparkles } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function StudioLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage('');

    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Add the project URL and publishable key to .env.local.');
      setIsLoading(false);
      return;
    }
    const client = getSupabaseClient();
    const action = mode === 'sign-in'
      ? client.auth.signInWithPassword({ email, password })
      : client.auth.signUp({ email, password });
    const { error, data } = await action;

    if (error) {
      setMessage(error.message);
    } else if (mode === 'sign-up' && !data.session) {
      setMessage('Account created. Confirm the email, then sign in.');
    } else {
      router.replace('/studio');
      router.refresh();
    }
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white grid place-items-center p-5">
      <section className="w-full max-w-md border border-white/10 bg-white/[0.035] rounded-3xl p-7 sm:p-9 shadow-2xl">
        <div className="w-12 h-12 grid place-items-center rounded-2xl bg-[#c7ff45] text-black mb-7">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#c7ff45] mb-2">StudioFlow</p>
        <h1 className="text-3xl font-semibold tracking-tight">Creative work, kept in focus.</h1>
        <p className="mt-3 text-sm text-white/55 leading-6">Sign in to your isolated asset workspace. Every project and asset is protected by Supabase row-level security.</p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
          <label className="block text-xs uppercase tracking-wider text-white/55">
            Email
            <input className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#c7ff45]" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="block text-xs uppercase tracking-wider text-white/55">
            Password
            <input className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[#c7ff45]" type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" />
          </label>
          {message && <p className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">{message}</p>}
          <button disabled={isLoading} className="w-full rounded-xl bg-[#c7ff45] text-black py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#d7ff77] disabled:opacity-60">
            <LockKeyhole className="w-4 h-4" />
            {isLoading ? 'Working…' : mode === 'sign-in' ? 'Enter StudioFlow' : 'Create workspace'}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <button className="mt-5 text-sm text-white/55 hover:text-white" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(''); }}>
          {mode === 'sign-in' ? 'Need an account? Create one.' : 'Already have an account? Sign in.'}
        </button>
      </section>
    </main>
  );
}
