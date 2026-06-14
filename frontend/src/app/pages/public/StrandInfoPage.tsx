import { Link, Navigate, useParams } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import { Button } from '../../components/ui/button';
import { ArrowLeft, BookOpen, Briefcase, Lightbulb, Cpu, Zap, UtensilsCrossed } from 'lucide-react';
import { StrandHeroImage } from '../../components/StrandHeroImage';
import { isStrandSlug, STRAND_INFO, type StrandSlug } from './strandInfoData';
const strandIcon = (slug: StrandSlug) => {
  switch (slug) {
    case 'humss':
      return BookOpen;
    case 'abm':
      return Briefcase;
    case 'stem':
      return Lightbulb;
    case 'ict':
      return Cpu;
    case 'eim':
      return Zap;
    case 'bpp-fbs':
      return UtensilsCrossed;
    default:
      return BookOpen;
  }
};
export function StrandInfoPage() {
  const { strandSlug } = useParams<{ strandSlug: string }>();
  if (!isStrandSlug(strandSlug)) {
    return <Navigate to="/admissions" replace />;
  }
  const strand = STRAND_INFO[strandSlug];
  const accent = strand.trackType === 'academic' ? '#8B1538' : '#2D5016';
  const accentSoft = strand.trackType === 'academic' ? 'bg-[#8B1538]/10' : 'bg-[#2D5016]/10';
  const Icon = strandIcon(strandSlug);
  return (
    <div className="min-h-screen bg-gray-50">
      <LandingNavbar />
      <section className="border-b border-gray-200 bg-white py-10 sm:py-12">
        <div className="mx-auto max-w-[1280px] px-8">
          <Link
            to="/admissions"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#8B1538] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Admissions
          </Link>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{strand.trackLabel}</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">{strand.title}</h1>
              <p className="mt-2 text-lg font-medium" style={{ color: accent }}>
                {strand.shorthand}
              </p>
              <p className="mt-4 text-gray-600 leading-relaxed">{strand.intro}</p>
              <div className="mt-6">
                <Button asChild variant="outline" className="border-[#8B1538] text-[#8B1538] hover:bg-[#8B1538]/10">
                  <Link to="/registration">Ready to enroll? Create an account</Link>
                </Button>
              </div>
            </div>
            <StrandHeroImage slug={strandSlug} title={strand.title} accent={accent} />
          </div>
        </div>
      </section>
      <section className="py-12">
        <div className="mx-auto max-w-3xl space-y-10 px-4 sm:px-6 lg:px-8">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <span className={`inline-flex rounded-lg p-2 ${accentSoft}`}>
                <Icon className="h-5 w-5" style={{ color: accent }} aria-hidden />
              </span>
              Program overview
            </h2>
            <div className="mt-4 space-y-3 text-gray-600 leading-relaxed">
              {strand.overview.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">What you&apos;ll explore</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-600 leading-relaxed">
              {strand.focusAreas.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Possible career paths</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-600 leading-relaxed">
              {strand.careers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {strand.furtherStudy && strand.furtherStudy.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold text-gray-900">Further study options</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-gray-600 leading-relaxed">
                {strand.furtherStudy.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
    </div>
  );
}
