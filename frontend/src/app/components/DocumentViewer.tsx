import { FileText, Download, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface DocumentFile {
  name: string;
  type: string;
  url: string;
  uploadedDate: string;
}

interface DocumentViewerProps {
  document: DocumentFile;
}

export function DocumentViewer({ document }: DocumentViewerProps) {
  const handleDownload = () => {
    // In production, this would trigger actual download
    window.open(document.url, '_blank');
  };

  const handleView = () => {
    // In production, this would open in modal or new tab
    window.open(document.url, '_blank');
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-[#8B1538]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900 truncate">{document.name}</p>
            <p className="text-xs text-gray-500 mt-1">Uploaded: {document.uploadedDate}</p>
            <Badge variant="outline" className="mt-2 text-xs">
              {document.type}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleView}
            className="text-xs"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="text-xs"
          >
            <Download className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {/* PDF Preview Placeholder */}
      <div className="mt-3 border border-gray-200 rounded-md bg-gray-50 h-32 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500">PDF Document Preview</p>
          <p className="text-xs text-gray-400">{document.name}</p>
        </div>
      </div>
    </div>
  );
}

interface DocumentListProps {
  documents: DocumentFile[];
}

export function DocumentList({ documents }: DocumentListProps) {
  return (
    <div className="space-y-3">
      {documents.map((doc, idx) => (
        <DocumentViewer key={idx} document={doc} />
      ))}
    </div>
  );
}
