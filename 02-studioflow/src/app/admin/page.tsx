"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Camera, MessageSquare, Mail, ArrowRight, LogOut, Upload } from "lucide-react";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  if (status === "loading") return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Camera className="w-4 h-4 text-white/80" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Studio Admin</h1>
            <p className="text-xs text-white/40">Welcome back, {session?.user?.name}</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="flex items-center gap-2 text-xs text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white tracking-tight">Dashboard</h2>
          <p className="mt-1 text-white/40 text-sm">Manage your portfolio content</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/dashboard" className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 hover:border-white/20 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-white/10 rounded-xl group-hover:bg-white/15 transition-colors"><Upload className="h-5 w-5 text-white/70" /></div>
              <div>
                <p className="text-sm font-semibold text-white">Photo Upload</p>
                <p className="text-xs text-white/40">Manage portfolio images</p>
              </div>
            </div>
            <p className="text-xs text-white/30 mb-4">Upload, label, and organise photos by section — Weddings, Fashion, Portraits and more.</p>
            <div className="flex items-center gap-1 text-xs text-white/50 group-hover:text-white/80 transition-colors">Open <ArrowRight className="w-3 h-3 ml-1" /></div>
          </Link>

          <Link href="/admin/testimonials" className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 hover:border-white/20 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-white/10 rounded-xl group-hover:bg-white/15 transition-colors"><MessageSquare className="h-5 w-5 text-white/70" /></div>
              <div>
                <p className="text-sm font-semibold text-white">Testimonials</p>
                <p className="text-xs text-white/40">Manage client reviews</p>
              </div>
            </div>
            <p className="text-xs text-white/30 mb-4">Add and remove client testimonials shown on the public site.</p>
            <div className="flex items-center gap-1 text-xs text-white/50 group-hover:text-white/80 transition-colors">Open <ArrowRight className="w-3 h-3 ml-1" /></div>
          </Link>

          <Link href="/admin/contacts" className="group bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 hover:border-white/20 transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-white/10 rounded-xl group-hover:bg-white/15 transition-colors"><Mail className="h-5 w-5 text-white/70" /></div>
              <div>
                <p className="text-sm font-semibold text-white">Messages</p>
                <p className="text-xs text-white/40">View client inquiries</p>
              </div>
            </div>
            <p className="text-xs text-white/30 mb-4">Read contact form submissions from potential clients.</p>
            <div className="flex items-center gap-1 text-xs text-white/50 group-hover:text-white/80 transition-colors">Open <ArrowRight className="w-3 h-3 ml-1" /></div>
          </Link>
        </div>
      </div>
    </div>
  );
}