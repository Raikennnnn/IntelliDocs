import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { RejectionReasonPreset } from "../lib/rejectionReasons";

type RejectionReasonFieldsProps = {
  presets: RejectionReasonPreset[];
  presetValue: string;
  onPresetChange: (value: string) => void;
  remarks: string;
  onRemarksChange: (value: string) => void;
  remarksLabel?: string;
  presetId?: string;
  remarksId?: string;
  placeholder?: string;
  rows?: number;
  requiredHint?: string;
};

export function RejectionReasonFields({
  presets,
  presetValue,
  onPresetChange,
  remarks,
  onRemarksChange,
  remarksLabel = "Reason",
  presetId = "reject-reason-preset",
  remarksId = "reject-remarks",
  placeholder = "Enter the reason the student will see…",
  rows = 4,
  requiredHint = "A reason is required.",
}: RejectionReasonFieldsProps) {
  const handlePresetChange = (val: string) => {
    onPresetChange(val);
    const preset = presets.find((p) => p.value === val);
    if (preset && preset.value !== "other" && preset.template.trim()) {
      onRemarksChange(preset.template);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={presetId}>Reason preset</Label>
        <Select value={presetValue} onValueChange={handlePresetChange}>
          <SelectTrigger id={presetId}>
            <SelectValue placeholder="Select a preset (optional)" />
          </SelectTrigger>
          <SelectContent>
            {presets.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">
          Choose a preset to auto-fill the reason below, or pick &quot;Other&quot; to type your own.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={remarksId}>
          {remarksLabel} <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <textarea
          id={remarksId}
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full min-h-[120px] px-3 py-2 rounded-md border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-[#8B1538] focus:border-[#8B1538]"
        />
        {!remarks.trim() ? (
          <p className="text-xs text-gray-500">{requiredHint}</p>
        ) : null}
      </div>
    </div>
  );
}
