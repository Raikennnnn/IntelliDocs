import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Search, Eye, CheckCircle, XCircle, Users, FileText, Calendar, Mail, Phone, MapPin, User, ArrowRightLeft, AlertTriangle, Clock, Info, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '../../components/ui/alert';

type DocumentStatus = 'submitted' | 'pending' | 'verified';
type StudentType = 'Regular' | 'Transferee' | 'Returnee';

type Document = {
  name: string;
  status: DocumentStatus;
  dateSubmitted?: string;
  verifiedBy?: string;
  required: boolean;
};

type Student = {
  id: number;
  studentNumber?: string;
  name: string;
  lrn: string;
  strand: string;
  section: string;
  gradeLevel: number;
  schoolYear?: string;
  enrollmentStatus: 'Enrolled' | 'Pending' | 'Blocked';
  documentsComplete: boolean;
  email: string;
  contactNumber: string;
  birthDate?: string;
  address?: string;
  guardianName?: string;
  guardianContact?: string;
  enrollmentDate?: string;
  studentType: StudentType;
  previousSchool?: string;
  documents?: Document[];
};

export function StudentRecords() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStrand, setFilterStrand] = useState<string>('all');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStudentType, setFilterStudentType] = useState<string>('all');
  const [filterDocStatus, setFilterDocStatus] = useState<string>('all');
  const [filterSchoolYear, setFilterSchoolYear] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferStudent, setTransferStudent] = useState<Student | null>(null);
  
  const [transferForm, setTransferForm] = useState({
    gradeLevel: '11' as '11' | '12',
    strand: 'HUMSS',
    section: '',
    schoolYear: '2025-2026'
  });

  const sections: Record<string, string[]> = {
    HUMSS: ['Luna', 'Del Pilar', 'Silang', 'Quezon'],
    TVL: ['Burgos', 'Ponce', 'Lopez', 'Laurel']
  };

  const schoolYears = ['2024-2025', '2025-2026', '2026-2027'];

  const [students, setStudents] = useState<Student[]>([
    {
      id: 1,
      name: 'Juan Dela Cruz',
      lrn: '123456789012',
      strand: 'HUMSS',
      section: 'Luna',
      gradeLevel: 12,
      enrollmentStatus: 'Enrolled',
      documentsComplete: true,
      email: 'juan.delacruz@school.edu.ph',
      contactNumber: '09171234567',
      birthDate: 'March 15, 2008',
      address: '123 Marikina Heights, Marikina City',
      guardianName: 'Pedro Dela Cruz',
      guardianContact: '09171234568',
      enrollmentDate: 'August 15, 2025',
      studentType: 'Regular',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-08-10', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-08-10', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'verified', dateSubmitted: '2025-08-10', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Medical Certificate', status: 'verified', dateSubmitted: '2025-08-12', verifiedBy: 'Ms. Santos', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-08-10', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
    {
      id: 2,
      name: 'Maria Clara',
      lrn: '123456789016',
      strand: 'HUMSS',
      section: 'Luna',
      gradeLevel: 12,
      enrollmentStatus: 'Enrolled',
      documentsComplete: true,
      email: 'maria.clara@school.edu.ph',
      contactNumber: '09181234567',
      birthDate: 'July 22, 2008',
      address: '456 Concepcion Uno, Marikina City',
      guardianName: 'Rosa Clara',
      guardianContact: '09181234568',
      enrollmentDate: 'August 16, 2025',
      studentType: 'Regular',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-08-11', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-08-11', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'verified', dateSubmitted: '2025-08-11', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Medical Certificate', status: 'verified', dateSubmitted: '2025-08-14', verifiedBy: 'Ms. Santos', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-08-11', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
    {
      id: 3,
      name: 'Jose Rizal Jr.',
      lrn: '123456789017',
      strand: 'HUMSS',
      section: 'Del Pilar',
      gradeLevel: 12,
      enrollmentStatus: 'Enrolled',
      documentsComplete: false,
      email: 'jose.rizal@school.edu.ph',
      contactNumber: '09191234567',
      birthDate: 'June 19, 2008',
      address: '789 Parang, Marikina City',
      guardianName: 'Jose Rizal Sr.',
      guardianContact: '09191234568',
      enrollmentDate: 'August 18, 2025',
      studentType: 'Regular',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-08-12', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-08-12', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'submitted', dateSubmitted: '2025-08-12', required: true },
        { name: 'Medical Certificate', status: 'pending', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-08-12', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
    {
      id: 4,
      name: 'Ana Santos',
      lrn: '123456789018',
      strand: 'HUMSS',
      section: 'Del Pilar',
      gradeLevel: 12,
      enrollmentStatus: 'Enrolled',
      documentsComplete: true,
      email: 'ana.santos@school.edu.ph',
      contactNumber: '09201234567',
      birthDate: 'September 10, 2008',
      address: '321 San Roque, Marikina City',
      guardianName: 'Miguel Santos',
      guardianContact: '09201234568',
      enrollmentDate: 'August 20, 2025',
      studentType: 'Regular',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-08-15', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-08-15', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'verified', dateSubmitted: '2025-08-15', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Medical Certificate', status: 'verified', dateSubmitted: '2025-08-17', verifiedBy: 'Ms. Santos', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-08-15', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
    {
      id: 5,
      name: 'Carlos Reyes',
      lrn: '123456789019',
      strand: 'TVL',
      section: 'Burgos',
      gradeLevel: 11,
      enrollmentStatus: 'Enrolled',
      documentsComplete: false,
      email: 'carlos.reyes@school.edu.ph',
      contactNumber: '09211234567',
      birthDate: 'November 5, 2009',
      address: '654 Nangka, Marikina City',
      guardianName: 'Elena Reyes',
      guardianContact: '09211234568',
      enrollmentDate: 'August 22, 2025',
      studentType: 'Transferee',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-08-18', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'submitted', dateSubmitted: '2025-08-18', required: true },
        { name: 'Certificate of Good Moral', status: 'submitted', dateSubmitted: '2025-08-18', required: true },
        { name: 'Medical Certificate', status: 'pending', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-08-18', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Transfer Credentials', status: 'submitted', dateSubmitted: '2025-08-18', required: true },
      ]
    },
    {
      id: 6,
      name: 'Isabella Garcia',
      lrn: '123456789020',
      strand: 'HUMSS',
      section: 'Luna',
      gradeLevel: 11,
      enrollmentStatus: 'Enrolled',
      documentsComplete: true,
      email: 'isabella.garcia@school.edu.ph',
      contactNumber: '09221234567',
      birthDate: 'February 14, 2009',
      address: '987 Tumana, Marikina City',
      guardianName: 'Ricardo Garcia',
      guardianContact: '09221234568',
      enrollmentDate: 'August 25, 2025',
      studentType: 'Regular',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-08-20', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-08-20', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'verified', dateSubmitted: '2025-08-20', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Medical Certificate', status: 'verified', dateSubmitted: '2025-08-22', verifiedBy: 'Ms. Santos', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-08-20', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
    {
      id: 7,
      name: 'Miguel Torres',
      lrn: '123456789021',
      strand: 'TVL',
      section: 'Burgos',
      gradeLevel: 11,
      enrollmentStatus: 'Pending',
      documentsComplete: false,
      email: 'miguel.torres@school.edu.ph',
      contactNumber: '09231234567',
      birthDate: 'April 30, 2009',
      address: '147 Industrial Valley, Marikina City',
      guardianName: 'Carmen Torres',
      guardianContact: '09231234568',
      enrollmentDate: 'August 28, 2025',
      studentType: 'Regular',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'submitted', dateSubmitted: '2025-08-25', required: true },
        { name: 'Form 138 (Report Card)', status: 'pending', required: true },
        { name: 'Certificate of Good Moral', status: 'pending', required: true },
        { name: 'Medical Certificate', status: 'pending', required: true },
        { name: '2x2 ID Picture', status: 'pending', required: true },
      ]
    },
    {
      id: 8,
      name: 'Sofia Lopez',
      lrn: '123456789022',
      strand: 'TVL',
      section: 'Ponce',
      gradeLevel: 12,
      enrollmentStatus: 'Enrolled',
      documentsComplete: true,
      email: 'sofia.lopez@school.edu.ph',
      contactNumber: '09241234567',
      birthDate: 'December 8, 2008',
      address: '258 Fortune, Marikina City',
      guardianName: 'Antonio Lopez',
      guardianContact: '09241234568',
      enrollmentDate: 'August 30, 2025',
      studentType: 'Regular',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-08-26', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-08-26', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'verified', dateSubmitted: '2025-08-26', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Medical Certificate', status: 'verified', dateSubmitted: '2025-08-28', verifiedBy: 'Ms. Santos', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-08-26', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
    {
      id: 9,
      studentNumber: '2025-0009',
      name: 'Patricia Mendoza',
      lrn: '987654321001',
      strand: 'HUMSS',
      section: 'Del Pilar',
      gradeLevel: 12,
      schoolYear: '2025-2026',
      enrollmentStatus: 'Enrolled',
      documentsComplete: true,
      email: 'patricia.mendoza@school.edu.ph',
      contactNumber: '09251234567',
      birthDate: 'January 20, 2008',
      address: '741 Concepcion Dos, Marikina City',
      guardianName: 'Roberto Mendoza',
      guardianContact: '09251234568',
      enrollmentDate: 'September 2, 2025',
      studentType: 'Transferee',
      previousSchool: 'Marikina Science High School',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-08-28', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-08-28', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'verified', dateSubmitted: '2025-08-28', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Medical Certificate', status: 'verified', dateSubmitted: '2025-08-30', verifiedBy: 'Ms. Santos', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-08-28', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Transfer Credentials (Form 137)', status: 'verified', dateSubmitted: '2025-08-28', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
    {
      id: 10,
      studentNumber: '2024-0156',
      name: 'Rafael Santos',
      lrn: '987654321002',
      strand: 'HUMSS',
      section: 'Silang',
      gradeLevel: 12,
      schoolYear: '2025-2026',
      enrollmentStatus: 'Enrolled',
      documentsComplete: true,
      email: 'rafael.santos@school.edu.ph',
      contactNumber: '09261234567',
      birthDate: 'May 5, 2008',
      address: '852 Kalumpang, Marikina City',
      guardianName: 'Gloria Santos',
      guardianContact: '09261234568',
      enrollmentDate: 'September 5, 2025',
      studentType: 'Returnee',
      previousSchool: 'Nuestra Señora De Guia Academy (Former Student)',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-09-01', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-09-01', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'verified', dateSubmitted: '2025-09-01', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Medical Certificate', status: 'verified', dateSubmitted: '2025-09-03', verifiedBy: 'Ms. Santos', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-09-01', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
    {
      id: 11,
      studentNumber: '2025-0010',
      name: 'Katrina Velasco',
      lrn: '987654321003',
      strand: 'TVL',
      section: 'Lopez',
      gradeLevel: 12,
      schoolYear: '2025-2026',
      enrollmentStatus: 'Blocked',
      documentsComplete: false,
      email: 'katrina.velasco@school.edu.ph',
      contactNumber: '09271234567',
      birthDate: 'October 12, 2008',
      address: '963 Santo Niño, Marikina City',
      guardianName: 'Teresa Velasco',
      guardianContact: '09271234568',
      enrollmentDate: 'September 8, 2025',
      studentType: 'Transferee',
      previousSchool: 'Antipolo National High School',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-09-05', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'submitted', dateSubmitted: '2025-09-05', required: true },
        { name: 'Certificate of Good Moral', status: 'pending', required: true },
        { name: 'Medical Certificate', status: 'pending', required: true },
        { name: '2x2 ID Picture', status: 'submitted', dateSubmitted: '2025-09-05', required: true },
        { name: 'Transfer Credentials (Form 137)', status: 'submitted', dateSubmitted: '2025-09-05', required: true },
      ]
    },
    {
      id: 12,
      studentNumber: '2024-0089',
      name: 'Marco Alvarez',
      lrn: '987654321004',
      strand: 'TVL',
      section: 'Ponce',
      gradeLevel: 12,
      schoolYear: '2025-2026',
      enrollmentStatus: 'Pending',
      documentsComplete: false,
      email: 'marco.alvarez@school.edu.ph',
      contactNumber: '09281234567',
      birthDate: 'August 18, 2008',
      address: '159 Malanday, Marikina City',
      guardianName: 'Linda Alvarez',
      guardianContact: '09281234568',
      enrollmentDate: 'September 10, 2025',
      studentType: 'Returnee',
      previousSchool: 'Nuestra Señora De Guia Academy (Former Student)',
      documents: [
        { name: 'Birth Certificate (PSA)', status: 'verified', dateSubmitted: '2025-09-07', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Form 138 (Report Card)', status: 'verified', dateSubmitted: '2025-09-07', verifiedBy: 'Ms. Santos', required: true },
        { name: 'Certificate of Good Moral', status: 'submitted', dateSubmitted: '2025-09-07', required: true },
        { name: 'Medical Certificate', status: 'pending', required: true },
        { name: '2x2 ID Picture', status: 'verified', dateSubmitted: '2025-09-07', verifiedBy: 'Ms. Santos', required: true },
      ]
    },
  ]);

  // Helper function to check if all required documents are verified
  const checkDocumentCompleteness = (docs?: Document[]): boolean => {
    if (!docs) return false;
    const requiredDocs = docs.filter(d => d.required);
    return requiredDocs.every(d => d.status === 'verified');
  };

  // Helper function to get document status summary
  const getDocumentSummary = (docs?: Document[]) => {
    if (!docs) return { total: 0, verified: 0, submitted: 0, pending: 0 };
    const required = docs.filter(d => d.required);
    const verified = required.filter(d => d.status === 'verified').length;
    const submitted = required.filter(d => d.status === 'submitted').length;
    const pending = required.filter(d => d.status === 'pending').length;
    return { total: required.length, verified, submitted, pending };
  };

  const handleTransferStudent = (student: Student) => {
    setTransferStudent(student);
    setTransferForm({
      gradeLevel: student.gradeLevel.toString() as '11' | '12',
      strand: student.strand,
      section: student.section,
      schoolYear: student.schoolYear || '2025-2026'
    });
    setIsTransferDialogOpen(true);
  };

  const handleSaveTransfer = () => {
    if (!transferStudent) return;
    if (!transferForm.section) {
      toast.error('Please select a section');
      return;
    }

    setStudents(students.map(s => 
      s.id === transferStudent.id 
        ? {
            ...s,
            gradeLevel: parseInt(transferForm.gradeLevel),
            strand: transferForm.strand,
            section: transferForm.section,
            schoolYear: transferForm.schoolYear
          }
        : s
    ));

    toast.success(`Student ${transferStudent.name} successfully transferred to ${transferForm.strand}-${transferForm.section}!`);
    setIsTransferDialogOpen(false);
    setTransferStudent(null);
  };

  const handleCompleteEnrollment = (student: Student) => {
    if (!student.documentsComplete) {
      const summary = getDocumentSummary(student.documents);
      toast.error(`Cannot complete enrollment: ${summary.pending} pending, ${summary.submitted} submitted documents need verification`);
      return;
    }

    setStudents(students.map(s => 
      s.id === student.id 
        ? { ...s, enrollmentStatus: 'Enrolled' as const }
        : s
    ));

    toast.success(`Enrollment completed for ${student.name}!`);
  };

  // Get unique sections based on selected strand
  const getAvailableSections = () => {
    if (filterStrand === 'all') return ['all'];
    const sectionsMap: Record<string, string[]> = {
      HUMSS: ['Luna', 'Del Pilar', 'Silang', 'Quezon'],
      TVL: ['Burgos', 'Ponce', 'Lopez', 'Laurel']
    };
    return ['all', ...(sectionsMap[filterStrand] || [])];
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lrn.includes(searchTerm) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStrand = filterStrand === 'all' || student.strand === filterStrand;
    const matchesSection = filterSection === 'all' || student.section === filterSection;
    const matchesGrade = filterGradeLevel === 'all' || student.gradeLevel.toString() === filterGradeLevel;
    const matchesStatus = filterStatus === 'all' || student.enrollmentStatus === filterStatus;
    const matchesStudentType = filterStudentType === 'all' || student.studentType === filterStudentType;
    const matchesDocStatus = filterDocStatus === 'all' || (student.documents && student.documents.some(doc => doc.status === filterDocStatus));
    const matchesSchoolYear = filterSchoolYear === 'all' || student.schoolYear === filterSchoolYear;
    return matchesSearch && matchesStrand && matchesSection && matchesGrade && matchesStatus && matchesStudentType && matchesDocStatus && matchesSchoolYear;
  });

  const totalEnrolled = filteredStudents.filter(s => s.enrollmentStatus === 'Enrolled').length;
  const totalPending = filteredStudents.filter(s => s.enrollmentStatus === 'Pending').length;
  const documentsComplete = filteredStudents.filter(s => s.documentsComplete).length;
  const documentsIncomplete = filteredStudents.filter(s => !s.documentsComplete).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Student Records</h2>
        <p className="text-gray-600">Search and manage student information</p>
      </div>

      {/* Filters Card - Dropdown Style */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Student Records</CardTitle>
          <CardDescription>Use filters to find specific students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Row 1: Search */}
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Student</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, LRN, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                />
              </div>
            </div>

            {/* Row 2: Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              {/* Strand Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strand</label>
                <Select 
                  value={filterStrand} 
                  onValueChange={(val) => {
                    setFilterStrand(val);
                    setFilterSection('all'); // Reset section when strand changes
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strands</SelectItem>
                    <SelectItem value="HUMSS">HUMSS</SelectItem>
                    <SelectItem value="TVL">TVL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Section Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <Select 
                  value={filterSection} 
                  onValueChange={setFilterSection}
                  disabled={filterStrand === 'all'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={filterStrand === 'all' ? 'Select strand first' : 'All Sections'} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableSections().map((section) => (
                      <SelectItem key={section} value={section}>
                        {section === 'all' ? 'All Sections' : section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grade Level Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
                <Select value={filterGradeLevel} onValueChange={setFilterGradeLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    <SelectItem value="11">Grade 11</SelectItem>
                    <SelectItem value="12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Enrolled">Enrolled</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Student Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Student Type</label>
                <Select value={filterStudentType} onValueChange={setFilterStudentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="Transferee">Transferee</SelectItem>
                    <SelectItem value="Returnee">Returnee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Document Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Status</label>
                <Select value={filterDocStatus} onValueChange={setFilterDocStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* School Year Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School Year</label>
                <Select value={filterSchoolYear} onValueChange={setFilterSchoolYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {schoolYears.map((year) => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reset Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStrand('all');
                  setFilterSection('all');
                  setFilterGradeLevel('all');
                  setFilterStatus('all');
                  setFilterStudentType('all');
                  setFilterDocStatus('all');
                  setFilterSchoolYear('all');
                }}
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{filteredStudents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">{totalEnrolled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Documents Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{documentsComplete}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Documents Incomplete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{documentsIncomplete}</div>
          </CardContent>
        </Card>
      </div>

      {/* Student Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#8B1538]" />
                Student Records
              </CardTitle>
              <CardDescription>Complete list of students matching your filters</CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {filteredStudents.length} Records
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>LRN</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Strand</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-center">Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Documents</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student, index) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{student.lrn}</TableCell>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.strand}</Badge>
                    </TableCell>
                    <TableCell>{student.section}</TableCell>
                    <TableCell className="text-center">Grade {student.gradeLevel}</TableCell>
                    <TableCell>
                      <Badge 
                        className={student.enrollmentStatus === 'Enrolled' ? 'bg-[#2D5016]' : 'bg-orange-600'}
                      >
                        {student.enrollmentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {student.documentsComplete ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <XCircle className="w-3 h-3 mr-1" />
                          Incomplete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(student)}>
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader className="pb-4">
                            <DialogTitle>Student Details & Records</DialogTitle>
                            <DialogDescription>Complete student information and submitted documents</DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-5">
                            {/* Student Header */}
                            <div className="flex items-center gap-4 pb-4 border-b">
                              <div className="w-16 h-16 rounded-full bg-[#8B1538] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                                {student.name.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-xl font-bold text-gray-900">{student.name}</h3>
                                <p className="text-xs text-gray-600 font-mono mt-0.5">LRN: {student.lrn}</p>
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">{student.strand} - {student.section}</Badge>
                                  <Badge className={`text-xs ${student.enrollmentStatus === 'Enrolled' ? 'bg-[#2D5016] hover:bg-[#2D5016]' : 'bg-orange-600 hover:bg-orange-600'}`}>
                                    {student.enrollmentStatus}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">Grade {student.gradeLevel}</Badge>
                                </div>
                              </div>
                            </div>

                            {/* Main Content - 2 Column Layout */}
                            <div className="grid grid-cols-2 gap-6">
                              {/* Left Column */}
                              <div className="space-y-5">
                                {/* Personal Information */}
                                <div>
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4 text-[#8B1538]"/>
                                    Personal Information
                                  </h4>
                                  <div className="space-y-3">
                                    <div className="flex items-start gap-2">
                                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-500">Birth Date</p>
                                        <p className="text-sm font-medium text-gray-900">{student.birthDate || 'N/A'}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Student Type</p>
                                      <p className="text-sm font-medium text-gray-900">{student.studentType || 'N/A'}</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-500">Address</p>
                                        <p className="text-sm font-medium text-gray-900">{student.address || 'N/A'}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Contact Information */}
                                <div>
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-[#8B1538]"/>
                                    Contact Information
                                  </h4>
                                  <div className="space-y-3">
                                    <div className="flex items-start gap-2">
                                      <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-500">Email Address</p>
                                        <p className="text-sm font-medium text-gray-900 break-all">{student.email}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-500">Contact Number</p>
                                        <p className="text-sm font-medium text-gray-900">{student.contactNumber}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Guardian Information */}
                                <div>
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-[#8B1538]"/>
                                    Guardian Information
                                  </h4>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-xs text-gray-500">Guardian Name</p>
                                      <p className="text-sm font-medium text-gray-900">{student.guardianName || 'N/A'}</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"/>
                                      <div className="flex-1">
                                        <p className="text-xs text-gray-500">Guardian Contact</p>
                                        <p className="text-sm font-medium text-gray-900">{student.guardianContact || 'N/A'}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column */}
                              <div className="space-y-5">
                                {/* Academic Information */}
                                <div>
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-[#8B1538]"/>
                                    Academic Information
                                  </h4>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    <div>
                                      <p className="text-xs text-gray-500">Grade Level</p>
                                      <p className="text-sm font-medium text-gray-900">Grade {student.gradeLevel}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Strand</p>
                                      <p className="text-sm font-medium text-gray-900">{student.strand}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Section</p>
                                      <p className="text-sm font-medium text-gray-900">{student.section}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Enrollment Date</p>
                                      <p className="text-sm font-medium text-gray-900">{student.enrollmentDate || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-xs text-gray-500 mb-1">Enrollment Status</p>
                                      <Badge className={`${student.enrollmentStatus === 'Enrolled' ? 'bg-[#2D5016] hover:bg-[#2D5016]' : 'bg-orange-600 hover:bg-orange-600'}`}>
                                        {student.enrollmentStatus}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {/* Submitted Documents */}
                                <div>
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-[#8B1538]"/>
                                    Submitted Documents
                                  </h4>
                                  <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-gray-50">
                                          <TableHead className="text-xs py-2 font-semibold">Document Name</TableHead>
                                          <TableHead className="text-xs py-2 font-semibold">Status</TableHead>
                                          <TableHead className="text-xs py-2 font-semibold">Date</TableHead>
                                          <TableHead className="text-xs py-2 font-semibold">Verified By</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {student.documents && student.documents.length > 0 ? (
                                          student.documents.map((doc, index) => (
                                            <TableRow key={index}>
                                              <TableCell className="py-2.5 text-xs font-medium">
                                                <div className="flex items-center gap-2">
                                                  <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                                                  <span>{doc.name}</span>
                                                </div>
                                              </TableCell>
                                              <TableCell className="py-2.5">
                                                {doc.status === 'verified' && (
                                                  <div className="flex items-center gap-1.5 text-green-700">
                                                    <CheckCircle className="w-3.5 h-3.5"/>
                                                    <span className="text-xs font-medium">Verified</span>
                                                  </div>
                                                )}
                                                {doc.status === 'submitted' && (
                                                  <span className="text-xs font-medium text-blue-700">Submitted</span>
                                                )}
                                                {doc.status === 'pending' && (
                                                  <span className="text-xs font-medium text-orange-700">Pending</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="py-2.5 text-xs text-gray-600">
                                                {doc.dateSubmitted || '-'}
                                              </TableCell>
                                              <TableCell className="py-2.5 text-xs text-gray-600">
                                                {doc.verifiedBy || '-'}
                                              </TableCell>
                                            </TableRow>
                                          ))
                                        ) : (
                                          <TableRow>
                                            <TableCell colSpan={4} className="text-center py-6 text-gray-500 text-xs">
                                              No documents submitted yet
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No students found matching your search criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transfer Management Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#8B1538]"/>
              Transfer Management
            </DialogTitle>
            <DialogDescription>
              Manually assign grade level, section, and school year for {transferStudent?.studentType?.toLowerCase()} student
            </DialogDescription>
          </DialogHeader>

          {transferStudent && (
            <div className="space-y-4">
              {/* Student Info */}
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600"/>
                <AlertDescription className="text-blue-900 text-sm">
                  <strong>Student:</strong> {transferStudent.name} • <strong>Type:</strong> {transferStudent.studentType}
                  {transferStudent.previousSchool && <> • <strong>From:</strong> {transferStudent.previousSchool}</>}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Grade Level <span className="text-red-600">*</span></Label>
                  <Select 
                    value={transferForm.gradeLevel} 
                    onValueChange={(val) => setTransferForm({...transferForm, gradeLevel: val as '11' | '12'})}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="11">Grade 11</SelectItem>
                      <SelectItem value="12">Grade 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>School Year <span className="text-red-600">*</span></Label>
                  <Select 
                    value={transferForm.schoolYear} 
                    onValueChange={(val) => setTransferForm({...transferForm, schoolYear: val})}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Strand <span className="text-red-600">*</span></Label>
                  <Select 
                    value={transferForm.strand} 
                    onValueChange={(val) => {
                      setTransferForm({...transferForm, strand: val, section: ''});
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HUMSS">HUMSS</SelectItem>
                      <SelectItem value="TVL">TVL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Section <span className="text-red-600">*</span></Label>
                  <Select 
                    value={transferForm.section} 
                    onValueChange={(val) => setTransferForm({...transferForm, section: val})}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select section"/>
                    </SelectTrigger>
                    <SelectContent>
                      {sections[transferForm.strand]?.map((section) => (
                        <SelectItem key={section} value={section}>{section}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4"/>
                <AlertDescription className="text-sm">
                  <strong>Note:</strong> This will update the student's academic placement. Ensure all transfer documents are verified before finalizing enrollment.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTransfer} className="bg-[#8B1538] hover:bg-[#6c102c]">
              <CheckCircle className="w-4 h-4 mr-2"/>
              Save Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}