import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { 
  School, Save, AlertCircle, CheckCircle, Info 
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

type Strand = 'HUMSS' | 'TVL';

export function SectionSetup() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    capacity: 45,
    gradeLevel: '11' as '11' | '12',
    schoolYear: '2025-2026',
    strand: 'HUMSS' as Strand
  });

  const strands: Array<{ name: Strand; fullName: string }> = [
    { name: 'HUMSS', fullName: 'Humanities and Social Sciences' },
    { name: 'TVL', fullName: 'Technical-Vocational-Livelihood' }
  ];

  const schoolYears = [
    '2024-2025',
    '2025-2026',
    '2026-2027',
    '2027-2028'
  ];

  const handleCreateSection = () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error('Section name is required');
      return;
    }
    if (formData.capacity < 1 || formData.capacity > 100) {
      toast.error('Capacity must be between 1 and 100');
      return;
    }

    // Success
    toast.success(`Section ${formData.strand}-${formData.name} created successfully!`);
    
    // Navigate back to sections list
    navigate('/registrar/sections');
  };

  const handleCancel = () => {
    navigate('/registrar/sections');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Section Setup</h2>
          <p className="text-gray-600">Create a new section for student enrollment</p>
        </div>
        <School className="w-8 h-8 text-[#8B1538]" />
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <strong>Note:</strong> Adviser assignment for sections is handled by the Principal Portal. You can only set up the section details here.
        </AlertDescription>
      </Alert>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Section Details</CardTitle>
          <CardDescription>Fill in the information to create a new section</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1: Strand and Grade Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="strand" className="text-sm font-medium">
                Strand <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={formData.strand} 
                onValueChange={(value: Strand) => setFormData({ ...formData, strand: value })}
              >
                <SelectTrigger id="strand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {strands.map((strand) => (
                    <SelectItem key={strand.name} value={strand.name}>
                      <div>
                        <div className="font-semibold">{strand.name}</div>
                        <div className="text-xs text-gray-500">{strand.fullName}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Select the strand for this section</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gradeLevel" className="text-sm font-medium">
                Grade Level <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={formData.gradeLevel} 
                onValueChange={(value: '11' | '12') => setFormData({ ...formData, gradeLevel: value })}
              >
                <SelectTrigger id="gradeLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="11">Grade 11</SelectItem>
                  <SelectItem value="12">Grade 12</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Select grade level</p>
            </div>
          </div>

          {/* Row 2: School Year and Section Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="schoolYear" className="text-sm font-medium">
                School Year <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={formData.schoolYear} 
                onValueChange={(value) => setFormData({ ...formData, schoolYear: value })}
              >
                <SelectTrigger id="schoolYear">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Select the school year</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sectionName" className="text-sm font-medium">
                Section Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sectionName"
                type="text"
                placeholder="e.g., Sampaguita, Mabini, Tesla"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Enter the section name</p>
            </div>
          </div>

          {/* Row 3: Capacity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="capacity" className="text-sm font-medium">
                Section Capacity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="100"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                className="w-full"
              />
              <p className="text-xs text-gray-500">Maximum number of students (1-100)</p>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#2D5016]" />
              Section Summary
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Full Section Name:</span>
                <p className="font-semibold text-gray-900">
                  {formData.strand} {formData.gradeLevel}-{formData.name || '___'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Capacity:</span>
                <p className="font-semibold text-gray-900">{formData.capacity} students</p>
              </div>
              <div>
                <span className="text-gray-600">School Year:</span>
                <p className="font-semibold text-gray-900">{formData.schoolYear}</p>
              </div>
              <div>
                <span className="text-gray-600">Grade Level:</span>
                <p className="font-semibold text-gray-900">Grade {formData.gradeLevel}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSection}
              className="bg-[#2D5016] hover:bg-[#1f3810]"
            >
              <Save className="w-4 h-4 mr-2" />
              Create Section
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Guidelines Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#8B1538]" />
            Section Setup Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-[#2D5016] mt-1">•</span>
              <span>Section names should be unique within the same strand and school year</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#2D5016] mt-1">•</span>
              <span>Recommended capacity is 40-45 students per section for optimal class management</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#2D5016] mt-1">•</span>
              <span>Section advisers are assigned by the Principal after section creation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#2D5016] mt-1">•</span>
              <span>Grade 11 sections are typically created for incoming Senior High School students</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#2D5016] mt-1">•</span>
              <span>Grade 12 sections should already have existing students from the previous year</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}