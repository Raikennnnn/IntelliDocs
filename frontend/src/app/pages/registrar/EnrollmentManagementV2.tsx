import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  CheckCircle, XCircle, Eye, Clock, AlertCircle, Users, Search, 
  FileCheck, FileText, MessageSquare, History, Mail, KeyRound, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { PDFViewerList } from '../../components/PDFViewer';

type Strand = 'HUMSS' | 'TVL';
type EnrollmentStatus = 'Pending Review' | 'Approved' | 'Rejected';

interface DocumentFile {
  name: string;
  type: string;
  url: string;
  uploadedDate: string;
}

interface AuditEntry {
  action: string;
  performedBy: string;
  performedAt: string;
  comments?: string;
}

interface Application {
  id: string;
  studentName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthdate: string;
  lrn: string;
  gradeLevel: string;
  strand: Strand;
  status: EnrollmentStatus;
  applicationDate: string;
  documents: string[];
  documentFiles: DocumentFile[];
  email: string;
  contactNumber: string;
  section?: string;
  auditTrail: AuditEntry[];
  accountReleased?: boolean;
}

export function EnrollmentManagement() {
  const [selectedStrand, setSelectedStrand] = useState<Strand | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [actionComment, setActionComment] = useState('');
  const [currentAction, setCurrentAction] = useState<'approve' | 'reject' | 'verify-payment' | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);

  const strands: Array<{ name: Strand; fullName: string }> = [
    { name: 'HUMSS', fullName: 'Humanities and Social Sciences' },
    { name: 'TVL', fullName: 'Technical-Vocational-Livelihood' }
  ];

  const strandQuotas = {
    HUMSS: { quota: 135, enrolled: 120 },
    TVL: { quota: 135, enrolled: 97 }
  };

  const [applications, setApplications] = useState<Application[]>([
    {
      id: 'ENR001',
      studentName: 'Carlos Rodriguez',
      firstName: 'Carlos',
      middleName: '',
      lastName: 'Rodriguez',
      birthdate: '2005-05-15',
      lrn: '123456789013',
      gradeLevel: '11',
      strand: 'HUMSS',
      status: 'Pending Review',
      applicationDate: '2026-02-20',
      documents: ['Birth Certificate', 'Form 138', 'Good Moral'],
      documentFiles: [
        { name: 'Birth Certificate - Carlos Rodriguez.pdf', type: 'Birth Certificate', url: '#', uploadedDate: '2026-02-20' },
        { name: 'Form 138 - Carlos Rodriguez.pdf', type: 'Form 138 (Report Card)', url: '#', uploadedDate: '2026-02-20' },
        { name: 'Good Moral Certificate - Carlos Rodriguez.pdf', type: 'Good Moral Certificate', url: '#', uploadedDate: '2026-02-20' }
      ],
      email: 'carlos.rodriguez@email.com',
      contactNumber: '09171234567',
      auditTrail: [
        { action: 'Application Submitted', performedBy: 'Carlos Rodriguez (Student)', performedAt: '2026-02-20 09:30 AM' }
      ]
    },
    {
      id: 'ENR002',
      studentName: 'Anna Marie Torres',
      firstName: 'Anna',
      middleName: 'Marie',
      lastName: 'Torres',
      birthdate: '2004-07-25',
      lrn: '123456789014',
      gradeLevel: '12',
      strand: 'HUMSS',
      status: 'Approved',
      applicationDate: '2026-02-18',
      section: 'HUMSS-Luna',
      documents: ['Birth Certificate', 'Form 138', 'Good Moral', 'Report Card'],
      documentFiles: [
        { name: 'Birth Certificate - Anna Marie Torres.pdf', type: 'Birth Certificate', url: '#', uploadedDate: '2026-02-18' },
        { name: 'Form 138 - Anna Marie Torres.pdf', type: 'Form 138 (Report Card)', url: '#', uploadedDate: '2026-02-18' },
        { name: 'Good Moral Certificate - Anna Marie Torres.pdf', type: 'Good Moral Certificate', url: '#', uploadedDate: '2026-02-18' },
        { name: 'Report Card Grade 11 - Anna Marie Torres.pdf', type: 'Report Card', url: '#', uploadedDate: '2026-02-18' }
      ],
      email: 'anna.torres@email.com',
      contactNumber: '09181234567',
      auditTrail: [
        { action: 'Application Submitted', performedBy: 'Anna Marie Torres (Student)', performedAt: '2026-02-18 10:15 AM' },
        { action: 'Documents Reviewed', performedBy: 'Mrs. Maria Santos (Registrar)', performedAt: '2026-02-18 02:30 PM', comments: 'All documents complete and verified' },
        { action: 'Approved', performedBy: 'Mrs. Maria Santos (Registrar)', performedAt: '2026-02-19 09:15 AM', comments: 'Enrollment approved. Assigned to HUMSS-Luna section.' }
      ]
    },
    {
      id: 'ENR003',
      studentName: 'Miguel Santos',
      firstName: 'Miguel',
      middleName: '',
      lastName: 'Santos',
      birthdate: '2005-03-10',
      lrn: '123456789015',
      gradeLevel: '11',
      strand: 'TVL',
      status: 'Rejected',
      applicationDate: '2026-02-15',
      documents: ['Birth Certificate'],
      documentFiles: [
        { name: 'Birth Certificate - Miguel Santos.pdf', type: 'Birth Certificate', url: '#', uploadedDate: '2026-02-15' }
      ],
      email: 'miguel.santos@email.com',
      contactNumber: '09191234567',
      auditTrail: [
        { action: 'Application Submitted', performedBy: 'Miguel Santos (Student)', performedAt: '2026-02-15 11:00 AM' },
        { action: 'Rejected', performedBy: 'Mrs. Maria Santos (Registrar)', performedAt: '2026-02-16 03:00 PM', comments: 'Incomplete documents - Missing Form 138 and Good Moral Certificate. Please resubmit with complete requirements.' }
      ]
    },
    {
      id: 'ENR004',
      studentName: 'Isabella Cruz',
      firstName: 'Isabella',
      middleName: '',
      lastName: 'Cruz',
      birthdate: '2005-06-20',
      lrn: '123456789027',
      gradeLevel: '11',
      strand: 'HUMSS',
      status: 'Approved',
      applicationDate: '2026-02-22',
      section: 'HUMSS-Mabini',
      documents: ['Birth Certificate', 'Form 138', 'Good Moral'],
      documentFiles: [
        { name: 'Birth Certificate - Isabella Cruz.pdf', type: 'Birth Certificate', url: '#', uploadedDate: '2026-02-22' },
        { name: 'Form 138 - Isabella Cruz.pdf', type: 'Form 138 (Report Card)', url: '#', uploadedDate: '2026-02-22' },
        { name: 'Good Moral Certificate - Isabella Cruz.pdf', type: 'Good Moral Certificate', url: '#', uploadedDate: '2026-02-22' }
      ],
      email: 'isabella.cruz@email.com',
      contactNumber: '09201234567',
      auditTrail: [
        { action: 'Application Submitted', performedBy: 'Isabella Cruz (Student)', performedAt: '2026-02-22 08:45 AM' },
        { action: 'Documents Approved', performedBy: 'Mrs. Maria Santos (Registrar)', performedAt: '2026-02-22 01:00 PM', comments: 'All documents verified. Please proceed to registrar office for payment.' },
        { action: 'Approved', performedBy: 'Mrs. Maria Santos (Registrar)', performedAt: '2026-02-23 09:15 AM', comments: 'Enrollment approved. Assigned to HUMSS-Mabini section.' }
      ]
    },
    {
      id: 'ENR005',
      studentName: 'Rafael Gomez',
      firstName: 'Rafael',
      middleName: '',
      lastName: 'Gomez',
      birthdate: '2005-08-30',
      lrn: '123456789028',
      gradeLevel: '11',
      strand: 'HUMSS',
      status: 'Approved',
      applicationDate: '2026-02-21',
      section: 'HUMSS-Rizal',
      documents: ['Birth Certificate', 'Form 138', 'Good Moral'],
      documentFiles: [
        { name: 'Birth Certificate - Rafael Gomez.pdf', type: 'Birth Certificate', url: '#', uploadedDate: '2026-02-21' },
        { name: 'Form 138 - Rafael Gomez.pdf', type: 'Form 138 (Report Card)', url: '#', uploadedDate: '2026-02-21' },
        { name: 'Good Moral Certificate - Rafael Gomez.pdf', type: 'Good Moral Certificate', url: '#', uploadedDate: '2026-02-21' }
      ],
      email: 'rafael.gomez@email.com',
      contactNumber: '09211234567',
      auditTrail: [
        { action: 'Application Submitted', performedBy: 'Rafael Gomez (Student)', performedAt: '2026-02-21 09:00 AM' },
        { action: 'Documents Approved', performedBy: 'Mrs. Maria Santos (Registrar)', performedAt: '2026-02-21 02:00 PM', comments: 'Documents complete and verified' },
        { action: 'Approved', performedBy: 'Mrs. Maria Santos (Registrar)', performedAt: '2026-02-23 10:00 AM', comments: 'Enrollment approved. Assigned to HUMSS-Rizal section.' }
      ]
    }
  ]);

  const handleAction = (action: 'approve' | 'reject' | 'verify-payment', comment: string) => {
    if (!selectedApp) return;

    const timestamp = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const registrar = 'Mrs. Maria Santos (Registrar)';
    
    let newStatus: EnrollmentStatus = selectedApp.status;
    let newAuditEntry: AuditEntry;

    switch (action) {
      case 'approve':
        if (selectedApp.status === 'Pending Review') {
          newStatus = 'Approved';
          newAuditEntry = {
            action: 'Approved',
            performedBy: registrar,
            performedAt: timestamp,
            comments: comment || `Enrollment approved. Assigned to ${selectedSection} section.`
          };
        }
        break;

      case 'reject':
        newStatus = 'Rejected';
        newAuditEntry = {
          action: 'Rejected',
          performedBy: registrar,
          performedAt: timestamp,
          comments: comment
        };
        break;

      default:
        return;
    }

    setApplications(apps =>
      apps.map(app =>
        app.id === selectedApp.id
          ? {
              ...app,
              status: newStatus,
              section: action === 'approve' ? selectedSection : app.section,
              auditTrail: [...app.auditTrail, newAuditEntry!]
            }
          : app
      )
    );

    const actionMessages = {
      approve: 'Enrollment approved successfully!',
      reject: 'Application rejected'
    };

    if (action === 'reject') {
      toast.error(actionMessages[action]);
    } else {
      toast.success(actionMessages[action]);
    }

    setActionComment('');
    setSelectedSection('');
    setIsActionDialogOpen(false);
    setIsReviewDialogOpen(false);
  };

  const getStatusBadge = (status: EnrollmentStatus) => {
    const badges = {
      'Pending Review': <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>,
      'Approved': <Badge className="bg-[#2D5016] text-white"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>,
      'Rejected': <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>
    };
    return badges[status];
  };

  const getSectionsForStrand = (strand: Strand) => {
    const sectionMapping: Record<Strand, string[]> = {
      HUMSS: ['Mabini', 'Rizal', 'Bonifacio'],
      TVL: ['Burgos', 'Ponce', 'Lopez']
    };
    return sectionMapping[strand] || [];
  };

  const filteredApplications = applications.filter(app => {
    const matchesStrand = !selectedStrand || app.strand === selectedStrand;
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    const matchesSearch = !searchQuery || 
      app.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.lrn.includes(searchQuery) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStrand && matchesStatus && matchesSearch;
  });

  const openActionDialog = (action: 'approve' | 'reject' | 'verify-payment') => {
    setCurrentAction(action);
    setIsActionDialogOpen(true);
  };

  // Generate username: FirstInitial + MiddleInitial + LastName
  const generateUsername = (firstName: string, middleName: string, lastName: string) => {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const middleInitial = middleName ? middleName.charAt(0).toUpperCase() : '';
    return `${firstInitial}${middleInitial}${lastName}`;
  };

  // Generate password from birthdate: DD-MM-YYYY
  const generatePassword = (birthdate: string) => {
    const date = new Date(birthdate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const handleReleaseCredentials = (app: Application) => {
    const username = generateUsername(app.firstName, app.middleName, app.lastName);
    const password = generatePassword(app.birthdate);

    // Update application to mark account as released
    setApplications(apps =>
      apps.map(a =>
        a.id === app.id
          ? { ...a, accountReleased: true }
          : a
      )
    );

    // Simulate sending email
    toast.success(
      <div>
        <p className="font-semibold">Account credentials sent successfully!</p>
        <p className="text-sm mt-1">Email: {app.email}</p>
        <p className="text-sm">Username: {username}</p>
        <p className="text-sm">Password: {password}</p>
      </div>,
      { duration: 6000 }
    );
  };

  // Get enrolled students who have completed face-to-face documents submission
  const enrolledStudents = applications.filter(app => app.status === 'Approved' && app.section);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Enrollment Management</h2>
        <p className="text-gray-600">Review and process enrollment applications</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Applications</CardTitle>
          <CardDescription>Filter by strand, status, or search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strand</label>
                <Select 
                  value={selectedStrand || 'all'} 
                  onValueChange={(val) => setSelectedStrand(val === 'all' ? null : val as Strand)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Strands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strands</SelectItem>
                    {strands.map((strand) => (
                      <SelectItem key={strand.name} value={strand.name}>
                        {strand.name} - {strand.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending Review">Pending Review</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <div className="flex-1 max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by name, LRN, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                  />
                </div>
              </div>
              
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('all');
                    setSelectedStrand(null);
                  }}
                >
                  Reset All
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#8B1538]" />
                Enrollment Applications
              </CardTitle>
              <CardDescription>
                {selectedStrand ? `${selectedStrand} Applications` : 'All Applications'} • SY 2025-2026
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {filteredApplications.length} Applications
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>LRN</TableHead>
                <TableHead>Strand</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.length > 0 ? (
                filteredApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono text-sm">{app.id}</TableCell>
                    <TableCell className="font-medium">{app.studentName}</TableCell>
                    <TableCell className="font-mono text-sm">{app.lrn}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{app.strand}</Badge>
                    </TableCell>
                    <TableCell>Grade {app.gradeLevel}</TableCell>
                    <TableCell>{app.applicationDate}</TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                    <TableCell className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedApp(app);
                          setIsReviewDialogOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No applications found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application Review - {selectedApp?.id}</DialogTitle>
            <DialogDescription>
              Review enrollment application for {selectedApp?.studentName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedApp && (
            <Tabs defaultValue="documents" className="mt-4">
              <TabsList className="grid w-full grid-cols-3 bg-gray-100">
                <TabsTrigger value="info">Student Info</TabsTrigger>
                <TabsTrigger value="documents">Documents ({selectedApp.documentFiles.length})</TabsTrigger>
                <TabsTrigger value="audit">Audit Trail ({selectedApp.auditTrail.length})</TabsTrigger>
              </TabsList>

              {/* Student Information Tab */}
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Student Name</Label>
                    <p className="text-sm font-semibold mt-1 break-words">{selectedApp.studentName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">LRN</Label>
                    <p className="text-sm font-mono mt-1 break-words">{selectedApp.lrn}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Strand</Label>
                    <p className="text-sm mt-1 break-words">{selectedApp.strand}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Grade Level</Label>
                    <p className="text-sm mt-1 break-words">Grade {selectedApp.gradeLevel}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Email</Label>
                    <p className="text-sm mt-1 break-all">{selectedApp.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Contact Number</Label>
                    <p className="text-sm mt-1 break-words">{selectedApp.contactNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Application Date</Label>
                    <p className="text-sm mt-1 break-words">{selectedApp.applicationDate}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Current Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
                  </div>
                </div>

                {selectedApp.section && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Assigned Section</Label>
                    <p className="text-sm font-bold text-[#2D5016] mt-1 break-words">{selectedApp.section}</p>
                  </div>
                )}
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-3 mt-4">
                {/* Document Count Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-900" />
                  <p className="text-sm text-blue-900">
                    Total Documents Submitted: <strong>{selectedApp.documentFiles.length}</strong>
                  </p>
                </div>

                {/* Document Cards */}
                <div className="space-y-3">
                  {selectedApp.documentFiles.map((doc, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      {/* Document Header */}
                      <div className="bg-gray-50 border-b border-gray-200 p-3 flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {/* Icon */}
                          <div className="bg-red-50 rounded-lg p-1.5 flex-shrink-0">
                            <FileText className="w-4 h-4 text-[#8B1538]" />
                          </div>
                          
                          {/* Document Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs text-gray-900 truncate">{doc.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Uploaded: {doc.uploadedDate}</p>
                            <div className="mt-1">
                              <Badge variant="outline" className="text-xs py-0 h-5">{doc.type}</Badge>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                            <Eye className="w-3 h-3 mr-1" />
                            Open
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2">
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>

                      {/* PDF Preview Area */}
                      <div className="bg-gray-50 p-4">
                        <div className="bg-white border border-gray-300 rounded-lg shadow-md max-w-md mx-auto p-4">
                          {/* Preview Icon */}
                          <div className="flex justify-center mb-2">
                            <FileText className="w-10 h-10 text-gray-300" />
                          </div>
                          
                          {/* Preview Text */}
                          <h3 className="text-sm font-bold text-gray-900 text-center mb-1">{doc.type}</h3>
                          <p className="text-xs text-gray-600 text-center mb-3 truncate">{doc.name}</p>
                          
                          <div className="text-center space-y-0.5 text-xs text-gray-400 mb-3">
                            <p>📄 PDF Document Preview</p>
                            <p className="text-xs">Actual content would display here</p>
                          </div>
                          
                          {/* Document Information */}
                          <div className="border-t border-gray-200 pt-3 space-y-1.5 text-xs">
                            <p className="text-gray-600 mb-1 font-medium">Document Information:</p>
                            <p className="text-gray-900"><span className="font-bold">Type:</span> {doc.type}</p>
                            <p className="text-gray-900 truncate"><span className="font-bold">File Name:</span> {doc.name}</p>
                            <p className="text-gray-900"><span className="font-bold">Upload Date:</span> {doc.uploadedDate}</p>
                            <p className="text-gray-900">
                              <span className="font-bold">Status:</span> <span className="text-green-600">Verified</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Audit Trail Tab */}
              <TabsContent value="audit" className="space-y-3 mt-4">
                <div className="space-y-2.5">
                  {selectedApp.auditTrail.map((entry, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <History className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 break-words">{entry.action}</p>
                          <p className="text-xs text-gray-600 mt-0.5 break-words">
                            by {entry.performedBy} • {entry.performedAt}
                          </p>
                          {entry.comments && (
                            <div className="mt-2 bg-white border border-gray-200 rounded p-2">
                              <p className="text-xs text-gray-500 mb-0.5">
                                <MessageSquare className="w-3 h-3 inline mr-1" />
                                Comment:
                              </p>
                              <p className="text-xs text-gray-900 break-words">{entry.comments}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {selectedApp && (
            <DialogFooter className="gap-2 mt-4 flex-col sm:flex-row">
              {selectedApp.status === 'Pending Review' && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => openActionDialog('reject')}
                    className="w-full sm:w-auto"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <div className="flex-1 w-full sm:w-auto min-w-[200px]">
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Section" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSectionsForStrand(selectedApp.strand).map((section) => (
                          <SelectItem key={section} value={`${selectedApp.strand}-${section}`}>
                            {selectedApp.strand} - {section}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => openActionDialog('approve')}
                    disabled={!selectedSection}
                    className="bg-[#2D5016] hover:bg-[#1f3810] w-full sm:w-auto"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Final Approval
                  </Button>
                </>
              )}

              {selectedApp.status === 'Approved' && (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => openActionDialog('reject')}
                    className="w-full sm:w-auto"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Comment Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {currentAction === 'approve' && 'Approve Application'}
              {currentAction === 'reject' && 'Reject Application'}
            </DialogTitle>
            <DialogDescription>
              {currentAction === 'reject' 
                ? 'Provide a detailed reason for rejection. This will be visible to the student.'
                : 'Add comments about this action (required for audit trail).'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Comments <span className="text-red-600">*</span>
              </Label>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538] resize-none"
                placeholder={
                  currentAction === 'reject' 
                    ? 'Enter detailed reason for rejection...'
                    : 'Enter comments about this approval...'
                }
              />
              <p className="text-xs text-gray-500 mt-2">
                This comment will be recorded in the audit trail and shown to the student.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                setActionComment('');
                setIsActionDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!actionComment.trim()) {
                  toast.error('Please provide comments');
                  return;
                }
                handleAction(currentAction!, actionComment);
              }}
              className={
                currentAction === 'reject' 
                  ? 'bg-[#8B1538] hover:bg-[#6c102c]'
                  : 'bg-[#2D5016] hover:bg-[#1f3810]'
              }
            >
              {currentAction === 'approve' && <CheckCircle className="w-4 h-4 mr-2" />}
              {currentAction === 'reject' && <XCircle className="w-4 h-4 mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrolled Students - Account Management */}
      <Card className="border-2 border-[#2D5016]">
        <CardHeader className="bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[#2D5016]">
                <Users className="w-5 h-5" />
                Enrolled Students - Account Management
              </CardTitle>
              <CardDescription className="mt-1">
                Students who have successfully submitted documents face-to-face
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              {enrolledStudents.length} Enrolled
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {enrolledStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>LRN</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrolledStudents.map((student) => {
                  const username = generateUsername(student.firstName, student.middleName, student.lastName);
                  const password = generatePassword(student.birthdate);
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono text-sm">{student.id}</TableCell>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell className="font-mono text-sm">{student.lrn}</TableCell>
                      <TableCell>
                        <Badge className="bg-[#2D5016] text-white">{student.section}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{student.email}</TableCell>
                      <TableCell>
                        {student.accountReleased ? (
                          <Badge className="bg-green-600 text-white">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Released
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {student.accountReleased ? (
                          <div className="flex flex-col gap-1 text-xs text-gray-600">
                            <div className="flex items-center gap-1 justify-center">
                              <KeyRound className="w-3 h-3" />
                              <span className="font-mono">{username}</span>
                            </div>
                            <div className="flex items-center gap-1 justify-center">
                              <Mail className="w-3 h-3" />
                              <span>Sent</span>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleReleaseCredentials(student)}
                            className="bg-[#2D5016] hover:bg-[#1f3810]"
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            Release Credentials
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">No enrolled students yet</p>
              <p className="text-sm text-gray-500 mt-1">Approved students will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}