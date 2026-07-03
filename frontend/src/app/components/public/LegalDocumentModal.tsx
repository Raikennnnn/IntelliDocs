import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { getLegalDocument, type LegalDocumentId } from '../../content/legalDocuments';

type LegalDocumentModalProps = {
  docId: LegalDocumentId | null;
  onClose: () => void;
};

export function LegalDocumentModal({ docId, onClose }: LegalDocumentModalProps) {
  if (!docId) return null;

  const document = getLegalDocument(docId);
  if (!document) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-gray-100 px-6 pt-6 pb-4 text-left">
          <DialogTitle className="text-xl">{document.title}</DialogTitle>
          <DialogDescription>{document.subtitle}</DialogDescription>
          <p className="text-xs text-gray-500">Effective: {document.effectiveDate}</p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {document.sections.map((section) => (
              <section key={section.title}>
                <h3 className="mb-2 text-base font-bold text-[#101828]">{section.title}</h3>
                <div className="space-y-2 text-sm leading-relaxed text-[#364153]">
                  {section.paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
