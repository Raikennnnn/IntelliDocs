import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { cn } from '../../components/ui/utils';
import {
  BookOpen,
  GraduationCap,
  FileText,
  CheckCircle,
  Users,
  Lightbulb,
  Briefcase,
  Wrench,
  Cpu,
  Zap,
  UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import applicationFormSample from '../../assets/admission-samples/application-form.svg';
import reportCardSf9Sample from '../../assets/admission-samples/report-card-sf9.svg';
import sf10Form137Sample from '../../assets/admission-samples/sf10-form137.svg';
import psaBirthSample from '../../assets/admission-samples/psa-birth-certificate.svg';
import idPictureSample from '../../assets/admission-samples/id-picture-2x2.svg';
import goodMoralSample from '../../assets/admission-samples/good-moral-certificate.svg';
import transcriptTorSample from '../../assets/admission-samples/transcript-tor.svg';

const ACADEMIC_STRANDS: { slug: string; Icon: LucideIcon; title: string; description: string }[] = [
  {
    slug: 'humss',
    Icon: BookOpen,
    title: 'Humanities and Social Sciences (HUMSS)',
    description:
      'For students interested in social sciences, education, humanities, liberal arts, and communication arts.',
  },
  {
    slug: 'abm',
    Icon: Briefcase,
    title: 'Accountancy, Business, and Management (ABM)',
    description:
      'Ideal for students aiming for careers in business, entrepreneurship, finance, and management.',
  },
  {
    slug: 'stem',
    Icon: Lightbulb,
    title: 'Science, Technology, Engineering, and Mathematics (STEM)',
    description:
      'Designed for students pursuing careers in engineering, medicine, IT, and other science-related fields.',
  },
];

const TVL_STRANDS: { slug: string; Icon: LucideIcon; title: string; description: string }[] = [
  {
    slug: 'ict',
    Icon: Cpu,
    title: 'Information and Communications Technology (ICT)',
    description: 'Focuses on computer systems, programming, networking, and digital technologies.',
  },
  {
    slug: 'eim',
    Icon: Zap,
    title: 'Electrical Installation and Maintenance (EIM)',
    description: 'Covers electrical wiring, troubleshooting, and maintenance of electrical systems.',
  },
  {
    slug: 'bpp-fbs',
    Icon: UtensilsCrossed,
    title: 'Bread and Pastry Production / Food and Beverages Services (BPP/FBS)',
    description: 'Training in culinary arts, baking, food preparation, and hospitality services.',
  },
];

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
      to: '/student-login',
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
    <div className="min-h-screen bg-gray-50">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="bg-[#8B1538] text-white py-16">
        <div className="section-container">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Admissions</h1>
          <p className="text-xl text-gray-200 max-w-3xl">
            We welcome aspiring students who are committed to academic growth and personal development. 
            Our Senior High School program offers structured academic tracks designed to prepare learners 
            for higher education and future careers.
          </p>
        </div>
      </section>

      {/* Offered Programs */}
      <section className="py-16">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#8B1538] mb-4">
              Offered Programs
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose the academic strand that aligns with your interests and career goals
            </p>
            <p className="text-sm text-gray-500 max-w-2xl mx-auto mt-2">
              Select a strand below to read an overview, possible careers, and further study options.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Academic Track Card */}
            <Card className="shadow-xl border border-gray-200">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-[#2D5016] rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-[#2D5016]">Academic Track</h3>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {ACADEMIC_STRANDS.map(({ slug, Icon, title, description }) => (
                    <Link
                      key={slug}
                      to={`/admissions/strands/${slug}`}
                      className="group block rounded-xl border border-transparent p-3 -m-1 transition-colors hover:border-[#2D5016]/25 hover:bg-[#2D5016]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5016] focus-visible:ring-offset-2"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5 text-[#2D5016] shrink-0" aria-hidden />
                        <h4 className="font-bold text-gray-900 group-hover:text-[#2D5016] transition-colors">
                          {title}
                        </h4>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed pl-7">{description}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* TVL Track Card */}
            <Card className="shadow-xl border border-gray-200">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-[#2D5016] rounded-lg flex items-center justify-center">
                    <Wrench className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-[#2D5016]">Technical-Vocational-Livelihood (TVL)</h3>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {TVL_STRANDS.map(({ slug, Icon, title, description }) => (
                    <Link
                      key={slug}
                      to={`/admissions/strands/${slug}`}
                      className="group block rounded-xl border border-transparent p-3 -m-1 transition-colors hover:border-[#2D5016]/25 hover:bg-[#2D5016]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5016] focus-visible:ring-offset-2"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5 text-[#2D5016] shrink-0" aria-hidden />
                        <h4 className="font-bold text-gray-900 group-hover:text-[#2D5016] transition-colors">
                          {title}
                        </h4>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed pl-7">{description}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Admission Requirements */}
      <section className="py-16 bg-white">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#8B1538] mb-4">
              Admission Requirements
            </h2>
            <p className="text-gray-600">
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
                              className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538] focus-visible:ring-offset-2"
                              aria-label={`Enlarge sample image for ${requirement.label}`}
                            >
                              <AdmissionSampleImage
                                slug={requirement.slug}
                                fallbackSrc={requirement.fallbackSrc}
                                alt=""
                                imgClassName="mx-auto h-32 w-auto max-w-full object-contain p-2"
                              />
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
        </div>
      </section>

      {/* Enrollment Process */}
      <section className="py-16 bg-gray-50">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#8B1538] mb-4">
              Enrollment Process
            </h2>
            <p className="text-gray-600 mb-2">
              Follow these simple steps to complete your enrollment
            </p>
            <p className="text-sm text-gray-500">
              Select a step to open the matching page in the system (you may be asked to log in).
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="space-y-6">
              {enrollmentSteps.map((item, index) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5016] focus-visible:ring-offset-2"
                  aria-label={`${item.title}: ${item.description}`}
                >
                  <Card className="shadow-md transition-all group-hover:shadow-lg group-hover:border-[#2D5016]/30 h-full cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-[#2D5016] rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 group-hover:bg-[#244015] transition-colors">
                          {item.step}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[#2D5016] transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-gray-600">{item.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-[#8B1538] text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <Users className="w-16 h-16 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Begin Your Academic Journey?
          </h2>
          <p className="text-lg mb-8 text-gray-200">
            Join our community and take the first step towards a brighter future.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/registration">
              <Button 
                size="lg" 
                className="bg-white text-[#8B1538] hover:bg-gray-100 text-lg px-8 py-6"
              >
                <FileText className="w-5 h-5 mr-2" />
                Create Account
              </Button>
            </Link>
            <Link to="/contact">
              <Button 
                size="lg" 
                variant="outline"
                className="bg-transparent text-white border-white hover:bg-white hover:text-[#8B1538] text-lg px-8 py-6"
              >
                Contact Admissions Office
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-300 mt-4">
            For questions about enrollment, contact our Registrar's Office
          </p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}