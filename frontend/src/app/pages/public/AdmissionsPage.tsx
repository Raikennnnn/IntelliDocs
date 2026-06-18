import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import { PublicPageHero } from '../../components/public/PublicPageHero';
import { PublicSectionEyebrow } from '../../components/public/PublicSectionEyebrow';
import { StrandShowcaseCard } from '../../components/public/StrandShowcaseCard';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { BRAND } from '../../lib/publicBrand';
import { STRAND_SHOWCASE_ITEMS } from './strandShowcaseData';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { cn } from '../../components/ui/utils';
import {
  FileText,
  CheckCircle,
  Users,
} from 'lucide-react';

import applicationFormSample from '../../assets/admission-samples/application-form.svg';
import reportCardSf9Sample from '../../assets/admission-samples/report-card-sf9.svg';
import sf10Form137Sample from '../../assets/admission-samples/sf10-form137.svg';
import psaBirthSample from '../../assets/admission-samples/psa-birth-certificate.svg';
import idPictureSample from '../../assets/admission-samples/id-picture-2x2.svg';
import goodMoralSample from '../../assets/admission-samples/good-moral-certificate.svg';
import transcriptTorSample from '../../assets/admission-samples/transcript-tor.svg';

/**
 * Photos can be served two ways:
 * 1) Put JPG/PNG/WebP in `src/app/assets/admission-samples/` (same base name as `slug`) — Vite bundles them; works even when the site is under a subpath (e.g. XAMPP).
 * 2) Put files in `public/admission-samples/` — URLs use BASE_URL. If images 404, set env `VITE_ADMISSION_SAMPLES_BASE` to the folder that contains `admission-samples` (e.g. `/IntelliDocs/frontend/dist/`).
 */
const ADMISSION_PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

const BUNDLED_ADMISSION_PHOTOS = import.meta.glob(
  '../../assets/admission-samples/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  { eager: true, import: 'default' },
) as Record<string, string>;

function bundledPhotoUrlForSlug(slug: string): string | undefined {
  for (const [fullPath, url] of Object.entries(BUNDLED_ADMISSION_PHOTOS)) {
    const file = fullPath.replace(/\\/g, '/').split('/').pop() ?? '';
    const base = file.replace(/\.(jpe?g|png|webp)$/i, '');
    if (base === slug) return url;
  }
  return undefined;
}

function admissionPhotoBaseUrl(): string {
  const env = import.meta.env as { BASE_URL: string; VITE_ADMISSION_SAMPLES_BASE?: string };
  const override = (env.VITE_ADMISSION_SAMPLES_BASE ?? '').trim();
  const base = override.length > 0 ? override : env.BASE_URL;
  return base.endsWith('/') ? base : `${base}/`;
}

