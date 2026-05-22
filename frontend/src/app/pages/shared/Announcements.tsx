import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Bell, Calendar, ImageIcon, User, X } from 'lucide-react';
import { AnnouncementCarousel } from '../../components/AnnouncementCarousel';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, publicAssetUrl } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useEffect, useMemo, useState } from 'react';

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  badge: string;
  target: string;
  date: string;
  imageUrl?: string | null;
  showOnLanding?: boolean;
  eventDate?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const TARGETS = ['Whole School', 'Students', 'Teachers'] as const;
const BADGES = ['Announcement', 'Event', 'Reminder'] as const;

export function Announcements() {
  const { user } = useAuth();
  const canManage = user?.role === 'registrar' || user?.role === 'admin';

  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    badge: 'Announcement',
    target: 'Whole School',
    showOnLanding: true,
    eventDate: '',
    isActive: true,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(canManage ? '/api/registrar/announcements' : '/api/announcements?scope=portal');
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to load announcements');
      }
      const next = (data.announcements || []) as AnnouncementItem[];
      setItems(next);
    } catch (e: any) {
      setError(String(e?.message || e || 'Failed to load announcements'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const announcements = useMemo(() => {
    const list = items || [];
    if (!user) return list;
    return list.filter((a) => {
      if (a.isActive === false) return false;
      if (a.target === 'Whole School') return true;
      if (user.role === 'student' && a.target === 'Students') return true;
      if ((user.role === 'registrar' || user.role === 'admin') && a.target === 'Teachers') return true;
      return false;
    });
  }, [items, user]);

  function resetImageState(existingUrl?: string | null) {
    setImageFile(null);
    setImagePreview(existingUrl ?? null);
    setRemoveImage(false);
  }

  function openCreate() {
    setEditId(null);
    resetImageState(null);
    setForm({
      title: '',
      body: '',
      badge: 'Announcement',
      target: 'Whole School',
      showOnLanding: true,
      eventDate: '',
      isActive: true,
    });
    setEditorOpen(true);
  }

  function openEdit(a: AnnouncementItem) {
    setEditId(a.id);
    resetImageState(a.imageUrl ?? null);
    setForm({
      title: a.title || '',
      body: a.body || '',
      badge: a.badge || 'Announcement',
      target: a.target || 'Whole School',
      showOnLanding: Boolean(a.showOnLanding ?? true),
      eventDate: (a.eventDate || a.date || '').slice(0, 10),
      isActive: Boolean(a.isActive ?? true),
    });
    setEditorOpen(true);
  }

  async function uploadImage(announcementId: string) {
    if (!imageFile) return;
    const fd = new FormData();
    fd.append('id', announcementId);
    fd.append('image', imageFile);
    const res = await apiFetch('/api/registrar/announcements/image', {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to upload image');
    }
  }

  async function save() {
    if (!canManage) return;
    const payload =
      editId == null
        ? { action: 'create', ...form }
        : { action: 'update', id: editId, ...form };
    const res = await apiFetch('/api/registrar/announcements', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to save');
    }
    const savedId = String(data.id ?? editId ?? '');
    if (removeImage && savedId) {
      await apiFetch('/api/registrar/announcements', {
        method: 'POST',
        body: JSON.stringify({ action: 'remove_image', id: savedId }),
      });
    } else if (imageFile && savedId) {
      await uploadImage(savedId);
    }
    setEditorOpen(false);
    resetImageState(null);
    await load();
  }

  async function remove(id: string) {
    if (!canManage) return;
    const res = await apiFetch('/api/registrar/announcements', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', id }),
    });
    const data = await res.json();
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to delete');
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Announcements</h2>
          <p className="text-gray-600">Important school announcements and updates</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="bg-[#8B1538] hover:bg-[#8B1538]/90">
            New announcement
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
        </Card>
      )}

      {editorOpen && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? 'Edit announcement' : 'Create announcement'}</CardTitle>
            <CardDescription>Shown on the landing page when “Show on landing” is enabled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Title</div>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Date (optional)</div>
                <Input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Badge</div>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.badge}
                  onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                >
                  {BADGES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Target</div>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                >
                  {TARGETS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Body</div>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={4}
              />
            </div>


            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Image (optional)</div>
              <p className="text-xs text-gray-500">JPG, PNG, or WEBP up to 5MB. Shown in the carousel.</p>
              {imagePreview ? (
                <div className="relative max-w-md overflow-hidden rounded-lg border">
                  <img src={imagePreview} alt="Preview" className="h-48 w-full object-cover" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/90"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setRemoveImage(true);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex max-w-md flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                  <label className="cursor-pointer text-sm font-medium text-[#8B1538] hover:underline">
                    Choose image
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImageFile(file);
                        setRemoveImage(false);
                        setImagePreview(URL.createObjectURL(file));
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.showOnLanding}
                  onChange={(e) => setForm((f) => ({ ...f, showOnLanding: e.target.checked }))}
                />
                Show on landing page
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  void (async () => {
                    try {
                      await save();
                    } catch (e: any) {
                      setError(String(e?.message || e || 'Failed to save'));
                    }
                  })();
                }}
                className="bg-[#2d5016] hover:bg-[#2d5016]/90"
              >
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {!loading && announcements.length > 0 && (
        <AnnouncementCarousel items={announcements} />
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {loading && (
          <Card>
            <CardContent className="py-6 text-sm text-gray-600">Loading announcements…</CardContent>
          </Card>
        )}
        {!loading &&
          announcements.map((announcement) => (
          <Card key={announcement.id || `${announcement.date}-${announcement.title}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  <div>
                    <CardTitle>{announcement.title}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(announcement.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                      {canManage && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          {announcement.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{announcement.badge}</Badge>
                  <Badge variant="outline">{announcement.target}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {publicAssetUrl(announcement.imageUrl) ? (
                <img
                  src={publicAssetUrl(announcement.imageUrl)!}
                  alt={announcement.title}
                  className="mb-4 h-40 w-full max-w-md rounded-lg border object-cover"
                />
              ) : null}
              <p className="text-gray-700">{announcement.body}</p>
              {canManage && (
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={() => openEdit(announcement)}>
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      void (async () => {
                        try {
                          await remove(announcement.id);
                        } catch (e: any) {
                          setError(String(e?.message || e || 'Failed to delete'));
                        }
                      })();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && announcements.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No announcements at this time</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
