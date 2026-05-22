import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import imgImageNuestraSenoraDeGuiaAcademy from '../../../assets/logo.png';
import homePageHero from '../../../assets/homepage-Bxdbuq6s.png';
import svgPaths from '../../../imports/svg-01fncooay9';
import { useEffect, useState } from 'react';
import { AnnouncementCarousel, type CarouselAnnouncement } from '../../components/AnnouncementCarousel';

type LandingAnnouncement = CarouselAnnouncement;

export function LandingPage() {
  const fallbackAnnouncements = [
    {
      date: 'May 10, 2026',
      badge: 'Announcement',
      title: 'Enrollment for SY 2026–2027 is now open',
      body: 'Submit your application and upload the required documents through the student portal.',
    },
    {
      date: 'May 15, 2026',
      badge: 'Event',
      title: 'Senior High Orientation (Incoming Grade 11)',
      body: 'Orientation will be held in the school auditorium. Attendance is encouraged for students and guardians.',
    },
    {
      date: 'May 20, 2026',
      badge: 'Reminder',
      title: 'Document verification schedule',
      body: 'Registrars will prioritize applications with complete uploads. Please ensure files are clear and readable.',
    },
  ] as const;

  const [announcements, setAnnouncements] = useState<LandingAnnouncement[]>([...fallbackAnnouncements]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/announcements?scope=landing', { credentials: 'include' });
        const data = await res.json();
        if (!data?.success || !Array.isArray(data.announcements)) return;
        const mapped: LandingAnnouncement[] = data.announcements.map((a: any) => ({
          id: String(a.id ?? ''),
          date: String(a.date ?? ''),
          badge: String(a.badge ?? 'Announcement'),
          title: String(a.title ?? ''),
          body: String(a.body ?? ''),
          imageUrl: a.imageUrl ? String(a.imageUrl) : null,
        }));
        if (mapped.length > 0) {
          setAnnouncements(mapped);
        }
      } catch {
        // keep fallbackAnnouncements
      }
    })();
  }, []);

  return (
    <div className="bg-white min-h-screen">
      {/* Navigation */}
      <div className="bg-[rgba(255,255,255,0.95)] h-[64px] shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)] sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between px-8">
          {/* Logo */}
          {/* TODO: Replace with official NSGDA logo image */}
          <Link to="/landing" className="flex items-center gap-3">
            <div className="size-[40px]">
              <img 
                alt="School Logo" 
                className="w-full h-full object-contain" 
                src={imgImageNuestraSenoraDeGuiaAcademy} 
              />
            </div>
            <div>
              <p className="font-bold text-[18px] text-[#8b1538] leading-tight">
                Nuestra Señora De Guia
              </p>
              <p className="font-semibold text-[12px] text-[#2d5016]">
                Academy of Marikina
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-8">
            <Link to="/landing" className="font-medium text-[16px] text-[#364153] hover:text-[#8b1538]">
              Home
            </Link>
            <Link to="/about" className="font-medium text-[16px] text-[#364153] hover:text-[#8b1538]">
              About
            </Link>
            <Link to="/admissions" className="font-medium text-[16px] text-[#364153] hover:text-[#8b1538]">
              Admissions
            </Link>
            <Link to="/contact" className="font-medium text-[16px] text-[#364153] hover:text-[#8b1538]">
              Contact Us
            </Link>
            <Link to="/login">
              <div className="bg-[#2d5016] h-[36px] rounded-[8px] px-6 flex items-center justify-center hover:bg-[#2d5016]/90 transition-colors">
                <p className="font-medium text-[14px] text-white">Login</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Hero: fills the rest of the first screen (viewport minus 64px nav) */}
      <section className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img 
            alt="Hero Background" 
            className="absolute h-full min-h-full w-full object-cover" 
            src={homePageHero} 
          />
        </div>

        {/* Light burgundy wash — same deep-red family as the login page (rgba(72,0,21)), much softer for the homepage */}
        <div className="absolute inset-0 bg-[rgba(72,0,21,0.22)]" aria-hidden />

        {/* Hero Content — original top offset preserved */}
        <div className="relative z-[1] h-full max-w-[1280px] mx-auto px-8 [&_h1]:drop-shadow-[0_2px_28px_rgba(0,0,0,0.28)] [&_p]:drop-shadow-[0_1px_14px_rgba(0,0,0,0.25)]">
          <div className="pt-[90px] max-w-[768px]">
            <p className="font-semibold text-[20px] text-white leading-[28px] mb-4">
              WELCOME TO
            </p>
            <h1 className="font-bold text-[60px] text-white leading-[75px] mb-6 max-w-[672px]">
              Nuestra Señora De Guia Academy Marikina
            </h1>
            <p className="font-semibold text-[24px] text-white leading-[32px] mb-12">
              Senior High School
            </p>

            {/* CTA Buttons */}
            <div className="flex gap-4">
              <div>
                <Link to="/admissions">
                  <div className="bg-[#8b1538] h-[48px] rounded-[8px] px-6 flex items-center justify-center hover:bg-[#8b1538]/90 transition-colors">
                    <p className="font-medium text-[18px] text-white">Apply Now</p>
                  </div>
                </Link>
                <p className="font-normal text-[12px] text-[#d1d5dc] leading-[16px] mt-2">
                  Not yet enrolled?
                </p>
              </div>

              <div>
                <Link to="/login">
                  <div className="bg-[rgba(255,255,255,0.9)] border border-white h-[50px] rounded-[8px] px-6 flex items-center justify-center hover:bg-white transition-colors">
                    <p className="font-medium text-[18px] text-[#8b1538]">Login</p>
                  </div>
                </Link>
                <p className="font-normal text-[12px] text-[#d1d5dc] leading-[16px] mt-2">For already have portal access</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Announcements & Events */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-[1280px] mx-auto px-8">
          <div className="mb-10">
            <Link
              to="/events"
              className="group inline-block rounded-lg transition-colors hover:bg-white/60 -m-2 p-2"
            >
              <h2 className="font-bold text-[36px] text-[#8b1538] leading-[40px] group-hover:underline">
                Announcements & Events
              </h2>
              <p className="mt-2 text-[16px] text-[#4a5565] leading-[24px]">
                Stay updated with the latest school updates and activities.
              </p>
              <p className="mt-2 text-sm font-semibold text-[#8b1538] group-hover:underline">
                View all events →
              </p>
            </Link>
          </div>

          <AnnouncementCarousel items={announcements} imageHeightClass="h-72 md:h-96" />
        </div>
      </section>

      {/* Academic Strands Section */}
      <section className="bg-white py-16">
        <div className="max-w-[1280px] mx-auto px-8">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="font-bold text-[36px] text-[#8b1538] leading-[40px] mb-4">
              Academic Strands
            </h2>
            <p className="font-normal text-[16px] text-[#4a5565] leading-[24px]">
              Choose your path to success
            </p>
            <p className="mt-2 text-sm text-[#6b7280]">
              Select a strand to read more about the program.
            </p>
          </div>

          {/* Strands Grid — unified maroon accent; each strand links to detail page */}
          <div className="grid md:grid-cols-2 gap-8 max-w-[1106px] mx-auto">
            {/* Academic Track */}
            <div className="rounded-[14px] border border-gray-200 bg-white p-8 shadow-lg">
              <div className="mb-6 flex size-[64px] items-center justify-center rounded-[10px] bg-[#2d5016]">
                <svg className="size-[32px]" fill="none" viewBox="0 0 32 32">
                  <g>
                    <path d={svgPaths.p27718b80} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d="M29.323 13.329V21.326" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d={svgPaths.p291942c0} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                  </g>
                </svg>
              </div>

              <h3 className="mb-4 text-[24px] font-bold leading-[32px] text-[#2d5016]">Academic Track</h3>
              <div className="space-y-2">
                <Link
                  to="/admissions/strands/humss"
                  className="block p-3 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2 rounded-xl"
                >
                  <p className="mb-1 text-[14px] font-bold text-[#101828]">
                    Humanities and Social Sciences (HUMSS)
                  </p>
                  <p className="text-[13px] font-normal leading-[20px] text-[#4a5565]">
                    Focuses on human behavior, societal structures, and communication arts.
                  </p>
                </Link>
                <Link
                  to="/admissions/strands/abm"
                  className="block p-3 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2 rounded-xl"
                >
                  <p className="mb-1 text-[14px] font-bold text-[#101828]">
                    Accountancy, Business, and Management (ABM)
                  </p>
                  <p className="text-[13px] font-normal leading-[20px] text-[#4a5565]">
                    Ideal for students aiming for careers in business and entrepreneurship.
                  </p>
                </Link>
                <Link
                  to="/admissions/strands/stem"
                  className="block p-3 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2 rounded-xl"
                >
                  <p className="mb-1 text-[14px] font-bold text-[#101828]">
                    Science, Technology, Engineering, and Mathematics (STEM)
                  </p>
                  <p className="text-[13px] font-normal leading-[20px] text-[#4a5565]">
                    Designed for students pursuing careers in engineering, medicine, and IT.
                  </p>
                </Link>
              </div>
            </div>

            {/* TVL Track */}
            <div className="rounded-[14px] border border-gray-200 bg-white p-8 shadow-lg">
              <div className="mb-6 flex size-[64px] items-center justify-center rounded-[10px] bg-[#2d5016]">
                <svg className="size-[32px]" fill="none" viewBox="0 0 32 32">
                  <g>
                    <path d={svgPaths.p27718b80} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d="M29.323 13.329V21.326" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d={svgPaths.p291942c0} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                  </g>
                </svg>
              </div>

              <h3 className="mb-4 text-[24px] font-bold leading-[32px] text-[#2d5016]">
                Technical-Vocational-Livelihood (TVL)
              </h3>
              <div className="space-y-2">
                <Link
                  to="/admissions/strands/ict"
                  className="block p-3 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2 rounded-xl"
                >
                  <p className="mb-1 text-[14px] font-bold text-[#101828]">
                    Information and Communications Technology (ICT)
                  </p>
                  <p className="text-[13px] font-normal leading-[20px] text-[#4a5565]">
                    Focuses on computer systems, programming, and digital technologies.
                  </p>
                </Link>
                <Link
                  to="/admissions/strands/eim"
                  className="block p-3 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2 rounded-xl"
                >
                  <p className="mb-1 text-[14px] font-bold text-[#101828]">
                    Electrical Installation and Maintenance (EIM)
                  </p>
                  <p className="text-[13px] font-normal leading-[20px] text-[#4a5565]">
                    Covers electrical wiring, troubleshooting, and maintenance systems.
                  </p>
                </Link>
                <Link
                  to="/admissions/strands/bpp-fbs"
                  className="block p-3 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2 rounded-xl"
                >
                  <p className="mb-1 text-[14px] font-bold text-[#101828]">
                    Bread and Pastry Production / Food and Beverages Services (BPP/FBS)
                  </p>
                  <p className="text-[13px] font-normal leading-[20px] text-[#4a5565]">
                    Training in culinary arts, baking, and hospitality services.
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#8b1538] py-16">
        <div className="max-w-[1280px] mx-auto px-8 text-center">
          <h2 className="font-bold text-[36px] text-white leading-[40px] mb-4">
            Ready to Begin Your Journey?
          </h2>
          <p className="font-normal text-[18px] text-[#e5e7eb] leading-[28px] mb-8">
            Join our community of learners committed to excellence and values-driven education.
          </p>
          <Link to="/admissions">
            <div className="bg-white h-[48px] rounded-[8px] px-8 inline-flex items-center justify-center hover:bg-gray-100 transition-colors">
              <p className="font-medium text-[18px] text-[#8b1538]">Learn More</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}