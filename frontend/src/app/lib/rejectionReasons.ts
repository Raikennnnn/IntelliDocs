export type RejectionReasonPreset = {
  value: string;
  label: string;
  template: string;
};

export const REJECTION_REASON_PRESETS: RejectionReasonPreset[] = [
  {
    value: "missing_requirement",
    label: "Missing required document(s)",
    template:
      "Missing required document(s). Please upload the missing requirement(s) and resubmit your application.",
  },
  {
    value: "unclear_scan",
    label: "Unclear / unreadable scan",
    template:
      "The uploaded document is unclear/unreadable (blurry, dark, or cut-off). Please re-upload a clear photo/scan (complete edges visible) and resubmit.",
  },
  {
    value: "wrong_document",
    label: "Wrong document type uploaded",
    template:
      "A wrong document type was uploaded for one of the requirements. Please upload the correct document and resubmit.",
  },
  {
    value: "mismatch_information",
    label: "Information mismatch",
    template:
      "The information on the submitted documents does not match your application details. Please verify your details and re-upload correct documents before resubmitting.",
  },
  {
    value: "tamper_detected",
    label: "Possible tampering / altered document",
    template:
      "Possible tampering or alteration was detected on the submitted document(s). Please submit an authentic/official copy and resubmit. If this is a mistake, contact the registrar for assistance.",
  },
  {
    value: "incomplete_set",
    label: "Incomplete submission / requirements not complete",
    template:
      "Your submission is incomplete. Please complete all required documents and resubmit your application.",
  },
  {
    value: "other",
    label: "Other (type my own)",
    template: "",
  },
];

export function getRejectionPresetByValue(value: string | null | undefined) {
  if (!value) return null;
  return REJECTION_REASON_PRESETS.find((p) => p.value === value) ?? null;
}

/** Presets tuned for rejecting a single document (re-upload required). */
export const DOCUMENT_REJECTION_PRESETS: RejectionReasonPreset[] = [
  {
    value: "unclear_document",
    label: "Not clear / unreadable",
    template:
      "Please re-upload a clearer copy. Text, headers, and seals must be readable and the full page should be visible.",
  },
  {
    value: "wrong_document_slot",
    label: "Wrong document for this requirement",
    template:
      "The file uploaded does not match this requirement. Please upload the correct document for this slot.",
  },
  {
    value: "incomplete_document",
    label: "Incomplete / cut-off page",
    template:
      "The document appears incomplete or cut off. Please re-upload a full, uncropped copy showing all required sections.",
  },
  {
    value: "mismatch_information",
    label: "Information does not match application",
    template:
      "The information on this document does not match the student's application details. Please verify and re-upload the correct document.",
  },
  {
    value: "tamper_detected",
    label: "Possible tampering / altered document",
    template:
      "Possible tampering or alteration was detected on this document. Please submit an authentic/official copy.",
  },
  {
    value: "other",
    label: "Other (type my own)",
    template: "",
  },
];

export function getDocumentRejectionPresetByValue(value: string | null | undefined) {
  if (!value) return null;
  return DOCUMENT_REJECTION_PRESETS.find((p) => p.value === value) ?? null;
}

