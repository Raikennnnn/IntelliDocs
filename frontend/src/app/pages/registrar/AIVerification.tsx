import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { verificationScoreTextClass } from "../../lib/verificationScoreColors";

type DocType =
  | "form137"
  | "sf10"
  | "sf9"
  | "good_moral"
  | "birth_certificate"
  | "other";

type VerifyStatus = "verified" | "failed";

interface VerifyApiResponse {
  status: VerifyStatus;
  confidence: number; // 0..1 verification score
  ocr_confidence?: number; // 0..1 readability
  tamper_score?: number; // 0..1 (1=clean, 0=suspicious)
  tamper_signals?: string[];
  extracted_text?: string;
  word_count?: number;
  issues?: string[];
}

interface VerificationHistoryItem {
  id: string;
  filename: string;
  docType: DocType;
  verifiedAt: string;
  result: VerifyApiResponse;
}

export function AIVerification() {
  const [docType, setDocType] = useState<DocType>("form137");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<VerificationHistoryItem | null>(null);
  const [history, setHistory] = useState<VerificationHistoryItem[]>([]);

  const AI_BASE_URL =
    (import.meta as any).env?.VITE_AI_BASE_URL || "http://127.0.0.1:5000";

  const statusBadge = (status: VerifyStatus) => {
    if (status === "verified") return <Badge className="bg-green-600">Verified</Badge>;
    return <Badge className="bg-red-600">Failed</Badge>;
  };

  const confidenceClass = (confidence01: number) =>
    verificationScoreTextClass(Math.round(confidence01 * 100));

  const runVerify = async () => {
    setError(null);
    if (!file) {
      setError("Please choose an image file first.");
      return;
    }

    const form = new FormData();
    form.append("image", file);
    form.append("doc_type", docType);

    setLoading(true);
    try {
      const res = await fetch(`${AI_BASE_URL}/verify`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as VerifyApiResponse | { error?: string };
      if (!res.ok) {
        const msg = (data as any)?.error || "AI verification failed.";
        throw new Error(msg);
      }
      const item: VerificationHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        filename: file.name,
        docType,
        verifiedAt: new Date().toLocaleString(),
        result: data as VerifyApiResponse,
      };
      setLatest(item);
      setHistory((prev) => [item, ...prev]);
    } catch (e: any) {
      setError(e?.message || "Unable to connect to the AI service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">
          AI Verification (Simple OCR)
        </h2>
        <p className="text-gray-600">
          Upload a document image and run OCR-based checks.
        </p>
      </div>

      {/* AI Overview Alert */}
      <Alert className="border-[#8B1538] bg-red-50">
        <Brain className="h-4 w-4 text-[#8B1538]" />
        <AlertDescription className="text-gray-700">
          <strong>AI Verification System:</strong> This uses a local Python OCR
          service (default{" "}
          <code className="font-mono">http://127.0.0.1:5000</code>). If you
          haven’t started it yet, run it from <code className="font-mono">ai/</code>.
        </AlertDescription>
      </Alert>

      {/* Verify form */}
      <Card>
        <CardHeader>
          <CardTitle>Run verification</CardTitle>
          <CardDescription>
            Upload an image (JPG/PNG) and choose the document type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Document type</div>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                className="h-10 w-full px-3 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
              >
                <option value="form137">SF10 / Form 137</option>
                <option value="sf10">SF10</option>
                <option value="sf9">SF9 / Report card</option>
                <option value="good_moral">Good moral</option>
                <option value="birth_certificate">Birth certificate</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-sm font-medium text-gray-700">Image file</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-900 hover:file:bg-gray-200"
              />
              {file ? (
                <div className="text-xs text-gray-600">
                  Selected: <span className="font-medium">{file.name}</span>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <Alert className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              className="bg-[#8B1538] hover:bg-[#8B1538]/90 text-white"
              onClick={runVerify}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Run AI verification"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setLatest(null);
                setError(null);
                setFile(null);
              }}
              disabled={loading}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Latest result */}
      {latest ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Latest result {statusBadge(latest.result.status)}
            </CardTitle>
            <CardDescription>
              {latest.filename} • {latest.docType} • {latest.verifiedAt}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-md">
                <div className="text-sm text-gray-600">Verification score</div>
                <div className={`text-2xl font-bold ${confidenceClass(latest.result.confidence)}`}>
                  {Math.round(latest.result.confidence * 100)}%
                </div>
              </div>
              <div className="p-4 border rounded-md">
                <div className="text-sm text-gray-600">OCR readability</div>
                <div className={`text-2xl font-bold ${confidenceClass(latest.result.ocr_confidence ?? 0)}`}>
                  {typeof latest.result.ocr_confidence === "number"
                    ? `${Math.round(latest.result.ocr_confidence * 100)}%`
                    : "-"}
                </div>
              </div>
              <div className="p-4 border rounded-md">
                <div className="text-sm text-gray-600">Words detected</div>
                <div className="text-2xl font-bold text-gray-900">
                  {latest.result.word_count ?? "-"}
                </div>
              </div>
            </div>
            <div className="p-4 border rounded-md">
              <div className="text-sm text-gray-600">Service</div>
              <div className="text-sm font-medium text-gray-900 break-all">
                {AI_BASE_URL}
              </div>
            </div>

            {latest.result.issues?.length ? (
              <div className="p-4 border border-yellow-200 rounded-md bg-yellow-50">
                <div className="text-sm font-medium text-yellow-800 mb-2">
                  Detected issues
                </div>
                <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                  {latest.result.issues.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Extracted text</div>
              <pre className="whitespace-pre-wrap text-sm p-4 border rounded-md bg-gray-50 max-h-64 overflow-auto">
                {latest.result.extracted_text || "(no text returned)"}
              </pre>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Verification history
          </CardTitle>
          <CardDescription>Results from this browser session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <div className="text-sm text-gray-600">No runs yet.</div>
          ) : (
            history.map((h) => (
              <div
                key={h.id}
                className="p-4 border rounded-lg hover:border-[#8B1538] transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {h.result.status === "verified" ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-medium text-gray-900">{h.filename}</div>
                        {statusBadge(h.result.status)}
                      </div>
                      <div className="text-sm text-gray-600">
                        Type: <span className="font-medium">{h.docType}</span> •{" "}
                        {h.verifiedAt}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Confidence:{" "}
                        <span className={`font-semibold ${confidenceClass(h.result.confidence)}`}>
                          {Math.round(h.result.confidence * 100)}%
                        </span>
                        {typeof h.result.word_count === "number" ? (
                          <span> • Words: {h.result.word_count}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLatest(h)}
                  >
                    View
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}