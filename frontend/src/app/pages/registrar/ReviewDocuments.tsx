import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  FileText,
  AlertCircle,
  Download,
  Eye,
  ArrowLeft,
  User,
  Users,
  GraduationCap,
  Upload,
  ClipboardCheck,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api";

function guessDocKind(mimeType: string | undefined, fileName: string | undefined): "pdf" | "image" | "other" {
  const mt = (mimeType || "").toLowerCase();
  const fn = (fileName || "").toLowerCase();
  if (mt.includes("pdf") || fn.endsWith(".pdf")) return "pdf";
  if (mt.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg)$/.test(fn)) return "image";
  return "other";
}

/** Detect real file type from bytes so we don't feed JSON/HTML into <img>. */
function sniffBinaryKind(buf: ArrayBuffer): "jpeg" | "png" | "gif" | "webp" | "pdf" | "json" | "html" | "unknown" {
  const u = new Uint8Array(buf.byteLength ? buf.slice(0, 16) : new ArrayBuffer(0));
  if (u.length < 2) return "unknown";
  if (u[0] === 0x7b) return "json";
  if (u[0] === 0x3c) return "html";
  if (u.length >= 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "jpeg";
  if (u.length >= 4 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return "png";
  if (u.length >= 6 && u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return "gif";
  if (u.length >= 4 && u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46) return "pdf";
  if (
    u.length >= 12 &&
    u[0] === 0x52 &&
    u[1] === 0x49 &&
    u[2] === 0x46 &&
    u[3] === 0x46 &&
    u[8] === 0x57 &&
    u[9] === 0x45 &&
    u[10] === 0x42 &&
    u[11] === 0x50
  ) {
    return "webp";
  }
  return "unknown";
}

/** Strip UTF-8 BOM or leading noise so JPEG/PNG magic is at offset 0 (fixes broken <img> when PHP emits BOM). */
function trimBinaryPayload(buf: ArrayBuffer): ArrayBuffer {
  const u = new Uint8Array(buf);
  if (u.length >= 3 && u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) {
    return trimBinaryPayload(buf.slice(3));
  }
  for (let i = 0; i <= Math.min(u.length - 3, 512); i++) {
    if (u[i] === 0xff && u[i + 1] === 0xd8 && u[i + 2] === 0xff) {
      return i === 0 ? buf : buf.slice(i);
    }
  }
  for (let i = 0; i <= Math.min(u.length - 4, 512); i++) {
    if (u[i] === 0x89 && u[i + 1] === 0x50 && u[i + 2] === 0x4e && u[i + 3] === 0x47) {
      return i === 0 ? buf : buf.slice(i);
    }
  }
  for (let i = 0; i <= Math.min(u.length - 4, 512); i++) {
    if (u[i] === 0x25 && u[i + 1] === 0x50 && u[i + 2] === 0x44 && u[i + 3] === 0x46) {
      return i === 0 ? buf : buf.slice(i);
    }
  }
  return buf;
}

function mimeForSniff(s: ReturnType<typeof sniffBinaryKind>, fileName: string | undefined): string {
  switch (s) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default: {
      const fn = (fileName || "").toLowerCase();
      if (fn.endsWith(".png")) return "image/png";
      if (fn.endsWith(".gif")) return "image/gif";
      if (fn.endsWith(".webp")) return "image/webp";
      if (fn.endsWith(".pdf")) return "application/pdf";
      if (/\.(jpe?g)$/.test(fn)) return "image/jpeg";
      return "application/octet-stream";
    }
  }
}

/** Average of per-document AI confidence scores (same source as the Documents tab). */
function computeAggregateAiScore(documents: unknown): number | null {
  if (!Array.isArray(documents) || documents.length === 0) return null;
  const scores: number[] = [];
  for (const d of documents) {
    const n = Number((d as { aiConfidence?: unknown }).aiConfidence);
    if (!Number.isFinite(n)) continue;
    scores.push(n);
  }
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg);
}

type AiReviewTier = "face_to_face" | "manual" | "light";

function getAiReviewTier(score: number): {
  tier: AiReviewTier;
  title: string;
  body: string;
  accent: string;
} {
  if (score < 65) {
    return {
      tier: "face_to_face",
      title: "Face-to-face verification required",
      body: "Overall AI score is below 65%. Per policy, this applicant must pass face-to-face verification before enrollment can proceed.",
      accent: "border-red-200 bg-red-50/80 text-red-900",
    };
  }
  if (score < 85) {
    return {
      tier: "manual",
      title: "Manual registrar review required",
      body: "Overall AI score is between 65% and 84%. Documents should be manually reviewed by the registrar before a final decision.",
      accent: "border-amber-200 bg-amber-50/80 text-amber-950",
    };
  }
  return {
    tier: "light",
    title: "Routine review",
    body: "Overall AI score is 85% or higher. Manual document checking is not required beyond normal procedures; still confirm identity and completeness as needed.",
    accent: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
  };
}

export function ReviewDocuments() {
  const params = useParams();
  const applicationId = params.applicationId;
  const [remarks, setRemarks] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewDisplayKind, setPreviewDisplayKind] = useState<"pdf" | "image" | "other" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<any | null>(null);
  
  const loadApplication = async () => {
    if (!applicationId) return;
    try {
      setError(null);
      const response = await apiFetch(`/api/registrar/application?application_id=${encodeURIComponent(applicationId)}`);
      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned an invalid response");
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to load application (${response.status})`);
      }
      setApplication(data.application ?? null);
      setRemarks(String(data.application?.registrarRemarks ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load application");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplication();
    const id = setInterval(() => {
      loadApplication();
    }, 10000);
    return () => clearInterval(id);
  }, [applicationId]);

  const handleApprove = async () => {
    if (!application?.enrollmentId) return;
    const res = await apiFetch('/api/registrar/application', {
      method: 'POST',
      body: JSON.stringify({
        action: 'approve',
        enrollment_id: application.enrollmentId,
        remarks,
      }),
    });
    const text = await res.text();
    const data = JSON.parse(text);
    if (!res.ok || !data.success) {
      toast.error(data.error || `Failed to approve (${res.status})`);
      return;
    }
    toast.success(data.message || `Application ${application.id} approved`);
    loadApplication();
  };

  const handleReject = async () => {
    if (!remarks.trim()) {
      toast.error("Please provide remarks for rejection");
      return;
    }
    if (!application?.enrollmentId) return;
    const res = await apiFetch('/api/registrar/application', {
      method: 'POST',
      body: JSON.stringify({
        action: 'reject',
        enrollment_id: application.enrollmentId,
        remarks,
      }),
    });
    const text = await res.text();
    const data = JSON.parse(text);
    if (!res.ok || !data.success) {
      toast.error(data.error || `Failed to reject (${res.status})`);
      return;
    }
    toast.success(data.message || `Application ${application.id} rejected`);
    loadApplication();
  };

  const handleSaveRemarks = async () => {
    if (!application?.enrollmentId) return;
    const res = await apiFetch('/api/registrar/application', {
      method: 'POST',
      body: JSON.stringify({
        action: 'save_remarks',
        enrollment_id: application.enrollmentId,
        remarks,
      }),
    });
    const text = await res.text();
    const data = JSON.parse(text);
    if (!res.ok || !data.success) {
      toast.error(data.error || `Failed to save remarks (${res.status})`);
      return;
    }
    toast.success(data.message || "Remarks saved successfully");
  };

  const getDocumentStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return "bg-green-600";
      case "Flagged":
        return "bg-red-600";
      case "Under Review":
        return "bg-yellow-600";
      default:
        return "bg-gray-600";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600";
    if (confidence >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const aggregateAiScore = application ? computeAggregateAiScore(application.documents) : null;
  const aiTier = aggregateAiScore !== null ? getAiReviewTier(aggregateAiScore) : null;

  const handleViewDocument = (doc: any) => {
    if (!application) return;
    setSelectedDocument({
      ...doc,
      studentName: application.studentName,
      applicationId: application.id,
      strand: application.strand,
      gradeLevel: application.gradeLevel,
    });
    setIsDocumentDialogOpen(true);
  };

  const downloadDocument = async (doc: { id?: number; fileName?: string; name?: string }) => {
    if (!doc?.id) {
      toast.error("Document is not available for download");
      return;
    }
    try {
      const res = await apiFetch(`/api/document-file?id=${doc.id}&disposition=attachment`);
      if (!res.ok) {
        const errText = await res.text();
        toast.error(errText || `Download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (doc.fileName || doc.name || "document").replace(/[\\/]/g, "_");
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  useEffect(() => {
    if (!isDocumentDialogOpen || !selectedDocument?.id) {
      setPreviewObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewDisplayKind(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    (async () => {
      try {
        const res = await apiFetch(`/api/document-file?id=${selectedDocument.id}`);
        const headerCt = (res.headers.get("content-type") || "").toLowerCase();
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        if (!res.ok) {
          let msg = `Could not load preview (${res.status})`;
          try {
            const t = new TextDecoder().decode(buf.slice(0, 2000));
            const j = JSON.parse(t) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        const sniff = sniffBinaryKind(buf);
        if (sniff === "json") {
          const t = new TextDecoder().decode(buf.slice(0, 4000));
          let msg = "Could not load file";
          try {
            const j = JSON.parse(t) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        if (sniff === "html") {
          throw new Error(
            "Server returned HTML instead of the file. Check PHP errors or that the file exists under uploads/documents.",
          );
        }

        const payload = trimBinaryPayload(buf);
        const sniff2 = sniffBinaryKind(payload);

        const fn = String(selectedDocument.fileName || selectedDocument.name || "");
        let mime = headerCt.split(";")[0].trim();
        if (
          sniff2 === "jpeg" ||
          sniff2 === "png" ||
          sniff2 === "gif" ||
          sniff2 === "webp" ||
          sniff2 === "pdf"
        ) {
          mime = mimeForSniff(sniff2, fn);
        } else if (!mime || mime === "application/octet-stream" || mime === "text/plain") {
          mime = mimeForSniff(sniff2, fn);
        }

        const blob = new Blob([payload], { type: mime });

        let display: "pdf" | "image" | "other" = "other";
        if (sniff2 === "pdf" || mime.includes("pdf")) display = "pdf";
        else if (
          sniff2 === "jpeg" ||
          sniff2 === "png" ||
          sniff2 === "gif" ||
          sniff2 === "webp" ||
          mime.startsWith("image/")
        ) {
          display = "image";
        } else if (guessDocKind(selectedDocument.mimeType, fn) === "image") {
          display = "image";
        } else if (guessDocKind(selectedDocument.mimeType, fn) === "pdf") {
          display = "pdf";
        }

        if (display === "image" && !mime.startsWith("image/")) {
          display = "other";
        }

        const url = URL.createObjectURL(blob);
        setPreviewObjectUrl(url);
        setPreviewDisplayKind(display);
      } catch (e) {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : "Could not load preview");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDocumentDialogOpen, selectedDocument?.id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 py-12">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading application...
      </div>
    );
  }

  if (error || !application) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Application not found'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/registrar/applications">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs">
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold text-gray-900">
            Review Application
          </h2>
          <p className="text-gray-600">Application ID: {application.id}</p>
        </div>
        <Badge className={
          application.status === "Approved" ? "bg-green-600" :
          application.status === "Under Review" ? "bg-blue-600" :
          application.status === "Rejected" ? "bg-red-600" :
          "bg-yellow-600"
        }>
          {application.status}
        </Badge>
      </div>

      {/* Enrollment Status Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Student Type</p>
              <p className="font-medium capitalize">{application.enrollmentStatus}</p>
            </div>
            <div>
              <p className="text-gray-600">Submitted Date</p>
              <p className="font-medium">{application.submittedDate}</p>
            </div>
            <div>
              <p className="text-gray-600">Grade Level</p>
              <p className="font-medium">Grade {application.gradeLevel}</p>
            </div>
            <div>
              <p className="text-gray-600">Strand</p>
              <p className="font-medium">{application.strand}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Interface */}
      <Card>
        <Tabs defaultValue="personal" className="w-full">
          <div className="border-b bg-gray-50">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent rounded-none">
              <TabsTrigger 
                value="personal" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <User className="w-4 h-4 mr-2" />
                Personal Information
              </TabsTrigger>
              <TabsTrigger 
                value="family" 
                className="data-[state=active]:bg-[#8B1538] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#8B1538] px-6 py-3"
              >
                <Users className="w-4 h-4 mr-2" />
                Parent/Guardian Information
              </TabsTrigger>
              <TabsTrigger 
                value="academic" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Academic Background
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="data-[state=active]:bg-[#8B1538] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#8B1538] px-6 py-3"
              >
                <Upload className="w-4 h-4 mr-2" />
                Documents Upload
              </TabsTrigger>
              <TabsTrigger 
                value="review" 
                className="data-[state=active]:bg-[#2D5016] data-[state=active]:text-white rounded-none border-b-2 border-transparent data-[state=active]:border-[#2D5016] px-6 py-3"
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Review & Decision
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Given Name</p>
                  <p className="font-medium">{application.givenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Middle Name</p>
                  <p className="font-medium">{application.middleName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last Name</p>
                  <p className="font-medium">{application.lastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Extension Name</p>
                  <p className="font-medium">{application.extensionName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-gray-600">Gender</p>
                  <p className="font-medium">{application.gender}</p>
                </div>
                <div>
                  <p className="text-gray-600">LRN</p>
                  <p className="font-medium">{application.lrn}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.contactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Email Address</p>
                  <p className="font-medium">{application.email}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Block/Lot/House No.</p>
                  <p className="font-medium">{application.blockLotHouseNo}</p>
                </div>
                <div>
                  <p className="text-gray-600">Street</p>
                  <p className="font-medium">{application.street}</p>
                </div>
                <div>
                  <p className="text-gray-600">Compound/Subdivision/Village</p>
                  <p className="font-medium">{application.compoundSubdivisionVillage}</p>
                </div>
                <div>
                  <p className="text-gray-600">Barangay</p>
                  <p className="font-medium">{application.barangay}</p>
                </div>
                <div>
                  <p className="text-gray-600">Municipality/City</p>
                  <p className="font-medium">{application.municipality}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Birth Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Date of Birth</p>
                  <p className="font-medium">{application.birthDate}</p>
                </div>
                <div>
                  <p className="text-gray-600">Place of Birth</p>
                  <p className="font-medium">{application.birthPlace}</p>
                </div>
                <div>
                  <p className="text-gray-600">Religion</p>
                  <p className="font-medium">{application.religion}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Parent/Guardian Information Tab */}
          <TabsContent value="family" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Mother's Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Given Name</p>
                  <p className="font-medium">{application.motherGivenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Maiden Middle Name</p>
                  <p className="font-medium">{application.motherMaidenMiddleName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Maiden Last Name</p>
                  <p className="font-medium">{application.motherMaidenLastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.motherContactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Occupation</p>
                  <p className="font-medium">{application.motherOccupation}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Father's Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Given Name</p>
                  <p className="font-medium">{application.fatherGivenName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Middle Name</p>
                  <p className="font-medium">{application.fatherMiddleName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last Name</p>
                  <p className="font-medium">{application.fatherLastName}</p>
                </div>
                <div>
                  <p className="text-gray-600">Contact Number</p>
                  <p className="font-medium">{application.fatherContactNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Occupation</p>
                  <p className="font-medium">{application.fatherOccupation}</p>
                </div>
              </div>
            </div>

            {application.hasGuardian && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Guardian Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Given Name</p>
                    <p className="font-medium">{application.guardianGivenName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Middle Name</p>
                    <p className="font-medium">{application.guardianMiddleName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Last Name</p>
                    <p className="font-medium">{application.guardianLastName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Contact Number</p>
                    <p className="font-medium">{application.guardianContactNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Relationship</p>
                    <p className="font-medium">{application.relationshipToGuardian}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
              <div className="text-sm">
                <p className="text-gray-600">Primary Emergency Contact</p>
                <p className="font-medium capitalize">{application.emergencyContact}</p>
              </div>
            </div>
          </TabsContent>

          {/* Academic Background Tab */}
          <TabsContent value="academic" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Academic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Grade Level</p>
                  <p className="font-medium">Grade {application.gradeLevel}</p>
                </div>
                <div>
                  <p className="text-gray-600">Strand</p>
                  <p className="font-medium">{application.strand}</p>
                </div>
                <div>
                  <p className="text-gray-600">Preferred Schedule</p>
                  <p className="font-medium">{application.preferredSchedule}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Enrollment History</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Previous School Attended</p>
                  <p className="font-medium">{application.previousSchoolAttended}</p>
                </div>
                <div>
                  <p className="text-gray-600">School Type</p>
                  <p className="font-medium capitalize">{application.schoolType}</p>
                </div>
                <div>
                  <p className="text-gray-600">Grade Level at Previous School</p>
                  <p className="font-medium">Grade {application.gradeLevelAtPreviousSchool}</p>
                </div>
                <div>
                  <p className="text-gray-600">Section at Previous School</p>
                  <p className="font-medium">{application.sectionAtPreviousSchool}</p>
                </div>
                <div>
                  <p className="text-gray-600">Last School Year Attended</p>
                  <p className="font-medium">{application.lastSchoolYearAttended}</p>
                </div>
              </div>
            </div>

            {application.hasReferralCode && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Bring a Friend Promo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Referral Card Control Number</p>
                    <p className="font-medium">{application.referralCardControlNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Referrer Name</p>
                    <p className="font-medium">{application.referrerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Referrer Contact Number</p>
                    <p className="font-medium">{application.referrerContactNumber}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Mode of Payment</p>
                  <p className="font-medium">{application.modeOfPayment}</p>
                </div>
                {application.voucherNo && (
                  <div>
                    <p className="text-gray-600">Voucher Number</p>
                    <p className="font-medium">{application.voucherNo}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Documents Upload Tab */}
          <TabsContent value="documents" className="p-6">
            <div className="space-y-3">
              {(application.documents ?? []).map((doc: any, index: number) => (
                <div
                  key={doc.id ?? index}
                  className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#8B1538] uppercase tracking-wide mb-1">
                          {(doc.requirementLabel || 'Document').replace(/\s+/g, ' ').trim()}
                        </p>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-gray-900 truncate" title={doc.fileName || doc.name}>
                            {doc.fileName || doc.name}
                          </p>
                          <Badge className={getDocumentStatusColor(doc.status)}>
                            {doc.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div>
                            <span className="text-gray-500">AI Confidence: </span>
                            <span
                              className={`font-semibold ${getConfidenceColor(doc.aiConfidence)}`}
                            >
                              {doc.aiConfidence}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Uploaded: </span>
                            <span>{doc.uploadedDate}</span>
                          </div>
                        </div>
                        {doc.status === "Flagged" && (
                          <Alert className="mt-3 border-red-300 bg-red-50">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-700">
                              This document has been flagged by AI. Please review
                              carefully for authenticity issues.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Review & Decision Tab */}
          <TabsContent value="review" className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Registrar Remarks</h3>
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks / Notes</Label>
                <textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter your remarks here..."
                  className="w-full min-h-[120px] px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSaveRemarks}
                className="mt-4 border-[#8B1538] text-[#8B1538] hover:bg-[#8B1538] hover:text-white"
              >
                Save Remarks
              </Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8B1538]/10">
                  <Sparkles className="h-5 w-5 text-[#8B1538]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI review summary</h3>
                    <p className="text-sm text-gray-600">
                      Overall score is the average of AI confidence on submitted documents (same values as the Documents tab).
                    </p>
                  </div>
                  {aggregateAiScore !== null && aiTier ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm text-gray-600">Overall AI score</span>
                        <span
                          className={`text-2xl font-bold tabular-nums ${getConfidenceColor(aggregateAiScore)}`}
                        >
                          {aggregateAiScore}%
                        </span>
                      </div>
                      <div className={`rounded-md border p-3 text-sm ${aiTier.accent}`}>
                        <p className="font-semibold">{aiTier.title}</p>
                        <p className="mt-1 leading-relaxed">{aiTier.body}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Thresholds: below 65% → face-to-face; 65–84% → manual registrar review; 85% and up → no
                        extra manual checking required.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      No document AI scores are available yet. Uploads and AI processing will appear on the
                      Documents tab first; then this summary will show an overall score and guidance.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Application Decision</h3>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Review all information and documents carefully before making a final decision.
                </AlertDescription>
              </Alert>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                  onClick={handleReject}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Application
                </Button>
                <Button
                  className="bg-[#2D5016] hover:bg-[#2D5016]/90 text-white"
                  onClick={handleApprove}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve Application
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Document View Dialog */}
      <Dialog
        open={isDocumentDialogOpen}
        onOpenChange={(open) => {
          setIsDocumentDialogOpen(open);
          if (!open) setSelectedDocument(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document Verification Details</DialogTitle>
            <DialogDescription>
              Review AI verification results and detected issues
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <>
              <div className="border rounded-lg p-4">
                <div className="flex items-start gap-3 flex-1">
                  {selectedDocument.status === "Verified" ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : selectedDocument.status === "Under Review" ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#8B1538] uppercase tracking-wide mb-1">
                      {(selectedDocument.requirementLabel || 'Document requirement').replace(/\s+/g, ' ').trim()}
                    </p>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {selectedDocument.fileName || selectedDocument.name}
                      </h3>
                      <Badge className={getDocumentStatusColor(selectedDocument.status)}>
                        {selectedDocument.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-2">
                      <div>
                        <p className="text-xs text-gray-500">Student</p>
                        <p className="font-medium">{selectedDocument.studentName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Application ID</p>
                        <p className="font-medium">{selectedDocument.applicationId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Strand / Grade</p>
                        <p className="font-medium">
                          {selectedDocument.strand} - Grade {selectedDocument.gradeLevel}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Confidence Score</p>
                        <p className={`font-semibold ${getConfidenceColor(selectedDocument.aiConfidence)}`}>
                          {selectedDocument.aiConfidence}%
                        </p>
                      </div>
                    </div>
                    {(selectedDocument.issues?.length ?? 0) > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-medium text-red-700">
                          Detected Issues:
                        </p>
                        <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                          {(selectedDocument.issues ?? []).map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Verified: {selectedDocument.uploadedDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Preview — fetched with apiFetch so X-User-Id is sent (img src alone cannot) */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Uploaded Document</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadDocument(selectedDocument)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
                <div className="bg-white border rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center">
                  {previewLoading && (
                    <div className="flex flex-col items-center gap-2 py-12 text-gray-600">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-sm">Loading preview…</span>
                    </div>
                  )}
                  {!previewLoading && previewError && (
                    <Alert variant="destructive" className="m-4 border-red-200">
                      <AlertDescription>{previewError}</AlertDescription>
                    </Alert>
                  )}
                  {!previewLoading && !previewError && previewObjectUrl && (() => {
                    const kind =
                      previewDisplayKind ??
                      guessDocKind(selectedDocument.mimeType, selectedDocument.fileName || selectedDocument.name);
                    if (kind === "pdf") {
                      return (
                        <iframe
                          title="Document preview"
                          src={previewObjectUrl}
                          className="w-full min-h-[480px] border-0 bg-gray-100"
                        />
                      );
                    }
                    if (kind === "image") {
                      return (
                        <img
                          src={previewObjectUrl}
                          alt={selectedDocument.fileName || selectedDocument.name}
                          className="w-full h-auto max-h-[500px] object-contain"
                        />
                      );
                    }
                    return (
                      <div className="p-8 text-center text-sm text-gray-600">
                        <p className="mb-3">Preview is not available for this file type.</p>
                        <Button type="button" variant="outline" onClick={() => downloadDocument(selectedDocument)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download to open
                        </Button>
                      </div>
                    );
                  })()}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Preview loads securely for registrar accounts. Use Download to save a copy.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}