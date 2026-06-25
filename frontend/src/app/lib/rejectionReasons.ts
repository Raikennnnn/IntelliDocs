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