function AdmissionSampleImage({
  slug,
  fallbackSrc,
  alt,
  className,
  imgClassName,
}: {
  slug: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const bundledUrl = bundledPhotoUrlForSlug(slug);
  const [skipBundled, setSkipBundled] = useState(false);
  const [formatIndex, setFormatIndex] = useState(0);

  useEffect(() => {
    setSkipBundled(false);
    setFormatIndex(0);
  }, [slug]);

  const publicUrl = (extIndex: number) =>
    `${admissionPhotoBaseUrl()}admission-samples/${slug}.${ADMISSION_PHOTO_EXTENSIONS[extIndex]}`;

  const src =
    bundledUrl && !skipBundled
      ? bundledUrl
      : formatIndex < ADMISSION_PHOTO_EXTENSIONS.length
        ? publicUrl(formatIndex)
        : fallbackSrc;

  const handleError = () => {
    if (bundledUrl && !skipBundled) {
      setSkipBundled(true);
      setFormatIndex(0);
      return;
    }
    setFormatIndex((i) => (i < ADMISSION_PHOTO_EXTENSIONS.length ? i + 1 : i));
  };

  return (
    <span className={className ?? 'inline-block max-w-full'}>
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        onError={handleError}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

const admissionRequirements = [
  { label: 'Completed Application Form', slug: 'application-form', fallbackSrc: applicationFormSample },
  { label: 'Copy of Report Card (Form 9 / SF9)', slug: 'report-card-sf9', fallbackSrc: reportCardSf9Sample },
  { label: 'SF10 / Form 137', slug: 'sf10-form137', fallbackSrc: sf10Form137Sample },
  { label: 'PSA Birth Certificate', slug: 'psa-birth-certificate', fallbackSrc: psaBirthSample },
  { label: '2×2 ID Picture', slug: 'id-picture-2x2', fallbackSrc: idPictureSample },
  { label: 'Certificate of Good Moral Character', slug: 'good-moral-certificate', fallbackSrc: goodMoralSample },
  {
    label: 'Transcript of Records (TOR) - for transferee only',
    slug: 'transcript-tor',
    fallbackSrc: transcriptTorSample,
  },
] as const;

export function AdmissionsPage() {
  const [selectedRequirementIndex, setSelectedRequirementIndex] = useState<number | null>(null);
  const [sampleLightboxOpen, setSampleLightboxOpen] = useState(false);

  const enrollmentSteps = [
    {
      step: 1,
      title: 'Create an Account',
      description:
        'Register for a new account by providing your basic information and creating login credentials.',
      to: '/registration',
    },
    {
      step: 2,
      title: 'Login to Your Account',
      description: 'Access your student portal using your registered email and password.',
      to: '/login',
    },
    {
      step: 3,
      title: 'Fill Up Enrollment Forms',
      description:
        'Complete all required enrollment forms with accurate personal and academic information.',
      to: '/student/enrollment?step=1',
    },
    {
      step: 4,
      title: 'Submit Application & Documents',
      description:
        'Upload and submit all required documents including Birth Certificate, Good Moral, SF9, SF10/Form 137, and TOR.',
      to: '/student/enrollment?step=4',
    },
    {
      step: 5,
      title: 'Document Verification',
      description: "Your submitted documents will be verified by the Registrar's Office.",
      to: '/student/application-status',
    },
    {
      step: 6,
      title: 'Await Confirmation',
      description:
        "Wait for enrollment confirmation and further instructions from the Registrar's Office.",
      to: '/student/application-status',
    },
  ] as const;

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <LandingNavbar />

      <PublicPageHero
        eyebrow="Senior High School"
        title="Admissions"
        description="We welcome students committed to academic growth and values-driven education. Explore our SHS strands, requirements, and online enrollment process."
      />

      {/* Offered Programs */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: BRAND.surface }}>
        <div className="section-container">
          <div className="mb-12 text-center">
            <PublicSectionEyebrow>S.Y. 2025–2026</PublicSectionEyebrow>
            <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
              Offered Programs
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base" style={{ color: BRAND.slate }}>
              Six senior high strands across Academic and TVL tracks. Select a program to read careers,
              subjects, and further study options.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STRAND_SHOWCASE_ITEMS.map((strand) => (
              <StrandShowcaseCard key={strand.slug} strand={strand} />
            ))}
          </div>
        </div>
      </section>

      {/* Admission Requirements */}
      <section className="section-container py-14 sm:py-20">
          <div className="mb-12 text-center">
            <PublicSectionEyebrow>Documents</PublicSectionEyebrow>
            <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
              Admission Requirements
            </h2>
            <p className="mt-3" style={{ color: BRAND.slate }}>
              Applicants must submit the following documents
            </p>
          </div>

          <Card className="mx-auto max-w-5xl shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <p className="text-sm text-gray-500 mb-6 text-center sm:text-left">
                Tap a requirement to see a sample layout. Tap the sample image to enlarge it.
              </p>
              <div className="space-y-5">
                {admissionRequirements.map((requirement, index) => {
                  const isSelected = selectedRequirementIndex === index;
                  return (
                    <div
                      key={requirement.label}
                      className="flex items-start gap-3 rounded-lg border border-transparent p-2 -m-2 transition-colors data-[selected=true]:border-[#8B1538]/20 data-[selected=true]:bg-[#8B1538]/[0.04]"
                      data-selected={isSelected}
                    >
                      <CheckCircle className="w-5 h-5 text-[#2D5016] mt-1 flex-shrink-0" aria-hidden />
                      <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedRequirementIndex((prev) => (prev === index ? null : index))
                          }
                          className={cn(
                            'text-left text-gray-700 underline decoration-transparent decoration-2 underline-offset-2 transition-colors hover:decoration-[#8B1538]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538] focus-visible:ring-offset-2 rounded-sm',
                            isSelected && 'font-semibold text-[#8B1538] decoration-[#8B1538]/30',
                          )}
                          aria-expanded={isSelected}
                          aria-controls={`admission-sample-${index}`}
                        >
                          {requirement.label}
                        </button>
                        {isSelected ? (
                          <div className="flex shrink-0 flex-col gap-2 sm:max-w-[200px]">
                            <button
                              type="button"
                              id={`admission-sample-${index}`}
                              onClick={() => setSampleLightboxOpen(true)}
                              className="group relative w-full overflow-hidden rounded-lg border border-gray-200 bg-[#f9fafb] shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2 sm:max-w-[220px]"
                              aria-label={`Enlarge sample image for ${requirement.label}`}
                            >
                              <div className="flex aspect-[4/3] w-full items-center justify-center p-2">
                                <AdmissionSampleImage
                                  slug={requirement.slug}
                                  fallbackSrc={requirement.fallbackSrc}
                                  alt=""
                                  imgClassName="max-h-full max-w-full object-contain"
                                />
                              </div>
                              <span className="block border-t border-gray-100 bg-gray-50 px-2 py-1.5 text-center text-xs text-gray-500 group-hover:text-[#8B1538]">
                                Click to enlarge
                              </span>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={sampleLightboxOpen && selectedRequirementIndex !== null}
            onOpenChange={(open) => {
              setSampleLightboxOpen(open);
            }}
          >
            <DialogContent className="max-h-[min(92vh,920px)] max-w-[min(96vw,900px)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
              {selectedRequirementIndex !== null ? (
                <>
                  <DialogHeader className="border-b border-border px-6 py-4 text-left">
                    <DialogTitle className="text-base leading-snug">
                      {admissionRequirements[selectedRequirementIndex].label}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[calc(min(92vh,920px)-5rem)] overflow-auto bg-muted/40 p-4">
                    <AdmissionSampleImage
                      slug={admissionRequirements[selectedRequirementIndex].slug}
                      fallbackSrc={admissionRequirements[selectedRequirementIndex].fallbackSrc}
                      alt={`Sample document for ${admissionRequirements[selectedRequirementIndex].label}`}
                      imgClassName="mx-auto h-auto w-full max-w-full object-contain"
                    />
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
      </section>

      {/* Enrollment Process */}
      <section className="py-14 sm:py-20" style={{ backgroundColor: BRAND.surface }}>
        <div className="section-container">
          <div className="mb-12 text-center">
            <PublicSectionEyebrow>Enrollment</PublicSectionEyebrow>
            <h2 className="text-3xl font-bold sm:text-4xl" style={{ color: BRAND.maroon }}>
              Enrollment Process
            </h2>
            <p className="mt-3" style={{ color: BRAND.slate }}>
              Follow these steps to complete your application online
            </p>
          </div>

          <div className="mx-auto max-w-4xl space-y-4">
            {enrollmentSteps.map((item) => {
              const isOdd = item.step % 2 === 1;
              const accent = isOdd ? BRAND.maroon : BRAND.green;
              return (
                <Link
                  key={item.title}
                  to={item.to}
                  className="group block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b1538] focus-visible:ring-offset-2"
                  aria-label={`${item.title}: ${item.description}`}
                >
                  <Card
                    className="h-full border border-gray-200 shadow-sm transition-all group-hover:shadow-md"
                    style={{ borderLeftWidth: 4, borderLeftColor: accent }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div
                          className="flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                          style={{ backgroundColor: accent }}
                        >
                          {item.step}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="mb-2 text-xl font-bold transition-colors group-hover:opacity-90" style={{ color: BRAND.ink }}>
                            {item.title}
                          </h3>
                          <p className="text-sm leading-relaxed sm:text-base" style={{ color: BRAND.slate }}>
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="relative overflow-hidden py-14 sm:py-20" style={{ backgroundColor: BRAND.maroon }}>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-2 sm:w-3" style={{ backgroundColor: BRAND.green }} aria-hidden />
        <div className="section-container relative text-center">
          <Users className="mx-auto mb-6 size-14 text-white/90" />
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Begin Your Academic Journey?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">
            Join our community and take the first step toward senior high school at NSDGA.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link to="/registration">
              <Button size="lg" className="h-12 bg-white px-8 text-lg hover:bg-gray-100" style={{ color: BRAND.maroon }}>
                <FileText className="mr-2 size-5" />
                Create Account
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-white/70 bg-transparent px-8 text-lg text-white hover:bg-white/10"
              >
                Contact Registrar
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}