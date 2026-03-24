import { Badge } from './ui/badge';
import { useSchoolYearOptions } from '../context/SchoolYearContext';
import { Calendar } from 'lucide-react';

interface SchoolYearFilterProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  showActiveIndicator?: boolean;
  className?: string;
}

export function SchoolYearFilter({
  value,
  onChange,
  label = 'School Year',
  required = false,
  showActiveIndicator = true,
  className = ''
}: SchoolYearFilterProps) {
  const { options, defaultValue } = useSchoolYearOptions();
  
  // Use default value if no value is provided
  const currentValue = value || defaultValue;
  
  // Find if selected school year is active
  const selectedOption = options.find(opt => opt.value === currentValue);
  const isActive = selectedOption?.isActive;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {label}
          {required && <span className="text-red-600">*</span>}
        </div>
      </label>
      <div className="relative">
        <select
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538] appearance-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {showActiveIndicator && isActive && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <Badge className="bg-[#2D5016] hover:bg-[#2D5016] text-xs">Active</Badge>
          </div>
        )}
      </div>
      {showActiveIndicator && isActive && (
        <p className="text-xs text-green-600 mt-1 font-medium">
          ✓ Currently accepting enrollments
        </p>
      )}
      {showActiveIndicator && !isActive && (
        <p className="text-xs text-gray-500 mt-1">
          Historical data - Not accepting new enrollments
        </p>
      )}
    </div>
  );
}
