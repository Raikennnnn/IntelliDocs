import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import { AnnouncementCarousel, type CarouselAnnouncement } from '../../components/AnnouncementCarousel';
import { Button } from '../../components/ui/button';
import { PublicSectionEyebrow } from '../../components/public/PublicSectionEyebrow';
import { NsdgaCampusStatsBar, NSDGA_STATS_BORDER_SPACER } from '../../components/public/NsdgaCampusStatsBar';
import { NsdgaStepGrid } from '../../components/public/NsdgaStepGrid';
import { StrandShowcaseCard } from '../../components/public/StrandShowcaseCard';
import { BRAND } from '../../lib/publicBrand';
import { STRAND_SHOWCASE_ITEMS } from './strandShowcaseData';
import schoolLogo from '../../../assets/logo.png';
import homePageHeroBg from '../../../assets/homepage-Bxdbuq6s.png';
import {
  BookOpen,
  ChevronDown,
  FileText,
  GraduationCap,
  Heart,
  LayoutDashboard,
  MapPin,
  Monitor,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type LandingAnnouncement = CarouselAnnouncement;

const HERO_STATS: {
  value: string;
  label: string;
  Icon: LucideIcon;
}[] = [
  { value: '6', label: 'SHS Strands', Icon: GraduationCap },
  { value: 'Online', label: 'Enrollment Portal', Icon: Monitor },
  { value: 'Gr. 11 & 12', label: 'Senior High School', Icon: UserPlus },
  { value: 'Marikina', label: 'Campus', Icon: MapPin },
];

const ENROLLMENT_STEPS = [
  {
    step: 1,
    Icon: UserPlus,
    title: 'Register Online',
    description: 'Sign up with your email and set up your student profile on the NSDGA portal.',
  },
  {
    step: 2,
    Icon: GraduationCap,
    title: 'Select Your Strand',
    description: 'Choose an Academic or TVL track aligned with your senior high school goals.',
  },
  {
    step: 3,
    Icon: FileText,
    title: 'Upload Requirements',
    description: 'Submit PSA, report card, good moral, and other documents for registrar review.',
  },
  {
    step: 4,
    Icon: LayoutDashboard,
    title: 'Follow Your Status',
    description: 'Check document decisions, remarks, and enrollment updates in your dashboard.',
  },
] as const;

const SCHOOL_TRAITS = [
  {
    Icon: Heart,
    title: 'Faith & Character',
    description: 'Formation grounded in spiritual and ethical values for every learner.',
  },
  {
    Icon: BookOpen,
    title: 'Academic & TVL Tracks',
    description: 'ASSH, BAE, STEM, and TECHPRO (CP, IT, HT) pathways under one SHS program.',
  },
  {
    Icon: ShieldCheck,
    title: 'Registrar Support',
    description: 'Clear enrollment steps with school staff guiding you through admission.',
  },
] as const;

const FAQ_ITEMS = [
  {
    q: 'Who can apply for Senior High School at NSDGA?',
    a: 'Incoming Grade 11 students and qualified transferees may apply. Create a portal account, complete your profile, and submit the required documents online.',
  },
  {
    q: 'What documents should I prepare?',
    a: 'Commonly PSA birth certificate, report card (SF9), Form 137 (SF10), good moral certificate, and 2×2 ID picture. See Admissions for the full list by applicant type.',
  },
  {
    q: 'How will I know if my application was approved?',
    a: 'Sign in to the student portal to view document review results, registrar remarks, and enrollment status updates.',
  },
] as const;

export function LandingPage() {
  const [announcements, setAnnouncements] = useState<LandingAnnouncement[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/announcements?scope=landing', { credentials: 'include' });
        const data = await res.json();
        if (!data?.success || !Array.isArray(data.announcements)) return;
        const mapped: LandingAnnouncement[] = data.announcements.map((a: Record<string, unknown>) => ({
          id: String(a.id ?? ''),
          date: String(a.date ?? ''),
          badge: String(a.badge ?? 'Announcement'),
          title: String(a.title ?? ''),
          body: String(a.body ?? ''),
          imageUrl: a.imageUrl ? String(a.imageUrl) : null,
        }));
        setAnnouncements(mapped);
      } catch {
        // Leave the carousel empty when the API is unreachable.
      }
    })();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <LandingNavbar />

      <div className="relative">
        {/* Hero — background anchored high so campus illustration stays visible */}
        <section className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <img
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[center_18%] sm:object-[center_22%] lg:object-[center_26%]"
              src={homePageHeroBg}
            />
            <div className="absolute inset-0 bg-black/45" />
            <div
              className="absolute inset-0 opacity-80"
              style={{
                background: `linear-gradient(105deg, ${BRAND.maroon}99 0%, transparent 42%, ${BRAND.green}66 100%)`,
              }}
            />
          </div>

          <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-4 pb-12 pt-20 sm:px-6 sm:pt-24 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/80 sm:text-base">
                Welcome to
              </p>
              <h1 className="mb-3 text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl lg:text-[3.25rem]">
                Nuestra Señora De Guia Academy Marikina
              </h1>
              <p className="mb-4 text-xl font-semibold sm:text-2xl" style={{ color: BRAND.heroAccent }}>
                Senior High School
              </p>
              <p className="max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
                Values-driven education with online enrollment — apply, submit documents, and track
                your admission with the NSDGA registrar.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div>
                  <Button
                    asChild
                    className="h-12 rounded-lg px-8 text-base font-semibold hover:opacity-95"
                    style={{ backgroundColor: BRAND.maroon }}
                  >
                    <Link to="/registration">Apply Now</Link>
                  </Button>
                <p className="mt-2 text-xs" style={{ color: BRAND.heroAccent }}>
                  Not yet enrolled?
                </p>
                </div>
                <div>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-lg border-white bg-white/90 px-8 text-base font-semibold hover:bg-white"
                    style={{ color: BRAND.maroon }}
                  >
                    <Link to="/login">Login</Link>
                  </Button>
                <p className="mt-2 text-xs" style={{ color: BRAND.heroAccent }}>
                  For students with portal access
                </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <NsdgaCampusStatsBar stats={HERO_STATS} onBorder revealOnScroll />
      </div>

      {/* Enrollment steps */}
      <section id="how-it-works" className={`bg-white pb-14 sm:pb-20 ${NSDGA_STATS_BORDER_SPACER}`}>
        <div className="section-container">
          <PublicSectionEyebrow>Enrollment</PublicSectionEyebrow>
          <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
            How to enroll at NSDGA
          </h2>
          <p className="mt-3 max-w-2xl text-base" style={{ color: BRAND.slate }}>
            Four registrar-guided steps from online registration to enrollment tracking.
          </p>
          <div className="mt-10">
            <NsdgaStepGrid steps={[...ENROLLMENT_STEPS]} />
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: BRAND.surface }}>
        <div className="section-container">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <PublicSectionEyebrow>About NSDGA</PublicSectionEyebrow>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl" style={{ color: BRAND.maroon }}>
                Educating with purpose since Marikina.
              </h2>
              <p className="mt-4 text-base leading-relaxed" style={{ color: BRAND.slate }}>
                Nuestra Señora De Guia Academy develops the whole child — academically, morally,
                and spiritually — so graduates are ready for higher education, skills training, and
                service to the community.
              </p>
              <div
                className="mt-6 flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm"
                style={{ borderColor: `${BRAND.green}40` }}
              >
                <MapPin className="mt-0.5 size-5 shrink-0" style={{ color: BRAND.green }} aria-hidden />
                <div>
                  <p className="text-sm font-semibold" style={{ color: BRAND.ink }}>
                    Campus & Registrar
                  </p>
                  <p className="mt-1 text-sm" style={{ color: BRAND.slate }}>
                    96 Soliven St., Greenheights Subd., Ph. 3, Nangka, Marikina City
                  </p>
                  <Link
                    to="/contact"
                    className="mt-2 inline-block text-sm font-semibold hover:underline"
                    style={{ color: BRAND.maroon }}
                  >
                    Contact us →
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {SCHOOL_TRAITS.map(({ Icon, title, description }, i) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-[14px] border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div
                    className="flex size-12 shrink-0 items-center justify-center rounded-[10px]"
                    style={{ backgroundColor: i % 2 === 0 ? BRAND.maroon : BRAND.green }}
                  >
                    <Icon className="size-6 text-white" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-bold" style={{ color: BRAND.ink }}>
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: BRAND.slate }}>
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Announcements */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: BRAND.surface }}>
        <div className="section-container">
          <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <PublicSectionEyebrow>News & Events</PublicSectionEyebrow>
              <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
                Announcements & Events
              </h2>
              <p className="mt-2 text-base" style={{ color: BRAND.slate }}>
                Stay updated with the latest school updates and activities.
              </p>
            </div>
            <Link
              to="/events"
              className="inline-flex items-center text-sm font-semibold hover:underline"
              style={{ color: BRAND.maroon }}
            >
              View all events →
            </Link>
          </div>

          <AnnouncementCarousel items={announcements} imageHeightClass="h-72 md:h-96" />
        </div>
      </section>

      {/* Strands */}
      <section className="bg-white py-14 sm:py-20">
        <div className="section-container">
          <PublicSectionEyebrow>Senior High School</PublicSectionEyebrow>
          <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
            Academic Strands
          </h2>
          <p className="mt-3 max-w-2xl text-base" style={{ color: BRAND.slate }}>
            Choose your path — Academic and TVL tracks.
          </p>
          <div className="mt-10 grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STRAND_SHOWCASE_ITEMS.map((strand) => (
              <StrandShowcaseCard key={strand.slug} strand={strand} />
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/admissions"
              className="inline-flex h-12 items-center justify-center rounded-lg border-2 border-[#8b1538] bg-white px-8 text-base font-semibold text-[#8b1538] shadow-sm transition-colors hover:bg-[#8b1538]/5"
            >
              View admissions requirements
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: BRAND.surface }}>
        <div className="section-container">
          <div className="mx-auto max-w-3xl text-center">
            <PublicSectionEyebrow>Admissions</PublicSectionEyebrow>
            <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group rounded-[14px] border border-gray-200 bg-white p-5 shadow-sm open:shadow-md"
                style={{ borderLeftWidth: 4, borderLeftColor: BRAND.green }}
              >
                <summary className="cursor-pointer list-none font-semibold marker:content-none [&::-webkit-details-marker]:hidden" style={{ color: BRAND.ink }}>
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <ChevronDown
                      className="size-5 shrink-0 transition-transform group-open:rotate-180"
                      style={{ color: BRAND.maroon }}
                      aria-hidden
                    />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: BRAND.slate }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: BRAND.maroon }}>
        <div className="section-container text-center">
          <img src={schoolLogo} alt="" className="mx-auto mb-5 size-16 object-contain" />
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to enroll?</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/85 sm:text-lg">
            Start your Senior High application online — the registrar will guide you through each step.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-lg bg-white px-8 hover:bg-gray-100"
              style={{ color: BRAND.maroon }}
            >
              <Link to="/registration">Apply Now</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-lg border-white/70 bg-transparent px-8 text-white hover:bg-white/10"
            >
              <Link to="/admissions">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
