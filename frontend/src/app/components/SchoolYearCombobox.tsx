import { Combobox } from "./Combobox";

type SchoolYearComboboxProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function SchoolYearCombobox({
  id,
  value,
  onChange,
  options,
  placeholder = "e.g. 2023-2024",
  className,
  disabled = false,
}: SchoolYearComboboxProps) {
  return (
    <Combobox
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      inputMode="numeric"
      pattern="\d{4}(-\d{4})?"
      maxLength={9}
      ariaLabel="Show school year options"
    />
  );
}
