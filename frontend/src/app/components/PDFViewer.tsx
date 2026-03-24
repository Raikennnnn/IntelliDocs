import { useState } from 'react';
import { FileText, Download, ZoomIn, ZoomOut, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface DocumentFile {
  name: string;
  type: string;
  url: string;
  uploadedDate: string;
}

interface PDFViewerProps {
  document: DocumentFile;
  showPreview?: boolean;
}

export function PDFViewer({ document, showPreview = true }: PDFViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 1; // Mock - in production this would come from PDF

  const handleDownload = () => {
    // In production, this would trigger actual download
    const link = window.document.createElement('a');
    link.href = document.url;
    link.download = document.name;
    link.click();
  };

  const handleView = () => {
    window.open(document.url, '_blank');
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Document Header */}
      <div className="flex items-start justify-between gap-3 p-4 bg-gray-50 border-b border-gray-200">
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
        
        {/* Action Buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleView}
            className="text-xs"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* PDF Preview */}
      {showPreview && (
        <div className="bg-gray-100">
          {/* Zoom Controls */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">{zoom}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Page Navigation (Mock) */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* PDF Preview Area */}
          <div 
            className="p-4 flex items-center justify-center min-h-[400px] max-h-[600px] overflow-auto"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            {/* Mock PDF Preview - In production, use react-pdf's Document and Page components */}
            <div className="bg-white shadow-lg w-full max-w-2xl aspect-[8.5/11] p-8 border border-gray-300">
              <div className="text-center space-y-4">
                <FileText className="w-16 h-16 text-gray-300 mx-auto" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{document.type}</h3>
                  <p className="text-sm text-gray-600 mt-2">{document.name}</p>
                </div>
                <div className="text-xs text-gray-400 mt-4">
                  <p>📄 PDF Document Preview</p>
                  <p className="mt-1">In production, actual PDF content would display here</p>
                  <p className="mt-1">using react-pdf library</p>
                </div>
                
                {/* Mock Document Content */}
                <div className="mt-8 text-left border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Document Information:</p>
                  <div className="space-y-1 text-xs">
                    <p><strong>Type:</strong> {document.type}</p>
                    <p><strong>File Name:</strong> {document.name}</p>
                    <p><strong>Upload Date:</strong> {document.uploadedDate}</p>
                    <p><strong>Status:</strong> <span className="text-green-600">Verified</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PDFViewerListProps {
  documents: DocumentFile[];
  showPreviews?: boolean;
}

export function PDFViewerList({ documents, showPreviews = true }: PDFViewerListProps) {
  return (
    <div className="space-y-4">
      {documents.map((doc, idx) => (
        <PDFViewer key={idx} document={doc} showPreview={showPreviews} />
      ))}
    </div>
  );
}
