import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import imgImageNuestraSenoraDeGuiaAcademy from '../../../assets/logo.png';
import homePageHero from '../../../assets/homepage-Bxdbuq6s.png';
import svgPaths from '../../../imports/svg-01fncooay9';
import { useEffect, useState } from 'react';
import { AnnouncementCarousel, type CarouselAnnouncement } from '../../components/AnnouncementCarousel';

type LandingAnnouncement = CarouselAnnouncement;

export function LandingPage() {
  const [announcements, setAnnouncements] = useState<LandingAnnouncement[]>([]);

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
        setAnnouncements(mapped);
      } catch {
        // Leave the carousel empty when the API is unreachable.
      }
    })();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <LandingNavbar />

      {/* Hero — full viewport below nav */}
      <section className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            alt="Hero Background"
            className="absolute h-full min-h-full w-full object-cover"
            src={homePageHero}
          />
        </div>

        <div className="absolute inset-0 bg-black/40" aria-hidden />

        <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl py-8 sm:py-12">
            <p className="mb-3 text-base font-semibold text-white sm:mb-4 sm:text-xl">
              WELCOME TO
            </p>
            <h1 className="mb-4 text-3xl font-bold leading-tight text-white sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl">
              Nuestra Señora De Guia Academy Marikina
            </h1>
            <p className="mb-8 text-lg font-semibold text-white sm:mb-12 sm:text-2xl">
              Senior High School
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
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
      <section className="bg-gray-50 py-10 sm:py-16">
        <div className="section-container">
          <div className="mb-8 sm:mb-10">
            <Link
              to="/events"
              className="group -m-2 inline-block rounded-lg p-2 transition-colors hover:bg-white/60"
            >
              <h2 className="text-2xl font-bold leading-tight text-[#8b1538] group-hover:underline sm:text-3xl lg:text-4xl">
                Announcements & Events
              </h2>
              <p className="mt-2 text-sm text-[#4a5565] sm:text-base">
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
      <section className="bg-white py-10 sm:py-16">
        <div className="section-container">
          <div className="mb-8 text-center sm:mb-12">
            <h2 className="mb-3 text-2xl font-bold text-[#8b1538] sm:mb-4 sm:text-3xl lg:text-4xl">
              Academic Strands
            </h2>
            <p className="text-sm text-[#4a5565] sm:text-base">
              Choose your path to success
            </p>
            <p className="mt-2 text-sm text-[#6b7280]">
              Select a strand to read more about the program.
            </p>
          </div>

          {/* Strands Grid — unified maroon accent; each strand links to detail page */}
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 md:gap-8">
            {/* Academic Track */}
            <div className="rounded-[14px] border border-gray-200 bg-white p-5 shadow-lg sm:p-8">
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
            <div className="rounded-[14px] border border-gray-200 bg-white p-5 shadow-lg sm:p-8">
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
      <section className="bg-[#8b1538] py-10 sm:py-16">
        <div className="section-container text-center">
          <h2 className="mb-3 text-2xl font-bold text-white sm:mb-4 sm:text-3xl lg:text-4xl">
            Ready to Begin Your Journey?
          </h2>
          <p className="mb-6 text-base text-[#e5e7eb] sm:mb-8 sm:text-lg">
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