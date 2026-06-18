import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import { PublicPageHero } from '../../components/public/PublicPageHero';
import { PublicSectionEyebrow } from '../../components/public/PublicSectionEyebrow';
import { BRAND } from '../../lib/publicBrand';
import aboutPageHero from '../../../assets/aboutpage-C52rUoUG.png';
import schoolLogo from '../../../assets/logo.png';
import svgPaths from '../../../imports/svg-avo07mw5zs';
import { Button } from '../../components/ui/button';

export function AboutPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <LandingNavbar />

      <PublicPageHero
        eyebrow="Our School"
        title="About Nuestra Señora De Guia Academy"
        description="A non-sectarian school in Marikina committed to the holistic development of every child — academically, morally, and spiritually."
        imageSrc={aboutPageHero}
        imageAlt="NSDGA campus"
      />

      <section className="section-container py-14 sm:py-20" style={{ backgroundColor: BRAND.surface }}>
        <div
          className="rounded-[14px] border p-6 sm:p-10"
          style={{
            borderColor: `${BRAND.maroon}33`,
            background: `linear-gradient(135deg, ${BRAND.maroon}08 0%, ${BRAND.green}06 100%)`,
          }}
        >
          <PublicSectionEyebrow>Who We Are</PublicSectionEyebrow>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
            <div className="flex shrink-0 items-center gap-4 lg:flex-col lg:items-start">
              <img src={schoolLogo} alt="" className="size-20 object-contain sm:size-24" />
              <div>
                <p className="text-2xl font-bold sm:text-3xl" style={{ color: BRAND.maroon }}>
                  NSDGA
                </p>
                <p className="text-sm font-semibold" style={{ color: BRAND.green }}>
                  Academy of Marikina
                </p>
              </div>
            </div>
            <div className="space-y-4 text-base leading-relaxed" style={{ color: BRAND.slate }}>
              <p>
                <strong style={{ color: BRAND.ink }}>Nuestra Señora De Guia Academy of Marikina</strong>{' '}
                is a non-sectarian school centered on the child&apos;s total personality development
                with spiritual and ethical values, in honor of our patron, Nuestra Señora De Guia.
              </p>
              <p>
                Inspired by <strong>Proverbs 22:6</strong> — &ldquo;Train up a child in the way he
                should go&rdquo; — we emphasize holistic growth. The child is the centerpiece of our
                foundation, and we commit to quality education in the service of humanity and God.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-container py-14 sm:py-20">
        <div className="mb-10 text-center">
          <PublicSectionEyebrow>Our Direction</PublicSectionEyebrow>
          <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
            Mission & Vision
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div
            className="rounded-[14px] border border-gray-200 bg-white p-8 shadow-[0px_4px_6px_rgba(0,0,0,0.06)]"
            style={{ borderTopWidth: 4, borderTopColor: BRAND.maroon }}
          >
            <div className="mb-6 flex items-center gap-4">
              <div
                className="flex size-16 items-center justify-center rounded-full"
                style={{ backgroundColor: BRAND.maroon }}
              >
                <svg className="size-8" fill="none" viewBox="0 0 32 32" aria-hidden>
                  <g>
                    <path d={svgPaths.p2eeb1a00} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d={svgPaths.p12cd9a80} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d={svgPaths.p68ddbf0} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                  </g>
                </svg>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: BRAND.ink }}>
                Mission
              </h2>
            </div>
            <p className="text-base leading-relaxed" style={{ color: BRAND.slate }}>
              Nuestra Señora De Guia Academy of Marikina shall provide quality education to prepare
              young children to harness their full intellectual capabilities that will aid them to
              effectively plot the paths they wish to stride later in life.
            </p>
          </div>

          <div
            className="rounded-[14px] border border-gray-200 bg-white p-8 shadow-[0px_4px_6px_rgba(0,0,0,0.06)]"
            style={{ borderTopWidth: 4, borderTopColor: BRAND.green }}
          >
            <div className="mb-6 flex items-center gap-4">
              <div
                className="flex size-16 items-center justify-center rounded-full"
                style={{ backgroundColor: BRAND.green }}
              >
                <svg className="size-8" fill="none" viewBox="0 0 32 32" aria-hidden>
                  <g>
                    <path d={svgPaths.p1e55af00} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d={svgPaths.p3dc23ac0} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                  </g>
                </svg>
              </div>
              <h2 className="text-2xl font-bold" style={{ color: BRAND.ink }}>
                Vision
              </h2>
            </div>
            <p className="text-base leading-relaxed" style={{ color: BRAND.slate }}>
              Nuestra Señora De Guia Academy of Marikina shall be the epitome of{' '}
              <strong>academic excellence</strong> by providing quality education relevant to the
              changing needs of society.
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-14 sm:py-20" style={{ backgroundColor: BRAND.maroon }}>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-2 sm:w-3" style={{ backgroundColor: BRAND.green }} aria-hidden />
        <div className="section-container relative text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Explore NSDGA</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/90">
            Learn about admissions, senior high strands, and how to reach the registrar.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 bg-white px-8 hover:bg-gray-100" style={{ color: BRAND.maroon }}>
              <Link to="/admissions">View Admissions</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 border-white/70 bg-transparent px-8 text-white hover:bg-white/10">
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
