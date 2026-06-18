import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import { PublicPageHero } from '../../components/public/PublicPageHero';
import { PublicSectionEyebrow } from '../../components/public/PublicSectionEyebrow';
import { Button } from '../../components/ui/button';
import { BRAND } from '../../lib/publicBrand';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';

const CONTACT_ITEMS = [
  {
    Icon: MapPin,
    title: 'School Address',
    accent: 'maroon' as const,
    body: (
      <>
        <strong>Nuestra Señora De Guia Academy</strong>
        <br />
        96 Soliven St., Greenheights Subd., Ph. 3, Nangka, Marikina City, Philippines
      </>
    ),
  },
  {
    Icon: Clock,
    title: 'Office Hours',
    accent: 'green' as const,
    body: (
      <>
        <strong>Monday – Friday</strong>
        <br />
        8:00 AM – 5:00 PM
      </>
    ),
  },
  {
    Icon: Phone,
    title: 'Phone',
    accent: 'maroon' as const,
    body: (
      <>
        Registrar &amp; general inquiries
        <br />
        <strong>535-4384 | 719-3744</strong>
      </>
    ),
  },
  {
    Icon: Mail,
    title: 'Email',
    accent: 'green' as const,
    body: (
      <>
        Send your questions anytime
        <br />
        <strong>nsdga.gh@gmail.com</strong>
        <br />
        <span className="text-sm">registrar@nsdga.edu.ph</span>
      </>
    ),
  },
] as const;

export function ContactPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <LandingNavbar />

      <PublicPageHero
        eyebrow="Get In Touch"
        title="Contact Us"
        description="Reach the NSDGA Registrar for enrollment questions, document concerns, and campus inquiries."
      />

      <section className="section-container py-14 sm:py-20" style={{ backgroundColor: BRAND.surface }}>
        <div className="mb-10 text-center">
          <PublicSectionEyebrow>Registrar&apos;s Office</PublicSectionEyebrow>
          <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
            We&apos;re Here to Help
          </h2>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          {CONTACT_ITEMS.map(({ Icon, title, accent, body }) => {
            const color = accent === 'maroon' ? BRAND.maroon : BRAND.green;
            return (
              <div
                key={title}
                className="flex gap-4 rounded-[14px] border border-gray-200 bg-white p-6 shadow-sm"
                style={{ borderTopWidth: 4, borderTopColor: color }}
              >
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="size-6 text-white" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: BRAND.ink }}>
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: BRAND.slate }}>
                    {body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section-container py-14 sm:py-16">
        <div
          className="mx-auto max-w-3xl rounded-[14px] border p-8 text-center sm:p-10"
          style={{
            borderColor: `${BRAND.green}40`,
            background: `linear-gradient(135deg, ${BRAND.green}08 0%, ${BRAND.maroon}06 100%)`,
          }}
        >
          <PublicSectionEyebrow>Enrollment Support</PublicSectionEyebrow>
          <h2 className="text-2xl font-bold sm:text-3xl" style={{ color: BRAND.maroon }}>
            Ready to apply?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm sm:text-base" style={{ color: BRAND.slate }}>
            Create your portal account to start senior high enrollment, or visit us during office
            hours for in-person assistance.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild className="rounded-[8px]" style={{ backgroundColor: BRAND.maroon }}>
              <Link to="/registration">Apply Now</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-[8px]"
              style={{ borderColor: BRAND.green, color: BRAND.green }}
            >
              <Link to="/admissions">Admissions Guide</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-14 sm:py-16" style={{ backgroundColor: BRAND.maroon }}>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-2 sm:w-3" style={{ backgroundColor: BRAND.green }} aria-hidden />
        <div className="section-container relative text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Visit During Office Hours</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/90">
            Our staff can walk you through requirements, strands, and enrollment steps in person.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
