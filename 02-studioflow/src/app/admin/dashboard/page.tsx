"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  Camera, Upload, Trash2, LogOut, Image as ImageIcon, Star,
  CheckCircle, XCircle, Calendar, FolderOpen, Plus, Pencil,
  Check, X, GripVertical, Archive, Mail, MessageSquare, ExternalLink, Settings as SettingsIcon, Save, Cloud
} from "lucide-react";
import { IKUpload } from "imagekitio-next";
import useDrivePicker from "react-google-drive-picker";

interface Photo {
  id: string; title: string; description?: string; section: string;
  imageUrl: string; imageKitFileId: string; featured: boolean;
  uploadedAt: string; eventDate?: string; tags?: string;
}
interface Section {
  id: string; name: string; slug: string; description?: string;
  order: number; photoCount?: number;
}
interface Contact {
  id: string; name: string; email: string; message: string;
  createdAt: string; read: boolean;
}
interface Testimonial {
  id: string; author: string; role: string; text: string;
  avatar?: string; rating: number; sourceUrl?: string; createdAt: string;
}

type Tab = "gallery" | "sections" | "messages" | "testimonials" | "settings";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("gallery");

  // Gallery state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [uploadSource, setUploadSource] = useState<"local" | "drive">("local");
  const [form, setForm] = useState({ title: "", description: "", section: "", tags: "", eventDate: "", featured: false });
  const [uploadError, setUploadError] = useState("");
  const ikUploadRef = useRef<any>(null);
  const [openPicker, authResponse] = useDrivePicker();

  // Section editing
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Messages state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Testimonials state
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(false);
  const [testForm, setTestForm] = useState({ author: "", role: "", text: "", avatar: "", rating: 5, sourceUrl: "" });
  const [submittingTest, setSubmittingTest] = useState(false);

  // Settings state
  const [siteSettings, setSiteSettings] = useState({ email: "", phone: "", instagram: "", twitter: "", facebook: "" });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { if (status === "unauthenticated") router.push("/admin/login"); }, [status, router]);
  useEffect(() => { if (activeTab === "gallery" || activeTab === "sections") fetchSections(); }, [activeTab]);
  useEffect(() => { fetchPhotos(); }, [activeSection]);
  useEffect(() => { if (activeTab === "messages") fetchContacts(); }, [activeTab]);
  useEffect(() => { if (activeTab === "testimonials") fetchTestimonials(); }, [activeTab]);
  useEffect(() => { if (activeTab === "settings") fetchSiteSettings(); }, [activeTab]);

  const fetchSections = async () => {
    const res = await fetch("/api/sections");
    const data = await res.json();
    if (Array.isArray(data)) {
      setSections(data);
      if (data.length > 0) setForm(f => ({ ...f, section: f.section || data[0].name }));
    }
  };
  const fetchPhotos = async () => {
    const url = activeSection === "all" ? "/api/photographs" : `/api/photographs?section=${encodeURIComponent(activeSection)}`;
    const res = await fetch(url);
    const data = await res.json();
    setPhotos(Array.isArray(data) ? data : []);
  };
  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      setContacts(Array.isArray(data) ? data.sort((a: Contact, b: Contact) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : []);
    } catch { showToast("Failed to load messages", "error"); }
    finally { setContactsLoading(false); }
  };
  const fetchTestimonials = async () => {
    setTestimonialsLoading(true);
    try {
      const res = await fetch("/api/testimonials");
      const data = await res.json();
      setTestimonials(Array.isArray(data) ? data : []);
    } catch { showToast("Failed to load testimonials", "error"); }
    finally { setTestimonialsLoading(false); }
  };
  const fetchSiteSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data) {
        setSiteSettings({ email: data.email || "", phone: data.phone || "", instagram: data.instagram || "", twitter: data.twitter || "", facebook: data.facebook || "" });
      }
    } catch { showToast("Failed to load settings", "error"); }
  };

  const getIKAuth = async () => { 
    try {
      const res = await fetch("/api/imagekit/auth"); 
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Auth failed (${res.status}): ${errorText}`);
      }
      return await res.json(); 
    } catch (err) {
      console.error("IK Auth Fetch Error:", err);
      throw err;
    }
  };

  const onUploadSuccess = async (res: any) => {
    const response = await fetch("/api/photographs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, description: form.description, section: form.section, imageUrl: res.url, imageKitFileId: res.fileId, width: res.width, height: res.height, featured: form.featured, tags: form.tags, eventDate: form.eventDate || null }),
    });
    if (response.ok) { 
      showToast("Photo uploaded!", "success"); 
      setForm(f => ({ ...f, title: "", description: "", tags: "", eventDate: "", featured: false })); 
      setUploadError("");
      fetchPhotos(); 
    } else {
      showToast("Upload failed.", "error");
    }
    setUploading(false);
  };

  const handleDrivePicker = () => {
    if (!form.title) return setUploadError("Please enter a title.");
    if (!form.section) return setUploadError("Please select a section.");
    setUploadError("");
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return showToast("Google API keys missing in .env", "error");

    openPicker({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      developerKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY!,
      viewId: "DOCS",
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: false,
      callbackFunction: async (data: any) => {
        if (data.action === "picked" && data.docs.length > 0) {
          const file = data.docs[0];
          setUploading(true);
          try {
            // 1. Download file blob using Picker Access Token
            const dbRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
              headers: { Authorization: `Bearer ${data.oauthToken}` }
            });
            if (!dbRes.ok) throw new Error("Failed to pull from Google Drive");
            const blob = await dbRes.blob();
            
            // 2. Prepare for ImageKit POST
            const auth = await getIKAuth();
            const fd = new FormData();
            fd.append("file", blob, file.name);
            fd.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "");
            fd.append("signature", auth.signature);
            fd.append("expire", auth.expire.toString());
            fd.append("token", auth.token);
            fd.append("fileName", file.name);
            fd.append("folder", "/studio");

            // 3. Upload to ImageKit REST interface directly
            const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
              method: "POST", body: fd,
            });
            const ikData = await uploadRes.json();
            
            if (ikData.fileId) {
              await onUploadSuccess(ikData);
            } else {
              throw new Error("ImageKit upload failed");
            }
          } catch (e) {
            console.error(e);
            showToast("Failed to process Drive file.", "error");
            setUploading(false);
          }
        }
      },
    });
  };

  const deletePhoto = async (id: string) => {
    if (!confirm("Delete this photo permanently?")) return;
    await fetch(`/api/photographs/${id}`, { method: "DELETE" });
    showToast("Photo deleted.", "success"); fetchPhotos(); fetchSections();
  };
  const toggleFeatured = async (photo: Photo) => {
    await fetch(`/api/photographs/${photo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featured: !photo.featured }) });
    fetchPhotos();
  };

  const createSection = async () => {
    if (!newSectionName.trim()) return showToast("Enter a section name.", "error");
    const res = await fetch("/api/sections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newSectionName.trim(), description: newSectionDesc.trim() }) });
    if (res.ok) { showToast("Section created!", "success"); setNewSectionName(""); setNewSectionDesc(""); setAddingSection(false); fetchSections(); }
    else { const err = await res.json(); showToast(err.error || "Failed.", "error"); }
  };
  const saveEdit = async (id: string) => {
    const res = await fetch(`/api/sections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName, description: editDesc }) });
    if (res.ok) { showToast("Section renamed!", "success"); setEditingId(null); fetchSections(); fetchPhotos(); }
    else { const err = await res.json(); showToast(err.error || "Failed.", "error"); }
  };
  const deleteSection = async (section: Section) => {
    if (!confirm(`Delete "${section.name}"? Its ${section.photoCount ?? 0} photos will be archived.`)) return;
    const res = await fetch(`/api/sections/${section.id}`, { method: "DELETE" });
    if (res.ok) { showToast(`"${section.name}" deleted. Photos archived.`, "success"); fetchSections(); fetchPhotos(); }
    else showToast("Failed to delete.", "error");
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    showToast("Message deleted.", "success"); fetchContacts();
  };
  const markContactRead = async (id: string) => {
    await fetch(`/api/contacts/${id}`, { method: "PATCH" });
    fetchContacts();
  };

  const addTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTest(true);
    const res = await fetch("/api/testimonials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(testForm) });
    if (res.ok) { showToast("Testimonial added!", "success"); setTestForm({ author: "", role: "", text: "", avatar: "", rating: 5, sourceUrl: "" }); fetchTestimonials(); }
    else showToast("Failed to add testimonial.", "error");
    setSubmittingTest(false);
  };
  const deleteTestimonial = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    await fetch(`/api/testimonials/${id}`, { method: "DELETE" });
    showToast("Testimonial deleted.", "success"); fetchTestimonials();
  };

  const saveSettings = async () => {
    setSettingsLoading(true);
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(siteSettings) });
    if (res.ok) { showToast("Settings saved!", "success"); }
    else showToast("Failed to save settings.", "error");
    setSettingsLoading(false);
  };

  if (status === "loading") return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all";
  const displaySections = sections.filter(s => s.slug !== "archived");
  const archivedSection = sections.find(s => s.slug === "archived");
  const unreadCount = contacts.filter(c => !c.read).length;

  const tabs: { key: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key: "gallery", icon: <ImageIcon className="w-3.5 h-3.5" />, label: "Gallery" },
    { key: "sections", icon: <FolderOpen className="w-3.5 h-3.5" />, label: "Sections" },
    { key: "messages", icon: <Mail className="w-3.5 h-3.5" />, label: "Messages", badge: unreadCount },
    { key: "testimonials", icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Reviews" },
    { key: "settings", icon: <SettingsIcon className="w-3.5 h-3.5" />, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium ${toast.type === "success" ? "bg-green-500/20 border border-green-500/30 text-green-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/10 px-4 md:px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 backdrop-blur-xl sticky top-0 z-40 bg-[#0a0a0a]/80">
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white/80" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Studio Admin</h1>
              <p className="text-xs text-white/40">Photo Management Portal</p>
            </div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="lg:hidden flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="flex bg-white/5 rounded-lg p-1.5 border border-white/10 gap-1 overflow-x-auto w-full hide-scrollbar pr-6">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap relative flex items-center gap-1.5 px-3 py-2 md:py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === tab.key ? "bg-white text-black shadow-sm" : "text-white/50 hover:text-white"}`}>
                {tab.icon} {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="hidden lg:flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* ── GALLERY TAB ── */}
      {activeTab === "gallery" && (
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-8">
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5"><Upload className="w-4 h-4 text-white/60" /><h2 className="text-sm font-semibold">Upload New Photo</h2></div>
              <div className="space-y-3">
                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 w-fit mb-4">
                   <button onClick={() => setUploadSource("local")} className={`px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${uploadSource === "local" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}><Upload className="w-3.5 h-3.5" /> Local File</button>
                   <button onClick={() => setUploadSource("drive")} className={`px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-all ${uploadSource === "drive" ? "bg-white text-black" : "text-white/50 hover:text-white"}`}><Cloud className="w-3.5 h-3.5" /> Google Drive</button>
                </div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Photo title" className={inputCls} /></div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Section *</label>
                  {displaySections.length === 0
                    ? <p className="text-xs text-white/30 italic">No sections yet. Create one in the Sections tab.</p>
                    : <select value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} className={inputCls}>{displaySections.map(s => <option key={s.id} value={s.name} className="bg-[#1a1a1a]">{s.name}</option>)}</select>}
                </div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description..." rows={2} className={`${inputCls} resize-none`} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Tags</label><input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="nature, golden-hour, couple" className={inputCls} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Event Date</label><input type="date" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))} className={`${inputCls} [color-scheme:dark]`} /></div>
                
                <button type="button" onClick={() => setForm(f => ({ ...f, featured: !f.featured }))} className="flex items-center gap-2.5 cursor-pointer text-left w-fit my-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${form.featured ? 'bg-white border-white' : 'border-white/30'}`}>
                    {form.featured && <Check className="w-3 h-3 text-black" />}
                  </div>
                  <span className="text-sm text-white/80 select-none">Mark as Featured</span>
                </button>
                
                {uploadError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-medium">{uploadError}</div>}

                {uploadSource === "local" ? (
                  <>
                    <div className="hidden"><IKUpload ref={ikUploadRef} fileName={`photo-${Date.now()}`} folder="/studio" useUniqueFileName={true} onSuccess={onUploadSuccess} onError={(err) => { console.error("IK Error:", err); showToast(err?.message || "Upload error.", "error"); setUploading(false); }} onUploadStart={() => setUploading(true)} authenticator={getIKAuth} /></div>
                    <button onClick={() => { if (!form.title) return setUploadError("Please enter a title."); if (!form.section) return setUploadError("Please select a section."); setUploadError(""); ikUploadRef.current?.click(); }} disabled={uploading} className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 rounded-xl text-sm hover:bg-white/90 transition-all disabled:opacity-50 mt-2">
                      {uploading ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Pick & Upload File</>}
                    </button>
                  </>
                ) : (
                  <button onClick={handleDrivePicker} disabled={uploading} className="w-full flex items-center justify-center gap-2 bg-[#4285F4] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#4285F4]/90 transition-all disabled:opacity-50 mt-2">
                    {uploading ? <><div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" /> Processing from Drive...</> : <><Cloud className="w-4 h-4" /> Import from Google Drive</>}
                  </button>
                )}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white/40 space-y-1.5">
              <p className="font-medium text-white/60 mb-2">Upload Notes</p>
              <p>• High-res images preserved at full quality</p><p>• Stored securely on ImageKit CDN</p><p>• Labelled by section automatically</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-5"><ImageIcon className="w-4 h-4 text-white/60" /><h2 className="text-sm font-semibold">Gallery</h2><span className="text-xs text-white/30">({photos.length} photos)</span></div>
            <div className="flex flex-wrap gap-2 mb-5">
              {["all", ...sections.map(s => s.name)].map(s => (
                <button key={s} onClick={() => setActiveSection(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${activeSection === s ? "bg-white text-black" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/10"}`}>
                  {s === "archived" && <Archive className="w-3 h-3" />}{s === "all" ? "All" : s}
                </button>
              ))}
            </div>
            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-white/20"><Camera className="w-12 h-12 mb-3" /><p className="text-sm">No photos yet.</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 aspect-square">
                    <img src={photo.imageUrl} alt={photo.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
                      <div className="flex justify-between">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg w-fit">{photo.section}</span>
                          {photo.uploadedAt && <span className="text-[10px] text-white/50 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{new Date(photo.uploadedAt).toLocaleDateString()}</span>}
                        </div>
                        <button onClick={() => toggleFeatured(photo)} className={`p-1 rounded-lg ${photo.featured ? "text-yellow-400" : "text-white/30 hover:text-yellow-400"}`}><Star className="w-3.5 h-3.5 fill-current" /></button>
                      </div>
                      <div><p className="text-xs font-medium text-white truncate">{photo.title}</p><button onClick={() => deletePhoto(photo.id)} className="mt-1 flex items-center gap-1 text-red-400 text-xs hover:text-red-300"><Trash2 className="w-3 h-3" /> Delete</button></div>
                    </div>
                    {photo.featured && <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-yellow-400" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTIONS TAB ── */}
      {activeTab === "sections" && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-lg font-semibold">Manage Sections</h2><p className="text-xs text-white/40 mt-1">Sections appear as cards on the public portfolio page.</p></div>
            <button onClick={() => setAddingSection(true)} className="flex items-center gap-2 bg-white text-black text-xs font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-all"><Plus className="w-3.5 h-3.5" /> Add Section</button>
          </div>
          {addingSection && (
            <div className="bg-white/5 border border-white/20 rounded-2xl p-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">New Section</p>
              <input autoFocus value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Section name (e.g. Architecture)" className={inputCls} />
              <input value={newSectionDesc} onChange={e => setNewSectionDesc(e.target.value)} placeholder="Short description (optional)" className={inputCls} />
              <div className="flex gap-2">
                <button onClick={createSection} className="flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-all"><Check className="w-3.5 h-3.5" /> Create</button>
                <button onClick={() => { setAddingSection(false); setNewSectionName(""); setNewSectionDesc(""); }} className="flex items-center gap-1.5 bg-white/10 text-white/60 text-xs px-4 py-2 rounded-xl hover:bg-white/20"><X className="w-3.5 h-3.5" /> Cancel</button>
              </div>
            </div>
          )}
          {displaySections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-white/20"><FolderOpen className="w-12 h-12 mb-3" /><p className="text-sm">No sections yet.</p></div>
          ) : (
            <div className="space-y-2">
              {displaySections.map(section => (
                <div key={section.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 group">
                  {editingId === section.id ? (
                    <div className="space-y-2">
                      <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className={inputCls} />
                      <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description (optional)" className={inputCls} />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(section.id)} className="flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/90"><Check className="w-3.5 h-3.5" /> Save</button>
                        <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 bg-white/10 text-white/60 text-xs px-3 py-1.5 rounded-lg hover:bg-white/20"><X className="w-3.5 h-3.5" /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-white/20" />
                        <div>
                          <p className="text-sm font-medium">{section.name}</p>
                          {section.description && <p className="text-xs text-white/40 mt-0.5">{section.description}</p>}
                          <p className="text-xs text-white/25 mt-0.5">{section.photoCount ?? 0} photo{section.photoCount !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingId(section.id); setEditName(section.name); setEditDesc(section.description || ""); }} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteSection(section)} className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {archivedSection && archivedSection.photoCount && archivedSection.photoCount > 0 && (
            <div className="mt-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3">
              <Archive className="w-5 h-5 text-yellow-400/60 flex-shrink-0" />
              <div><p className="text-sm text-yellow-300/80 font-medium">Archive</p><p className="text-xs text-yellow-400/50">{archivedSection.photoCount} photo{archivedSection.photoCount !== 1 ? "s" : ""} from deleted sections. View in Gallery tab.</p></div>
            </div>
          )}
        </div>
      )}

      {/* ── MESSAGES TAB ── */}
      {activeTab === "messages" && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2"><Mail className="w-5 h-5 text-white/60" /> Contact Messages</h2>
              <p className="text-xs text-white/40 mt-1">{contacts.length} total · {unreadCount} unread</p>
            </div>
          </div>
          {contactsLoading ? (
            <div className="flex items-center justify-center h-60"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-white/20"><Mail className="w-12 h-12 mb-3" /><p className="text-sm">No messages yet.</p></div>
          ) : (
            <div className="space-y-3">
              {contacts.map(contact => (
                <div key={contact.id} className={`bg-white/5 border rounded-2xl p-5 transition-all ${!contact.read ? "border-white/30" : "border-white/10"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-grow space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{contact.name}</p>
                        {!contact.read && <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-full font-semibold">NEW</span>}
                      </div>
                      <a href={`mailto:${contact.email}`} className="text-xs text-white/50 hover:text-white/80 transition-colors flex items-center gap-1"><Mail className="w-3 h-3" />{contact.email}</a>
                      <p className="text-sm text-white/80 leading-relaxed">{contact.message}</p>
                      <p className="text-xs text-white/30">{new Date(contact.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {!contact.read && (
                        <button onClick={() => markContactRead(contact.id)} className="flex items-center gap-1 text-xs text-white/40 hover:text-green-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"><CheckCircle className="w-3.5 h-3.5" /> Mark Read</button>
                      )}
                      <button onClick={() => deleteContact(contact.id)} className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TESTIMONIALS TAB ── */}
      {activeTab === "testimonials" && (
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-8">
          {/* Add Form */}
          <div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5"><Plus className="w-4 h-4 text-white/60" /><h2 className="text-sm font-semibold">Add New Review</h2></div>
              <form onSubmit={addTestimonial} className="space-y-3">
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Client Name *</label><input required value={testForm.author} onChange={e => setTestForm(f => ({ ...f, author: e.target.value }))} placeholder="Anjali Mehta" className={inputCls} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Role / Title *</label><input required value={testForm.role} onChange={e => setTestForm(f => ({ ...f, role: e.target.value }))} placeholder="Wedding Client" className={inputCls} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Testimonial *</label><textarea required value={testForm.text} onChange={e => setTestForm(f => ({ ...f, text: e.target.value }))} placeholder="The photographs were stunning..." rows={3} className={`${inputCls} resize-none`} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Avatar URL</label><input value={testForm.avatar} onChange={e => setTestForm(f => ({ ...f, avatar: e.target.value }))} placeholder="https://i.pravatar.cc/150?img=1" className={inputCls} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Source URL (Optional)</label><input value={testForm.sourceUrl} onChange={e => setTestForm(f => ({ ...f, sourceUrl: e.target.value }))} placeholder="e.g. Google Review Link" className={inputCls} /></div>
                <div>
                  <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} type="button" onClick={() => setTestForm(f => ({ ...f, rating: star }))} className="focus:outline-none">
                        <Star className={`w-6 h-6 transition-colors ${star <= testForm.rating ? "fill-yellow-400 text-yellow-400" : "text-white/20"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={submittingTest} className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 rounded-xl text-sm hover:bg-white/90 transition-all disabled:opacity-50">
                  {submittingTest ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Adding...</> : <><Plus className="w-4 h-4" /> Add Testimonial</>}
                </button>
              </form>
            </div>
          </div>

          {/* Testimonials List */}
          <div>
            <div className="flex items-center gap-2 mb-5"><MessageSquare className="w-4 h-4 text-white/60" /><h2 className="text-sm font-semibold">All Reviews</h2><span className="text-xs text-white/30">({testimonials.length})</span></div>
            {testimonialsLoading ? (
              <div className="flex items-center justify-center h-60"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
            ) : testimonials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-white/20"><MessageSquare className="w-12 h-12 mb-3" /><p className="text-sm">No reviews yet. Add your first one!</p></div>
            ) : (
              <div className="space-y-3">
                {testimonials.map(t => (
                  <div key={t.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-4 group">
                    {t.avatar && <img src={t.avatar} alt={t.author} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />}
                    {!t.avatar && <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold flex-shrink-0">{t.author[0]}</div>}
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{t.author}</p>
                        {t.sourceUrl && (
                          <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors" title="View Source">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-white/40">{t.role}</p>
                      <p className="text-sm text-white/70 mt-1.5 italic">"{t.text}"</p>
                      <div className="flex items-center gap-0.5 mt-2">
                        {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />)}
                      </div>
                    </div>
                    <button onClick={() => deleteTestimonial(t.id)} className="p-2 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === "settings" && (
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 mb-6">
            <SettingsIcon className="w-5 h-5 text-white/60" />
            <h2 className="text-lg font-semibold">Contact Details & Social Links</h2>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white/80 border-b border-white/10 pb-2">Direct Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Public Email</label><input value={siteSettings.email} onChange={e => setSiteSettings(s => ({ ...s, email: e.target.value }))} placeholder="hello@example.com" className={inputCls} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Public Phone</label><input value={siteSettings.phone} onChange={e => setSiteSettings(s => ({ ...s, phone: e.target.value }))} placeholder="+1 234 567 890" className={inputCls} /></div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold text-white/80 border-b border-white/10 pb-2">Social Hub</h3>
              <div className="space-y-4 mt-2">
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Instagram URL</label><input value={siteSettings.instagram} onChange={e => setSiteSettings(s => ({ ...s, instagram: e.target.value }))} placeholder="https://instagram.com/yourhandle" className={inputCls} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Twitter / X URL</label><input value={siteSettings.twitter} onChange={e => setSiteSettings(s => ({ ...s, twitter: e.target.value }))} placeholder="https://twitter.com/yourhandle" className={inputCls} /></div>
                <div><label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Facebook URL</label><input value={siteSettings.facebook} onChange={e => setSiteSettings(s => ({ ...s, facebook: e.target.value }))} placeholder="https://facebook.com/yourhandle" className={inputCls} /></div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                onClick={saveSettings} 
                disabled={settingsLoading} 
                className="flex items-center gap-2 bg-white text-black font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {settingsLoading ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Save className="w-4 h-4" />} 
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}