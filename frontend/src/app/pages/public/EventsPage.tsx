import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '../../components/Footer';
import { publicAssetUrl } from '../../lib/api';
import imgImageNuestraSenoraDeGuiaAcademy from '../../../assets/logo.png';

type EventItem = {
  id?: string;
  date: string;
  badge: string;
  title: string;
  body: string;
  imageUrl?: string | null;
};

function formatDate(date: string): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/announcements?scope=landing', { credentials: 'include' });
        const data = await res.json();
        if (data?.success && Array.isArray(data.announcements)) {
          setEvents(
            data.announcements.map((a: Record<string, unknown>) => ({
              id: String(a.id ?? ''),
              date: String(a.date ?? ''),
              badge: String(a.badge ?? 'Announcement'),
              title: String(a.title ?? ''),
              body: String(a.body ?? ''),
              imageUrl: a.imageUrl ? String(a.imageUrl) : null,
            })),
          );
        }
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 h-[64px] bg-[rgba(255,255,255,0.95)] shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)]">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-8">
          <Link to="/landing" className="flex items-center gap-3">
            <div className="size-[40px]">
              <img
                alt="School Logo"
                className="h-full w-full object-contain"
                src={imgImageNuestraSenoraDeGuiaAcademy}
              />
            </div>
            <div>
              <p className="text-[18px] font-bold leading-tight text-[#8b1538]">Nuestra Señora De Guia</p>
              <p className="text-[12px] font-semibold text-[#2d5016]">Academy of Marikina</p>
            </div>
          </Link>
          <div className="flex items-center gap-8">
            <Link to="/landing" className="text-[16px] font-medium text-[#364153] hover:text-[#8b1538]">
              Home
            </Link>
            <Link to="/about" className="text-[16px] font-medium text-[#364153] hover:text-[#8b1538]">
              About
            </Link>
            <Link to="/admissions" className="text-[16px] font-medium text-[#364153] hover:text-[#8b1538]">
              Admissions
            </Link>
            <Link to="/contact" className="text-[16px] font-medium text-[#364153] hover:text-[#8b1538]">
              Contact Us
            </Link>
            <Link to="/login">
              <div className="flex h-[36px] items-center justify-center rounded-[8px] bg-[#2d5016] px-6 hover:bg-[#2d5016]/90">
                <p className="text-[14px] font-medium text-white">Login</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-8 py-12">
        <Link
          to="/landing"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#8b1538] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="mb-10">
          <h1 className="text-[36px] font-bold leading-[40px] text-[#8b1538]">Announcements & Events</h1>
          <p className="mt-2 text-[16px] leading-[24px] text-[#4a5565]">
            All school announcements and upcoming activities.
          </p>
        </div>

        {loading && <p className="text-gray-600">Loading events…</p>}

        {!loading && events.length === 0 && (
          <div className="rounded-[14px] border bg-white p-10 text-center text-gray-600 shadow-sm">
            No announcements at this time. Please check back later.
          </div>
        )}

        {!loading && events.length > 0 && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const imageSrc = publicAssetUrl(event.imageUrl);
              return (
                <article
                  key={event.id || `${event.date}-${event.title}`}
                  className="overflow-hidden rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {imageSrc ? (
                    <img src={imageSrc} alt={event.title} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-gray-100 text-sm text-gray-400">
                      No image
                    </div>
                  )}
                  <div className="p-6">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="rounded-md bg-[#2d5016]/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#2d5016]">
                        {event.badge}
                      </span>
                      <span className="text-xs tabular-nums text-gray-500">{formatDate(event.date)}</span>
                    </div>
                    <h2 className="mb-2 text-lg font-bold leading-snug text-[#101828]">{event.title}</h2>
                    <p className="text-sm leading-relaxed text-[#4a5565]">{event.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
