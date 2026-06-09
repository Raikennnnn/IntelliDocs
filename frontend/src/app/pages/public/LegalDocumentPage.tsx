import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { LandingNavbar } from '../../components/LandingNavbar';
import { Footer } from '../../components/Footer';
import { getLegalDocument } from '../../content/legalDocuments';
import { NotFound } from '../../components/ErrorBoundary';

export function LegalDocumentPage() {
  const { docId } = useParams<{ docId: string }>();
  const document = docId ? getLegalDocument(docId) : null;

  if (!document) {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <LandingNavbar />

      <section className="bg-[#8B1538] text-white py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/registration"
            className="inline-flex items-center gap-2 text-white/90 hover:text-white text-sm font-medium mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to registration
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{document.title}</h1>
          <p className="text-white/90">{document.subtitle}</p>
          <p className="text-sm text-white/75 mt-3">Effective: {document.effectiveDate}</p>
        </div>
      </section>

      <main className="flex-1 py-10">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 bg-white rounded-xl border border-gray-200 shadow-sm p-8 sm:p-10 space-y-8">
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-[#101828] mb-3">{section.title}</h2>
              <div className="space-y-3 text-[#364153] leading-relaxed text-sm sm:text-base">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </main>

      <Footer />
    </div>
  );
}
