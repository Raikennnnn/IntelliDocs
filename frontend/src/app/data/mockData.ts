// Mock data for the Student Information System

export const mockUsers = {
  student: {
    id: 'STU001',
    username: 'student',
    password: 'student123',
    role: 'student',
    name: 'Juan Dela Cruz',
    email: 'juan.delacruz@school.edu.ph',
    lrn: '123456789012',
    strand: 'HUMSS',
    section: 'HUMSS 11-A',
    schoolYear: '2025-2026',
    enrollmentStatus: 'Enrolled',
    photo: 'https://images.unsplash.com/photo-1647934786533-f3c15896410b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1hbGUlMjBzdHVkZW50JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzcxNzcxMjE5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  },
  registrar: {
    id: 'REG001',
    username: 'registrar',
    password: 'registrar123',
    role: 'registrar',
    name: 'Rosa Garcia',
    email: 'rosa.garcia@school.edu.ph',
    employeeId: 'EMP002',
    photo: 'https://images.unsplash.com/photo-1609126385558-bc3fc5082b0a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaWxpcGluYSUyMGZlbWFsZSUyMHJlZ2lzdHJhciUyMG9mZmljZXxlbnwxfHx8fDE3NzE3NzI0NzB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  },
  admin: {
    id: 'ADM001',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Pedro Reyes',
    email: 'pedro.reyes@school.edu.ph',
    employeeId: 'EMP003',
    photo: 'https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1hbGUlMjBhZG1pbmlzdHJhdG9yJTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc3MTc3MjQ3MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
  }
};

export const mockAnnouncements = [
  {
    id: 'ANN001',
    title: 'Midterm Examinations Schedule',
    content: 'Midterm exams will be held from March 3-7, 2026. Please check your class schedules for specific exam times and rooms.',
    date: '2026-02-20',
    author: 'Registrar Office',
    target: 'Students',
    category: 'Exam Announcements',
    priority: 'high'
  },
  {
    id: 'ANN002',
    title: 'Final Exam Period',
    content: 'Final examinations will be conducted from March 24-28, 2026. Review schedules have been posted on bulletin boards.',
    date: '2026-02-21',
    author: 'Academic Office',
    target: 'Students',
    category: 'Exam Announcements',
    priority: 'high'
  },
  {
    id: 'ANN003',
    title: 'Walang Pasok - February 25',
    content: 'No classes on February 25, 2026 in observance of EDSA People Power Revolution Anniversary.',
    date: '2026-02-18',
    author: 'Principal Office',
    target: 'Whole School',
    category: 'Walang Pasok',
    priority: 'high'
  },
  {
    id: 'ANN004',
    title: 'Suspension of Classes - Weather Advisory',
    content: 'Classes suspended today, February 23, 2026 due to heavy rainfall. Stay safe everyone!',
    date: '2026-02-23',
    author: 'Principal Office',
    target: 'Whole School',
    category: 'Walang Pasok',
    priority: 'high'
  },
  {
    id: 'ANN005',
    title: 'Sports Festival 2026',
    content: 'Annual Sports Festival will be held on March 15-17, 2026 at the school grounds. All students are encouraged to participate.',
    date: '2026-02-18',
    author: 'Student Affairs',
    target: 'Whole School',
    category: 'School Events',
    priority: 'medium'
  },
  {
    id: 'ANN006',
    title: 'Science Fair Registration',
    content: 'Registration for the Annual Science Fair is now open until March 1, 2026. Submit your project proposals to your science teachers.',
    date: '2026-02-19',
    author: 'Science Department',
    target: 'Students',
    category: 'School Events',
    priority: 'medium'
  },
  {
    id: 'ANN007',
    title: 'Grade Submission Deadline',
    content: 'All teachers must submit final grades by February 28, 2026.',
    date: '2026-02-15',
    author: 'Principal Office',
    target: 'Teachers',
    category: 'Exam Announcements',
    priority: 'high'
  }
];

export const mockGrades = [
  // ===== GRADE 11 HUMSS - SCHOOL YEAR 2025-2026 - 1ST SEMESTER =====
  {
    id: 'GRD001',
    studentId: 'STU001',
    subject: 'Oral Communication',
    teacher: 'John Cruz',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 88,
    q2: 90,
    q3: 0,
    q4: 0,
    final: 89,
    status: 'Passed'
  },
  {
    id: 'GRD002',
    studentId: 'STU001',
    subject: 'Komunikasyon at Pananaliksik',
    teacher: 'Roberto Villegas',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 86,
    q2: 87,
    q3: 0,
    q4: 0,
    final: 86.5,
    status: 'Passed'
  },
  {
    id: 'GRD003',
    studentId: 'STU001',
    subject: 'General Mathematics',
    teacher: 'Maria Santos',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 88,
    q2: 90,
    q3: 0,
    q4: 0,
    final: 89,
    status: 'Passed'
  },
  {
    id: 'GRD004',
    studentId: 'STU001',
    subject: 'Earth and Life Science',
    teacher: 'Carlos Mendoza',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 85,
    q2: 88,
    q3: 0,
    q4: 0,
    final: 86.5,
    status: 'Passed'
  },
  {
    id: 'GRD005',
    studentId: 'STU001',
    subject: 'Understanding Culture, Society and Politics',
    teacher: 'Patricia De Leon',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 90,
    q2: 89,
    q3: 0,
    q4: 0,
    final: 89.5,
    status: 'Passed'
  },
  {
    id: 'GRD006',
    studentId: 'STU001',
    subject: 'Physical Education and Health 11',
    teacher: 'Mark Gonzales',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 92,
    q2: 93,
    q3: 0,
    q4: 0,
    final: 92.5,
    status: 'Passed'
  },
  {
    id: 'GRD007',
    studentId: 'STU001',
    subject: 'Introduction to World Religions and Belief Systems',
    teacher: 'Fr. Antonio Reyes',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 90,
    q2: 91,
    q3: 0,
    q4: 0,
    final: 90.5,
    status: 'Passed'
  },
  {
    id: 'GRD008',
    studentId: 'STU001',
    subject: 'Introduction to the Philosophy of the Human Person',
    teacher: 'Dr. Sofia Martinez',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 87,
    q2: 89,
    q3: 0,
    q4: 0,
    final: 88,
    status: 'Passed'
  },
  {
    id: 'GRD009',
    studentId: 'STU001',
    subject: 'Creative Writing',
    teacher: 'Ms. Carmen Flores',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 91,
    q2: 92,
    q3: 0,
    q4: 0,
    final: 91.5,
    status: 'Passed'
  },
  {
    id: 'GRD010',
    studentId: 'STU001',
    subject: 'Contemporary Philippine Arts from the Regions',
    teacher: 'Mr. Rafael Cruz',
    schoolYear: '2025-2026',
    semester: '1st Semester',
    gradeLevel: 11,
    q1: 89,
    q2: 90,
    q3: 0,
    q4: 0,
    final: 89.5,
    status: 'Passed'
  },

  // ===== GRADE 11 HUMSS - SCHOOL YEAR 2025-2026 - 2ND SEMESTER (In Progress) =====
  {
    id: 'GRD011',
    studentId: 'STU001',
    subject: 'Oral Communication',
    teacher: 'John Cruz',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 87,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD012',
    studentId: 'STU001',
    subject: 'Komunikasyon at Pananaliksik',
    teacher: 'Roberto Villegas',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 85,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD013',
    studentId: 'STU001',
    subject: 'General Mathematics',
    teacher: 'Maria Santos',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 90,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD014',
    studentId: 'STU001',
    subject: 'Earth and Life Science',
    teacher: 'Carlos Mendoza',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 87,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD015',
    studentId: 'STU001',
    subject: 'Understanding Culture, Society and Politics',
    teacher: 'Patricia De Leon',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 88,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD016',
    studentId: 'STU001',
    subject: 'Physical Education and Health 11',
    teacher: 'Mark Gonzales',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 93,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD017',
    studentId: 'STU001',
    subject: 'Introduction to World Religions and Belief Systems',
    teacher: 'Fr. Antonio Reyes',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 91,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD018',
    studentId: 'STU001',
    subject: 'Introduction to the Philosophy of the Human Person',
    teacher: 'Dr. Sofia Martinez',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 88,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD019',
    studentId: 'STU001',
    subject: 'Creative Writing',
    teacher: 'Ms. Carmen Flores',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 92,
    q4: 0,
    final: 0,
    status: 'In Progress'
  },
  {
    id: 'GRD020',
    studentId: 'STU001',
    subject: 'Contemporary Philippine Arts from the Regions',
    teacher: 'Mr. Rafael Cruz',
    schoolYear: '2025-2026',
    semester: '2nd Semester',
    gradeLevel: 11,
    q1: 0,
    q2: 0,
    q3: 90,
    q4: 0,
    final: 0,
    status: 'In Progress'
  }
];

export const mockAttendance = {
  studentId: 'STU001',
  totalDays: 120,
  present: 115,
  absent: 5,
  late: 3,
  attendanceRate: 95.8,
  bySubject: [
    { subject: 'General Mathematics', present: 38, absent: 2, total: 40 },
    { subject: 'Oral Communication', present: 39, absent: 1, total: 40 },
    { subject: 'Physical Education and Health 11', present: 40, absent: 0, total: 40 },
    { subject: 'Introduction to World Religions and Belief Systems', present: 37, absent: 3, total: 40 },
    { subject: 'Creative Writing', present: 39, absent: 1, total: 40 }
  ],
  // Daily attendance records (last 30 days)
  dailyRecords: [
    { date: '2026-03-03', status: 'present', remarks: '' },
    { date: '2026-03-02', status: 'present', remarks: '' },
    { date: '2026-02-28', status: 'present', remarks: '' },
    { date: '2026-02-27', status: 'late', remarks: 'Arrived 15 minutes late' },
    { date: '2026-02-26', status: 'present', remarks: '' },
    { date: '2026-02-25', status: 'present', remarks: '' },
    { date: '2026-02-24', status: 'present', remarks: '' },
    { date: '2026-02-21', status: 'absent', remarks: 'Sick leave' },
    { date: '2026-02-20', status: 'present', remarks: '' },
    { date: '2026-02-19', status: 'present', remarks: '' },
    { date: '2026-02-18', status: 'present', remarks: '' },
    { date: '2026-02-17', status: 'late', remarks: 'Traffic delay' },
    { date: '2026-02-14', status: 'present', remarks: '' },
    { date: '2026-02-13', status: 'present', remarks: '' },
    { date: '2026-02-12', status: 'present', remarks: '' },
    { date: '2026-02-11', status: 'present', remarks: '' },
    { date: '2026-02-10', status: 'absent', remarks: 'Medical appointment' },
    { date: '2026-02-07', status: 'present', remarks: '' },
    { date: '2026-02-06', status: 'present', remarks: '' },
    { date: '2026-02-05', status: 'present', remarks: '' },
    { date: '2026-02-04', status: 'present', remarks: '' },
    { date: '2026-02-03', status: 'late', remarks: 'Woke up late' },
    { date: '2026-01-31', status: 'present', remarks: '' },
    { date: '2026-01-30', status: 'present', remarks: '' },
    { date: '2026-01-29', status: 'present', remarks: '' },
    { date: '2026-01-28', status: 'absent', remarks: 'Family emergency' },
    { date: '2026-01-27', status: 'present', remarks: '' },
    { date: '2026-01-24', status: 'present', remarks: '' },
    { date: '2026-01-23', status: 'present', remarks: '' },
    { date: '2026-01-22', status: 'present', remarks: '' }
  ],
  // Monthly summary for current school year
  monthlySummary: [
    { month: 'August 2025', present: 18, absent: 1, late: 0, total: 19 },
    { month: 'September 2025', present: 21, absent: 0, late: 1, total: 22 },
    { month: 'October 2025', present: 20, absent: 1, late: 0, total: 21 },
    { month: 'November 2025', present: 19, absent: 0, late: 0, total: 19 },
    { month: 'December 2025', present: 14, absent: 1, late: 0, total: 15 },
    { month: 'January 2026', present: 17, absent: 1, late: 1, total: 19 },
    { month: 'February 2026', present: 6, absent: 1, late: 1, total: 8 }
  ]
};

export const mockDocumentRequests = [
  {
    id: 'DOC001',
    studentId: 'STU001',
    documentType: 'Form 137',
    purpose: 'College Application',
    requestDate: '2026-02-15',
    status: 'Processing',
    approvedBy: null,
    releaseDate: null
  },
  {
    id: 'DOC002',
    studentId: 'STU001',
    documentType: 'Report Card',
    purpose: 'Scholarship Application',
    requestDate: '2026-02-10',
    status: 'Ready',
    approvedBy: 'REG001',
    releaseDate: null
  },
  {
    id: 'DOC003',
    studentId: 'STU001',
    documentType: 'Certification',
    purpose: 'Good Moral Certificate',
    requestDate: '2026-01-28',
    status: 'Released',
    approvedBy: 'REG001',
    releaseDate: '2026-02-05'
  }
];

export const mockEnrollmentApplications = [
  {
    id: 'ENR001',
    studentName: 'Carlos Rodriguez',
    lrn: '123456789013',
    gradeLevel: '11',
    strand: 'ABM',
    status: 'Pending',
    applicationDate: '2026-02-20',
    documents: ['Birth Certificate', 'Form 138', 'Good Moral']
  },
  {
    id: 'ENR002',
    studentName: 'Anna Marie Torres',
    lrn: '123456789014',
    gradeLevel: '12',
    strand: 'HUMSS',
    status: 'Approved',
    applicationDate: '2026-02-18',
    section: 'HUMSS 12-A',
    documents: ['Birth Certificate', 'Form 138', 'Good Moral', 'Report Card']
  },
  {
    id: 'ENR003',
    studentName: 'Miguel Santos',
    lrn: '123456789015',
    gradeLevel: '11',
    strand: 'TVL',
    status: 'Rejected',
    applicationDate: '2026-02-15',
    reason: 'Incomplete documents',
    documents: ['Birth Certificate']
  }
];

export const mockSections = [
  {
    id: 'SEC001',
    name: 'STEM 12-A',
    adviser: 'Maria Santos',
    room: 'Room 301',
    studentCount: 42,
    strand: 'STEM',
    gradeLevel: '12'
  },
  {
    id: 'SEC002',
    name: 'HUMSS 11-B',
    adviser: 'John Cruz',
    room: 'Room 205',
    studentCount: 38,
    strand: 'HUMSS',
    gradeLevel: '11'
  },
  {
    id: 'SEC003',
    name: 'ABM 11-A',
    adviser: 'Lisa Ramos',
    room: 'Room 102',
    studentCount: 40,
    strand: 'ABM',
    gradeLevel: '11'
  },
  {
    id: 'SEC004',
    name: 'TVL 12-A',
    adviser: 'Carlos Mendoza',
    room: 'Room 104',
    studentCount: 35,
    strand: 'TVL',
    gradeLevel: '12'
  }
];

export const mockStudents = [
  {
    id: 'STU001',
    lrn: '123456789012',
    name: 'Juan Dela Cruz',
    strand: 'STEM',
    section: 'STEM 12-A',
    gradeLevel: '12',
    email: 'juan.delacruz@school.edu.ph',
    contactNumber: '09123456789',
    parentGuardian: 'Pedro Dela Cruz',
    parentContact: '09187654321',
    enrollmentStatus: 'Enrolled'
  },
  {
    id: 'STU002',
    lrn: '123456789016',
    name: 'Maria Clara',
    strand: 'STEM',
    section: 'STEM 12-A',
    gradeLevel: '12',
    email: 'maria.clara@school.edu.ph',
    contactNumber: '09123456780',
    parentGuardian: 'Jose Clara',
    parentContact: '09187654322',
    enrollmentStatus: 'Enrolled'
  }
];

export const mockSecurityLogs = [
  {
    id: 'LOG001',
    user: 'STU001',
    action: 'Login',
    timestamp: '2026-02-22 08:15:23',
    ipAddress: '192.168.1.105',
    status: 'Success'
  },
  {
    id: 'LOG002',
    user: 'TCH001',
    action: 'Grade Submission',
    timestamp: '2026-02-22 09:30:45',
    ipAddress: '192.168.1.110',
    status: 'Success'
  },
  {
    id: 'LOG003',
    user: 'Unknown',
    action: 'Failed Login',
    timestamp: '2026-02-22 10:15:12',
    ipAddress: '203.123.45.67',
    status: 'Failed',
    attempts: 3
  },
  {
    id: 'LOG004',
    user: 'REG001',
    action: 'Student Record Access',
    timestamp: '2026-02-22 11:20:33',
    ipAddress: '192.168.1.115',
    status: 'Success',
    target: 'STU001'
  }
];

export const mockSecurityAlerts = [
  {
    id: 'ALR001',
    type: 'Multiple Failed Login Attempts',
    severity: 'High',
    timestamp: '2026-02-22 10:15:12',
    description: 'IP 203.123.45.67 attempted login 5 times',
    status: 'Open'
  },
  {
    id: 'ALR002',
    type: 'Unauthorized Access Attempt',
    severity: 'Medium',
    timestamp: '2026-02-22 08:45:22',
    description: 'Student account tried to access registrar module',
    status: 'Resolved'
  },
  {
    id: 'ALR003',
    type: 'Grade Modification',
    severity: 'High',
    timestamp: '2026-02-21 15:30:11',
    description: 'Grade modified after submission deadline',
    status: 'Under Investigation'
  }
];

export const mockIncidents = [
  {
    id: 'INC001',
    alertId: 'ALR001',
    title: 'Multiple Failed Login Attempts',
    classification: 'High',
    assignedTo: 'ADM001',
    status: 'In Progress',
    notes: 'IP has been temporarily blocked. Investigating source.',
    createdAt: '2026-02-22 10:20:00',
    updatedAt: '2026-02-22 11:30:00'
  },
  {
    id: 'INC002',
    alertId: 'ALR003',
    title: 'Unauthorized Grade Modification',
    classification: 'High',
    assignedTo: 'ADM001',
    status: 'Open',
    notes: 'Reviewing audit logs to identify who modified the grade.',
    createdAt: '2026-02-21 16:00:00',
    updatedAt: '2026-02-21 16:00:00'
  }
];

export const mockClassList = [
  {
    id: 'STU001',
    name: 'Juan Dela Cruz',
    lrn: '123456789012',
    section: 'STEM 12-A',
    email: 'juan.delacruz@school.edu.ph'
  },
  {
    id: 'STU002',
    name: 'Maria Clara',
    lrn: '123456789016',
    section: 'STEM 12-A',
    email: 'maria.clara@school.edu.ph'
  },
  {
    id: 'STU003',
    name: 'Jose Rizal Jr.',
    lrn: '123456789017',
    section: 'STEM 12-A',
    email: 'jose.rizal@school.edu.ph'
  }
];

export const mockTeacherGrades = [
  {
    studentId: 'STU001',
    studentName: 'Juan Dela Cruz',
    subject: 'General Mathematics',
    section: 'STEM 12-A',
    q1: 88,
    q2: 90,
    q3: 87,
    q4: null,
    status: 'In Progress'
  },
  {
    studentId: 'STU002',
    studentName: 'Maria Clara',
    subject: 'General Mathematics',
    section: 'STEM 12-A',
    q1: 92,
    q2: 91,
    q3: 93,
    q4: null,
    status: 'In Progress'
  },
  {
    studentId: 'STU003',
    studentName: 'Jose Rizal Jr.',
    subject: 'General Mathematics',
    section: 'STEM 12-A',
    q1: 85,
    q2: 87,
    q3: 86,
    q4: null,
    status: 'In Progress'
  }
];

export const mockAcademicPerformance = {
  totalStudents: 73,
  passingRate: 93.2,
  averageGrade: 86.4,
  byStrand: [
    { strand: 'HUMSS', students: 38, passingRate: 93.4, averageGrade: 86.8 },
    { strand: 'TVL', students: 35, passingRate: 92.9, averageGrade: 85.9 }
  ]
};

// Curriculum Data by Strand
export const mockCurriculum = {
  STEM: {
    'Grade 11': [
      { code: 'ENG11', subject: 'Oral Communication', type: 'Core' },
      { code: 'FIL11', subject: 'Komunikasyon at Pananaliksik', type: 'Core' },
      { code: 'MATH11', subject: 'General Mathematics', type: 'Core' },
      { code: 'SCI11', subject: 'Earth and Life Science', type: 'Core' },
      { code: 'SOC11', subject: 'Understanding Culture, Society and Politics', type: 'Core' },
      { code: 'PE11', subject: 'Physical Education and Health 11', type: 'Core' },
      { code: 'STEM-CHEM', subject: 'General Chemistry 1', type: 'Specialized' },
      { code: 'STEM-BIO', subject: 'General Biology 1', type: 'Specialized' },
    ],
    'Grade 12': [
      { code: 'ENG12', subject: 'Reading and Writing', type: 'Core' },
      { code: 'FIL12', subject: 'Pagbasa at Pagsusuri', type: 'Core' },
      { code: 'MATH12', subject: 'Statistics and Probability', type: 'Core' },
      { code: 'SCI12', subject: 'Physical Science', type: 'Core' },
      { code: 'PE12', subject: 'Physical Education and Health 12', type: 'Core' },
      { code: 'STEM-CALC', subject: 'Basic Calculus', type: 'Specialized' },
      { code: 'STEM-PHY', subject: 'General Physics 1', type: 'Specialized' },
    ]
  },
  HUMSS: {
    'Grade 11': [
      { code: 'ENG11', subject: 'Oral Communication', type: 'Core' },
      { code: 'FIL11', subject: 'Komunikasyon at Pananaliksik', type: 'Core' },
      { code: 'MATH11', subject: 'General Mathematics', type: 'Core' },
      { code: 'SCI11', subject: 'Earth and Life Science', type: 'Core' },
      { code: 'SOC11', subject: 'Understanding Culture, Society and Politics', type: 'Core' },
      { code: 'PE11', subject: 'Physical Education and Health 11', type: 'Core' },
      { code: 'HUMSS-WR', subject: 'Introduction to World Religions and Belief Systems', type: 'Specialized' },
      { code: 'HUMSS-PHIL', subject: 'Introduction to the Philosophy of the Human Person', type: 'Specialized' },
      { code: 'HUMSS-CW', subject: 'Creative Writing', type: 'Specialized' },
      { code: 'HUMSS-CPAR', subject: 'Contemporary Philippine Arts from the Regions', type: 'Specialized' },
    ],
    'Grade 12': [
      { code: 'ENG12', subject: 'Reading and Writing', type: 'Core' },
      { code: 'FIL12', subject: 'Pagbasa at Pagsusuri', type: 'Core' },
      { code: 'MATH12', subject: 'Statistics and Probability', type: 'Core' },
      { code: 'SCI12', subject: 'Physical Science', type: 'Core' },
      { code: 'PE12', subject: 'Physical Education and Health 12', type: 'Core' },
      { code: 'HUMSS-DISS', subject: 'Disciplines and Ideas in the Social Sciences', type: 'Specialized' },
      { code: 'HUMSS-DIASS', subject: 'Disciplines and Ideas in the Applied Social Sciences', type: 'Specialized' },
      { code: 'HUMSS-CW2', subject: 'Creative Nonfiction', type: 'Specialized' },
      { code: 'HUMSS-TREND', subject: 'Trends, Networks and Critical Thinking in the 21st Century', type: 'Specialized' },
    ]
  },
  ABM: {
    'Grade 11': [
      { code: 'ENG11', subject: 'Oral Communication', type: 'Core' },
      { code: 'FIL11', subject: 'Komunikasyon at Pananaliksik', type: 'Core' },
      { code: 'MATH11', subject: 'General Mathematics', type: 'Core' },
      { code: 'SCI11', subject: 'Earth and Life Science', type: 'Core' },
      { code: 'SOC11', subject: 'Understanding Culture, Society and Politics', type: 'Core' },
      { code: 'PE11', subject: 'Physical Education and Health 11', type: 'Core' },
      { code: 'ABM-ACC', subject: 'Fundamentals of Accountancy', type: 'Specialized' },
      { code: 'ABM-BUS', subject: 'Business Management', type: 'Specialized' },
    ],
    'Grade 12': [
      { code: 'ENG12', subject: 'Reading and Writing', type: 'Core' },
      { code: 'FIL12', subject: 'Pagbasa at Pagsusuri', type: 'Core' },
      { code: 'MATH12', subject: 'Statistics and Probability', type: 'Core' },
      { code: 'SCI12', subject: 'Physical Science', type: 'Core' },
      { code: 'PE12', subject: 'Physical Education and Health 12', type: 'Core' },
      { code: 'ABM-BUS2', subject: 'Business Ethics and Social Responsibility', type: 'Specialized' },
      { code: 'ABM-ENT', subject: 'Entrepreneurship', type: 'Specialized' },
    ]
  },
  TVL: {
    'Grade 11': [
      { code: 'ENG11', subject: 'Oral Communication', type: 'Core' },
      { code: 'FIL11', subject: 'Komunikasyon at Pananaliksik', type: 'Core' },
      { code: 'MATH11', subject: 'General Mathematics', type: 'Core' },
      { code: 'SCI11', subject: 'Earth and Life Science', type: 'Core' },
      { code: 'SOC11', subject: 'Understanding Culture, Society and Politics', type: 'Core' },
      { code: 'PE11', subject: 'Physical Education and Health 11', type: 'Core' },
      { code: 'TVL-ICT', subject: 'Computer Systems Servicing', type: 'Specialized' },
      { code: 'TVL-PROG', subject: 'Programming (Java)', type: 'Specialized' },
    ],
    'Grade 12': [
      { code: 'ENG12', subject: 'Reading and Writing', type: 'Core' },
      { code: 'FIL12', subject: 'Pagbasa at Pagsusuri', type: 'Core' },
      { code: 'MATH12', subject: 'Statistics and Probability', type: 'Core' },
      { code: 'SCI12', subject: 'Physical Science', type: 'Core' },
      { code: 'PE12', subject: 'Physical Education and Health 12', type: 'Core' },
      { code: 'TVL-WEB', subject: 'Web Development', type: 'Specialized' },
      { code: 'TVL-NET', subject: 'Computer Networking', type: 'Specialized' },
    ]
  }
};

// Strands with sections - HUMSS and TVL only
export const mockStrands = [
  {
    name: 'HUMSS',
    fullName: 'Humanities and Social Sciences',
    sections: ['Del Pilar', 'Luna']
  },
  {
    name: 'TVL',
    fullName: 'Technical-Vocational-Livelihood',
    sections: ['Ponce', 'Burgos']
  }
];

// Students per strand/section for attendance
export const mockStudentsBySection = {
  // STEM Sections
  'STEM-Sampaguita': [
    { id: 'STU001', name: 'Juan Dela Cruz', lrn: '123456789012', gender: 'M' },
    { id: 'STU002', name: 'Maria Clara', lrn: '123456789016', gender: 'F' },
    { id: 'STU003', name: 'Jose Rizal Jr.', lrn: '123456789017', gender: 'M' },
    { id: 'STU004', name: 'Ana Santos', lrn: '123456789018', gender: 'F' },
    { id: 'STU005', name: 'Carlos Reyes', lrn: '123456789019', gender: 'M' },
    { id: 'STU006', name: 'Isabella Garcia', lrn: '123456789020', gender: 'F' },
    { id: 'STU007', name: 'Miguel Torres', lrn: '123456789021', gender: 'M' },
    { id: 'STU008', name: 'Sofia Lopez', lrn: '123456789022', gender: 'F' },
    { id: 'STU009', name: 'Rafael Domingo', lrn: '123456789023', gender: 'M' },
    { id: 'STU010', name: 'Gabriela Cruz', lrn: '123456789024', gender: 'F' },
    { id: 'STU011', name: 'Diego Mendoza', lrn: '123456789025', gender: 'M' },
    { id: 'STU012', name: 'Katrina Ramos', lrn: '123456789026', gender: 'F' },
  ],
  'STEM-Santan': [
    { id: 'STU013', name: 'Marco Villanueva', lrn: '123456789027', gender: 'M' },
    { id: 'STU014', name: 'Andrea Fernandez', lrn: '123456789028', gender: 'F' },
    { id: 'STU015', name: 'Luis Rodriguez', lrn: '123456789029', gender: 'M' },
    { id: 'STU016', name: 'Camille Santiago', lrn: '123456789030', gender: 'F' },
    { id: 'STU017', name: 'Roberto Aquino', lrn: '123456789031', gender: 'M' },
    { id: 'STU018', name: 'Patricia Bautista', lrn: '123456789032', gender: 'F' },
  ],
  'STEM-Gumamela': [
    { id: 'STU019', name: 'Emmanuel Castro', lrn: '123456789033', gender: 'M' },
    { id: 'STU020', name: 'Jasmine Flores', lrn: '123456789034', gender: 'F' },
    { id: 'STU021', name: 'Vincent Morales', lrn: '123456789035', gender: 'M' },
    { id: 'STU022', name: 'Nicole Torres', lrn: '123456789036', gender: 'F' },
    { id: 'STU023', name: 'Adrian Navarro', lrn: '123456789037', gender: 'M' },
    { id: 'STU024', name: 'Bianca Reyes', lrn: '123456789038', gender: 'F' },
  ],
  'STEM-Rosal': [
    { id: 'STU119', name: 'Jayson Cruz', lrn: '123456789133', gender: 'M' },
    { id: 'STU120', name: 'Kristine Santos', lrn: '123456789134', gender: 'F' },
    { id: 'STU121', name: 'Brandon Reyes', lrn: '123456789135', gender: 'M' },
    { id: 'STU122', name: 'Sophia Garcia', lrn: '123456789136', gender: 'F' },
    { id: 'STU123', name: 'Matthew Torres', lrn: '123456789137', gender: 'M' },
    { id: 'STU124', name: 'Amanda Lopez', lrn: '123456789138', gender: 'F' },
  ],

  // HUMSS Sections
  'HUMSS-Mabini': [
    { id: 'STU025', name: 'Gabriel Martinez', lrn: '123456789039', gender: 'M' },
    { id: 'STU026', name: 'Lucia Gutierrez', lrn: '123456789040', gender: 'F' },
    { id: 'STU027', name: 'Christian Perez', lrn: '123456789041', gender: 'M' },
    { id: 'STU028', name: 'Samantha Diaz', lrn: '123456789042', gender: 'F' },
    { id: 'STU029', name: 'Paolo Ramirez', lrn: '123456789043', gender: 'M' },
    { id: 'STU030', name: 'Michelle Gonzales', lrn: '123456789044', gender: 'F' },
    { id: 'STU031', name: 'Joshua Hernandez', lrn: '123456789045', gender: 'M' },
    { id: 'STU032', name: 'Angela Ruiz', lrn: '123456789046', gender: 'F' },
  ],
  'HUMSS-Rizal': [
    { id: 'STU033', name: 'David Mercado', lrn: '123456789047', gender: 'M' },
    { id: 'STU034', name: 'Christina Alvarez', lrn: '123456789048', gender: 'F' },
    { id: 'STU035', name: 'Anthony Valdez', lrn: '123456789049', gender: 'M' },
    { id: 'STU036', name: 'Stephanie Silva', lrn: '123456789050', gender: 'F' },
    { id: 'STU037', name: 'Francis Ortega', lrn: '123456789051', gender: 'M' },
    { id: 'STU038', name: 'Melissa Pascual', lrn: '123456789052', gender: 'F' },
  ],
  'HUMSS-Bonifacio': [
    { id: 'STU039', name: 'Benjamin Cruz', lrn: '123456789053', gender: 'M' },
    { id: 'STU040', name: 'Kristine Jimenez', lrn: '123456789054', gender: 'F' },
    { id: 'STU041', name: 'Jerome Santos', lrn: '123456789055', gender: 'M' },
    { id: 'STU042', name: 'Catherine Mendoza', lrn: '123456789056', gender: 'F' },
    { id: 'STU043', name: 'Kenneth Castillo', lrn: '123456789057', gender: 'M' },
    { id: 'STU044', name: 'Maria Angeles', lrn: '123456789058', gender: 'F' },
  ],
  'HUMSS-Luna': [
    { id: 'STU125', name: 'Aaron Villanueva', lrn: '123456789139', gender: 'M' },
    { id: 'STU126', name: 'Clarissa Fernandez', lrn: '123456789140', gender: 'F' },
    { id: 'STU127', name: 'Elijah Rodriguez', lrn: '123456789141', gender: 'M' },
    { id: 'STU128', name: 'Hannah Santiago', lrn: '123456789142', gender: 'F' },
    { id: 'STU129', name: 'Isaac Aquino', lrn: '123456789143', gender: 'M' },
    { id: 'STU130', name: 'Julia Bautista', lrn: '123456789144', gender: 'F' },
  ],

  // ABM Sections
  'ABM-Aguinaldo': [
    { id: 'STU045', name: 'Richard Villaruz', lrn: '123456789059', gender: 'M' },
    { id: 'STU046', name: 'Angelica Cortez', lrn: '123456789060', gender: 'F' },
    { id: 'STU047', name: 'Jonathan Manalo', lrn: '123456789061', gender: 'M' },
    { id: 'STU048', name: 'Marianne Espinosa', lrn: '123456789062', gender: 'F' },
    { id: 'STU049', name: 'Raymond Aguilar', lrn: '123456789063', gender: 'M' },
    { id: 'STU050', name: 'Veronica Salazar', lrn: '123456789064', gender: 'F' },
    { id: 'STU051', name: 'Eduardo Navarro', lrn: '123456789065', gender: 'M' },
    { id: 'STU052', name: 'Diana Campos', lrn: '123456789066', gender: 'F' },
  ],
  'ABM-Jacinto': [
    { id: 'STU053', name: 'Alexander Reyes', lrn: '123456789067', gender: 'M' },
    { id: 'STU054', name: 'Jennifer Ramos', lrn: '123456789068', gender: 'F' },
    { id: 'STU055', name: 'Dennis Olivares', lrn: '123456789069', gender: 'M' },
    { id: 'STU056', name: 'Rachelle Villanueva', lrn: '123456789070', gender: 'F' },
    { id: 'STU057', name: 'William Castro', lrn: '123456789071', gender: 'M' },
    { id: 'STU058', name: 'Theresa Morales', lrn: '123456789072', gender: 'F' },
  ],
  'ABM-Gomez': [
    { id: 'STU059', name: 'Patrick Domingo', lrn: '123456789073', gender: 'M' },
    { id: 'STU060', name: 'Rosemarie Luna', lrn: '123456789074', gender: 'F' },
    { id: 'STU061', name: 'Lawrence Santiago', lrn: '123456789075', gender: 'M' },
    { id: 'STU062', name: 'Victoria Pineda', lrn: '123456789076', gender: 'F' },
    { id: 'STU063', name: 'Joseph Enriquez', lrn: '123456789077', gender: 'M' },
    { id: 'STU064', name: 'Lorraine Gomez', lrn: '123456789078', gender: 'F' },
  ],
  'ABM-Burgos': [
    { id: 'STU065', name: 'Frederick Soriano', lrn: '123456789079', gender: 'M' },
    { id: 'STU066', name: 'Vanessa Aquino', lrn: '123456789080', gender: 'F' },
    { id: 'STU067', name: 'Timothy Rivera', lrn: '123456789081', gender: 'M' },
    { id: 'STU068', name: 'Bernadette Marquez', lrn: '123456789082', gender: 'F' },
    { id: 'STU069', name: 'Arnold Del Rosario', lrn: '123456789083', gender: 'M' },
    { id: 'STU070', name: 'Jocelyn Fernandez', lrn: '123456789084', gender: 'F' },
    { id: 'STU071', name: 'Gerald Bautista', lrn: '123456789085', gender: 'M' },
    { id: 'STU072', name: 'Elizabeth Cruz', lrn: '123456789086', gender: 'F' },
  ],

  // ICT Sections
  'ICT-Tesla': [
    { id: 'STU085', name: 'Kevin Santos', lrn: '123456789099', gender: 'M' },
    { id: 'STU086', name: 'Christine Lopez', lrn: '123456789100', gender: 'F' },
    { id: 'STU087', name: 'Brian Cruz', lrn: '123456789101', gender: 'M' },
    { id: 'STU088', name: 'Denise Garcia', lrn: '123456789102', gender: 'F' },
    { id: 'STU089', name: 'Nathan Reyes', lrn: '123456789103', gender: 'M' },
    { id: 'STU090', name: 'Hannah Mendoza', lrn: '123456789104', gender: 'F' },
  ],
  'ICT-Gates': [
    { id: 'STU131', name: 'Lucas Torres', lrn: '123456789145', gender: 'M' },
    { id: 'STU132', name: 'Megan Ramos', lrn: '123456789146', gender: 'F' },
    { id: 'STU133', name: 'Oliver Domingo', lrn: '123456789147', gender: 'M' },
    { id: 'STU134', name: 'Rachel Luna', lrn: '123456789148', gender: 'F' },
    { id: 'STU135', name: 'Samuel Castro', lrn: '123456789149', gender: 'M' },
    { id: 'STU136', name: 'Victoria Santos', lrn: '123456789150', gender: 'F' },
  ],
  'ICT-Jobs': [
    { id: 'STU137', name: 'Xavier Flores', lrn: '123456789151', gender: 'M' },
    { id: 'STU138', name: 'Yasmin Morales', lrn: '123456789152', gender: 'F' },
    { id: 'STU139', name: 'Zachary Navarro', lrn: '123456789153', gender: 'M' },
    { id: 'STU140', name: 'Audrey Reyes', lrn: '123456789154', gender: 'F' },
  ],
  'ICT-Turing': [
    { id: 'STU141', name: 'Caleb Castro', lrn: '123456789155', gender: 'M' },
    { id: 'STU142', name: 'Emma Fernandez', lrn: '123456789156', gender: 'F' },
    { id: 'STU143', name: 'Dylan Rodriguez', lrn: '123456789157', gender: 'M' },
    { id: 'STU144', name: 'Faith Santiago', lrn: '123456789158', gender: 'F' },
  ],

  // HE (Home Economics) Sections
  'HE-Orchid': [
    { id: 'STU091', name: 'Michael Torres', lrn: '123456789105', gender: 'M' },
    { id: 'STU092', name: 'Aileen Domingo', lrn: '123456789106', gender: 'F' },
    { id: 'STU093', name: 'Jeffrey Ramos', lrn: '123456789107', gender: 'M' },
    { id: 'STU094', name: 'Marissa Santos', lrn: '123456789108', gender: 'F' },
    { id: 'STU095', name: 'Juliet Cruz', lrn: '123456789109', gender: 'F' },
    { id: 'STU096', name: 'Rosalie Garcia', lrn: '123456789110', gender: 'F' },
  ],
  'HE-Jasmine': [
    { id: 'STU145', name: 'Henry Aquino', lrn: '123456789159', gender: 'M' },
    { id: 'STU146', name: 'Grace Bautista', lrn: '123456789160', gender: 'F' },
    { id: 'STU147', name: 'Ian Villanueva', lrn: '123456789161', gender: 'M' },
    { id: 'STU148', name: 'Joy Fernandez', lrn: '123456789162', gender: 'F' },
    { id: 'STU149', name: 'Katherine Lopez', lrn: '123456789163', gender: 'F' },
    { id: 'STU150', name: 'Liza Martinez', lrn: '123456789164', gender: 'F' },
  ],
  'HE-Lily': [
    { id: 'STU151', name: 'Mario Perez', lrn: '123456789165', gender: 'M' },
    { id: 'STU152', name: 'Nina Diaz', lrn: '123456789166', gender: 'F' },
    { id: 'STU153', name: 'Oscar Ramirez', lrn: '123456789167', gender: 'M' },
    { id: 'STU154', name: 'Paula Gonzales', lrn: '123456789168', gender: 'F' },
  ],
  'HE-Rose': [
    { id: 'STU155', name: 'Quinn Hernandez', lrn: '123456789169', gender: 'M' },
    { id: 'STU156', name: 'Rita Ruiz', lrn: '123456789170', gender: 'F' },
    { id: 'STU157', name: 'Steve Mercado', lrn: '123456789171', gender: 'M' },
    { id: 'STU158', name: 'Tina Alvarez', lrn: '123456789172', gender: 'F' },
  ],

  // IA (Industrial Arts) Sections
  'IA-Mactan': [
    { id: 'STU097', name: 'Roberto Santos', lrn: '123456789111', gender: 'M' },
    { id: 'STU098', name: 'Fernando Cruz', lrn: '123456789112', gender: 'M' },
    { id: 'STU099', name: 'Gregorio Reyes', lrn: '123456789113', gender: 'M' },
    { id: 'STU100', name: 'Antonio Lopez', lrn: '123456789114', gender: 'M' },
    { id: 'STU101', name: 'Carmen Mendoza', lrn: '123456789115', gender: 'F' },
    { id: 'STU102', name: 'Elena Garcia', lrn: '123456789116', gender: 'F' },
  ],
  'IA-Calamba': [
    { id: 'STU073', name: 'Ronald Garcia', lrn: '123456789087', gender: 'M' },
    { id: 'STU074', name: 'Josephine Lim', lrn: '123456789088', gender: 'F' },
    { id: 'STU075', name: 'Christopher Tan', lrn: '123456789089', gender: 'M' },
    { id: 'STU076', name: 'Evelyn Ong', lrn: '123456789090', gender: 'F' },
    { id: 'STU077', name: 'Salvador Yap', lrn: '123456789091', gender: 'M' },
    { id: 'STU078', name: 'Gina Sy', lrn: '123456789092', gender: 'F' },
  ],
  'IA-Taal': [
    { id: 'STU079', name: 'Rodolfo Chan', lrn: '123456789093', gender: 'M' },
    { id: 'STU080', name: 'Remedios Go', lrn: '123456789094', gender: 'F' },
    { id: 'STU081', name: 'Alberto Chua', lrn: '123456789095', gender: 'M' },
    { id: 'STU082', name: 'Gloria Lee', lrn: '123456789096', gender: 'F' },
    { id: 'STU083', name: 'Manuel Wong', lrn: '123456789097', gender: 'M' },
    { id: 'STU084', name: 'Cecilia Ang', lrn: '123456789098', gender: 'F' },
  ],
  'IA-Mayon': [
    { id: 'STU159', name: 'Ulysses Valdez', lrn: '123456789173', gender: 'M' },
    { id: 'STU160', name: 'Vanessa Silva', lrn: '123456789174', gender: 'F' },
    { id: 'STU161', name: 'Walter Ortega', lrn: '123456789175', gender: 'M' },
    { id: 'STU162', name: 'Yvonne Pascual', lrn: '123456789176', gender: 'F' },
  ],
};

// DepEd grading data structure
export const mockDepEdGrades = {
  'STEM-Mabini': {
    'General Mathematics': [
      {
        studentId: 'STU001',
        studentName: 'Juan Dela Cruz',
        lrn: '123456789012',
        writtenWorks: [18, 20, 17, 19], // out of 20 each
        performanceTasks: [38, 42, 40], // out of 50 each
        participation: 9, // out of 10
        attendance: 95, // percentage
        behaviour: 9, // out of 10
        seatwork: [8, 9, 7, 8, 9], // out of 10 each
        quarterlyExam: 85, // out of 100
      },
      {
        studentId: 'STU002',
        studentName: 'Maria Clara',
        lrn: '123456789016',
        writtenWorks: [19, 20, 18, 20],
        performanceTasks: [45, 48, 46],
        participation: 10,
        attendance: 98,
        behaviour: 10,
        seatwork: [9, 10, 9, 9, 10],
        quarterlyExam: 92,
      },
      {
        studentId: 'STU003',
        studentName: 'Jose Rizal Jr.',
        lrn: '123456789017',
        writtenWorks: [16, 18, 15, 17],
        performanceTasks: [35, 40, 38],
        participation: 8,
        attendance: 90,
        behaviour: 8,
        seatwork: [7, 8, 7, 8, 8],
        quarterlyExam: 80,
      },
      {
        studentId: 'STU004',
        studentName: 'Ana Santos',
        lrn: '123456789018',
        writtenWorks: [17, 19, 18, 18],
        performanceTasks: [40, 43, 41],
        participation: 9,
        attendance: 93,
        behaviour: 9,
        seatwork: [8, 9, 8, 9, 8],
        quarterlyExam: 87,
      },
      {
        studentId: 'STU005',
        studentName: 'Carlos Reyes',
        lrn: '123456789019',
        writtenWorks: [15, 17, 16, 16],
        performanceTasks: [32, 38, 35],
        participation: 7,
        attendance: 88,
        behaviour: 8,
        seatwork: [7, 7, 8, 7, 8],
        quarterlyExam: 78,
      },
    ]
  }
};

// Teachers data for Principal Portal - Import from complete data
export { mockTeachersComplete as mockTeachers } from './mockDataComplete';

// Extended sections with detailed assignments for Section Oversight - Import from complete data
export { mockSectionsComplete as mockSectionsWithAssignments } from './mockDataComplete';

// Student detailed grades for Academic Reports (HUMSS and TVL students only)
export const mockStudentGrades = [
  // HUMSS Students
  {
    studentId: 'STU004',
    studentName: 'Carlos Mendoza',
    lrn: '123456789019',
    strand: 'HUMSS',
    section: 'HUMSS 12-Luna',
    gradeLevel: '12',
    gender: 'Male',
    subjects: [
      { subject: 'Reading and Writing', q1: 87, q2: 86, q3: 88, q4: 87, final: 87, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 85, q2: 86, q3: 87, q4: 86, final: 86, status: 'Passed' },
      { subject: 'Physical Science', q1: 86, q2: 87, q3: 86, q4: 88, final: 86.75, status: 'Passed' },
      { subject: 'Creative Writing', q1: 88, q2: 87, q3: 89, q4: 88, final: 88, status: 'Passed' },
      { subject: 'Disciplines and Ideas in Social Sciences', q1: 85, q2: 86, q3: 87, q4: 86, final: 86, status: 'Passed' }
    ],
    overallAverage: 86.8,
    status: 'Passed'
  },
  {
    studentId: 'STU005',
    studentName: 'Sofia Martinez',
    lrn: '123456789020',
    strand: 'HUMSS',
    section: 'HUMSS 12-Luna',
    gradeLevel: '12',
    gender: 'Female',
    subjects: [
      { subject: 'Reading and Writing', q1: 90, q2: 89, q3: 90, q4: 89, final: 89.5, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 88, q2: 89, q3: 90, q4: 89, final: 89, status: 'Passed' },
      { subject: 'Physical Science', q1: 89, q2: 90, q3: 89, q4: 91, final: 89.75, status: 'Passed' },
      { subject: 'Creative Writing', q1: 91, q2: 90, q3: 92, q4: 90, final: 90.75, status: 'Passed' },
      { subject: 'Disciplines and Ideas in Social Sciences', q1: 88, q2: 89, q3: 90, q4: 89, final: 89, status: 'Passed' }
    ],
    overallAverage: 89.5,
    status: 'Passed'
  },
  {
    studentId: 'STU006',
    studentName: 'Miguel Torres',
    lrn: '123456789021',
    strand: 'HUMSS',
    section: 'HUMSS 11-Del Pilar',
    gradeLevel: '11',
    gender: 'Male',
    subjects: [
      { subject: 'Oral Communication', q1: 84, q2: 85, q3: 86, q4: 85, final: 85, status: 'Passed' },
      { subject: 'Komunikasyon at Pananaliksik', q1: 83, q2: 84, q3: 85, q4: 84, final: 84, status: 'Passed' },
      { subject: 'General Mathematics', q1: 82, q2: 83, q3: 84, q4: 83, final: 83, status: 'Passed' },
      { subject: 'Introduction to Philosophy', q1: 85, q2: 86, q3: 87, q4: 86, final: 86, status: 'Passed' },
      { subject: 'Earth and Life Science', q1: 84, q2: 85, q3: 86, q4: 85, final: 85, status: 'Passed' }
    ],
    overallAverage: 84.6,
    status: 'Passed'
  },
  {
    studentId: 'STU007',
    studentName: 'Isabella Reyes',
    lrn: '123456789022',
    strand: 'HUMSS',
    section: 'HUMSS 11-Del Pilar',
    gradeLevel: '11',
    gender: 'Female',
    subjects: [
      { subject: 'Oral Communication', q1: 89, q2: 90, q3: 88, q4: 90, final: 89.25, status: 'Passed' },
      { subject: 'Komunikasyon at Pananaliksik', q1: 88, q2: 89, q3: 87, q4: 89, final: 88.25, status: 'Passed' },
      { subject: 'General Mathematics', q1: 87, q2: 88, q3: 86, q4: 88, final: 87.25, status: 'Passed' },
      { subject: 'Introduction to Philosophy', q1: 90, q2: 91, q3: 89, q4: 91, final: 90.25, status: 'Passed' },
      { subject: 'Earth and Life Science', q1: 88, q2: 89, q3: 87, q4: 89, final: 88.25, status: 'Passed' }
    ],
    overallAverage: 88.65,
    status: 'Passed'
  },
  // TVL Students
  {
    studentId: 'STU012',
    studentName: 'Nathaniel Gonzales',
    lrn: '123456789027',
    strand: 'TVL',
    section: 'TVL 12-Burgos',
    gradeLevel: '12',
    gender: 'Male',
    subjects: [
      { subject: 'Reading and Writing', q1: 86, q2: 85, q3: 87, q4: 86, final: 86, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 84, q2: 85, q3: 86, q4: 85, final: 85, status: 'Passed' },
      { subject: 'Physical Science', q1: 85, q2: 86, q3: 85, q4: 87, final: 85.75, status: 'Passed' },
      { subject: 'Web Development', q1: 87, q2: 86, q3: 88, q4: 87, final: 87, status: 'Passed' },
      { subject: 'Computer Networking', q1: 85, q2: 86, q3: 87, q4: 86, final: 86, status: 'Passed' }
    ],
    overallAverage: 85.95,
    status: 'Passed'
  },
  {
    studentId: 'STU013',
    studentName: 'Angelica Fernandez',
    lrn: '123456789028',
    strand: 'TVL',
    section: 'TVL 12-Burgos',
    gradeLevel: '12',
    gender: 'Female',
    subjects: [
      { subject: 'Reading and Writing', q1: 88, q2: 87, q3: 88, q4: 88, final: 87.75, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 86, q2: 87, q3: 88, q4: 87, final: 87, status: 'Passed' },
      { subject: 'Physical Science', q1: 87, q2: 88, q3: 87, q4: 89, final: 87.75, status: 'Passed' },
      { subject: 'Web Development', q1: 89, q2: 88, q3: 90, q4: 89, final: 89, status: 'Passed' },
      { subject: 'Computer Networking', q1: 86, q2: 87, q3: 88, q4: 87, final: 87, status: 'Passed' }
    ],
    overallAverage: 87.7,
    status: 'Passed'
  },
  {
    studentId: 'STU014',
    studentName: 'Christian Velasco',
    lrn: '123456789029',
    strand: 'TVL',
    section: 'TVL 11-Ponce',
    gradeLevel: '11',
    gender: 'Male',
    subjects: [
      { subject: 'Oral Communication', q1: 78, q2: 79, q3: 80, q4: 79, final: 79, status: 'Passed' },
      { subject: 'Komunikasyon at Pananaliksik', q1: 77, q2: 78, q3: 79, q4: 78, final: 78, status: 'Passed' },
      { subject: 'General Mathematics', q1: 76, q2: 77, q3: 78, q4: 77, final: 77, status: 'Passed' },
      { subject: 'Computer Systems Servicing', q1: 80, q2: 81, q3: 82, q4: 81, final: 81, status: 'Passed' },
      { subject: 'Programming (Java)', q1: 79, q2: 80, q3: 81, q4: 80, final: 80, status: 'Passed' }
    ],
    overallAverage: 79,
    status: 'Passed'
  },
  {
    studentId: 'STU015',
    studentName: 'Patricia Alvarez',
    lrn: '123456789030',
    strand: 'TVL',
    section: 'TVL 11-Ponce',
    gradeLevel: '11',
    gender: 'Female',
    subjects: [
      { subject: 'Oral Communication', q1: 90, q2: 91, q3: 89, q4: 91, final: 90.25, status: 'Passed' },
      { subject: 'Komunikasyon at Pananaliksik', q1: 89, q2: 90, q3: 88, q4: 90, final: 89.25, status: 'Passed' },
      { subject: 'General Mathematics', q1: 88, q2: 89, q3: 87, q4: 89, final: 88.25, status: 'Passed' },
      { subject: 'Computer Systems Servicing', q1: 91, q2: 92, q3: 90, q4: 92, final: 91.25, status: 'Passed' },
      { subject: 'Programming (Java)', q1: 90, q2: 91, q3: 89, q4: 91, final: 90.25, status: 'Passed' }
    ],
    overallAverage: 89.85,
    status: 'Passed'
  }
];

// Additional academic reports data for Principal Dashboard
export { mockAcademicReportsData } from './mockAcademicReportsData';

// Student documents for Student Records folder - Import from complete data
export { mockStudentDocumentsComplete as mockStudentDocuments } from './mockDataComplete';

// Additional comprehensive mock data for Principal Portal

// Extended student documents with more students across different strands
export const mockStudentDocumentsExtended = [
  // STEM Students
  {
    id: '1',
    studentName: 'Juan Dela Cruz',
    lrn: '123456789012',
    section: 'STEM 12-Mabini',
    gradeLevel: '12',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  {
    id: '2',
    studentName: 'Maria Clara',
    lrn: '123456789016',
    section: 'STEM 12-Mabini',
    gradeLevel: '12',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  {
    id: '3',
    studentName: 'Jose Rizal Jr.',
    lrn: '123456789017',
    section: 'STEM 11-Rizal',
    gradeLevel: '11',
    form137: 'Available',
    form138: 'Missing',
    goodMoral: 'Available'
  },
  {
    id: '4',
    studentName: 'Ana Santos',
    lrn: '123456789018',
    section: 'STEM 11-Rizal',
    gradeLevel: '11',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  // HUMSS Students
  {
    id: '5',
    studentName: 'Carlos Mendoza',
    lrn: '123456789019',
    section: 'HUMSS 12-Luna',
    gradeLevel: '12',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Missing'
  },
  {
    id: '6',
    studentName: 'Sofia Martinez',
    lrn: '123456789020',
    section: 'HUMSS 12-Luna',
    gradeLevel: '12',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  {
    id: '7',
    studentName: 'Miguel Torres',
    lrn: '123456789021',
    section: 'HUMSS 11-Del Pilar',
    gradeLevel: '11',
    form137: 'Missing',
    form138: 'Available',
    goodMoral: 'Available'
  },
  {
    id: '8',
    studentName: 'Isabella Reyes',
    lrn: '123456789022',
    section: 'HUMSS 11-Del Pilar',
    gradeLevel: '11',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  // ABM Students
  {
    id: '9',
    studentName: 'Gabriel Cruz',
    lrn: '123456789023',
    section: 'ABM 12-Mabini',
    gradeLevel: '12',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  {
    id: '10',
    studentName: 'Samantha Lopez',
    lrn: '123456789024',
    section: 'ABM 12-Mabini',
    gradeLevel: '12',
    form137: 'Available',
    form138: 'Missing',
    goodMoral: 'Available'
  },
  {
    id: '11',
    studentName: 'Daniel Ramos',
    lrn: '123456789025',
    section: 'ABM 11-Jacinto',
    gradeLevel: '11',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  {
    id: '12',
    studentName: 'Victoria Garcia',
    lrn: '123456789026',
    section: 'ABM 11-Jacinto',
    gradeLevel: '11',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Missing'
  },
  // TVL Students
  {
    id: '13',
    studentName: 'Nathaniel Gonzales',
    lrn: '123456789027',
    section: 'TVL 12-Burgos',
    gradeLevel: '12',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  {
    id: '14',
    studentName: 'Angelica Fernandez',
    lrn: '123456789028',
    section: 'TVL 12-Burgos',
    gradeLevel: '12',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  },
  {
    id: '15',
    studentName: 'Christian Velasco',
    lrn: '123456789029',
    section: 'TVL 11-Ponce',
    gradeLevel: '11',
    form137: 'Missing',
    form138: 'Missing',
    goodMoral: 'Available'
  },
  {
    id: '16',
    studentName: 'Patricia Alvarez',
    lrn: '123456789030',
    section: 'TVL 11-Ponce',
    gradeLevel: '11',
    form137: 'Available',
    form138: 'Available',
    goodMoral: 'Available'
  }
];

// Extended student grades for principal's academic reports
export const mockStudentGradesExtended = [
  // STEM 12-Mabini students
  {
    studentId: 'STU001',
    studentName: 'Juan Dela Cruz',
    lrn: '123456789012',
    strand: 'STEM',
    section: 'STEM 12-Mabini',
    gradeLevel: '12',
    overallAverage: 87.75,
    subjects: [
      { subject: 'Reading and Writing', q1: 88, q2: 87, q3: 89, q4: 88, final: 88, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 85, q2: 86, q3: 88, q4: 87, final: 86.5, status: 'Passed' },
      { subject: 'Physical Science', q1: 89, q2: 88, q3: 87, q4: 90, final: 88.5, status: 'Passed' },
      { subject: 'Basic Calculus', q1: 86, q2: 87, q3: 88, q4: 89, final: 87.5, status: 'Passed' },
      { subject: 'General Physics 1', q1: 87, q2: 88, q3: 86, q4: 88, final: 87.25, status: 'Passed' }
    ]
  },
  {
    studentId: 'STU002',
    studentName: 'Maria Clara',
    lrn: '123456789016',
    strand: 'STEM',
    section: 'STEM 12-Mabini',
    gradeLevel: '12',
    overallAverage: 91.2,
    subjects: [
      { subject: 'Reading and Writing', q1: 92, q2: 91, q3: 90, q4: 92, final: 91.25, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 90, q2: 91, q3: 92, q4: 90, final: 90.75, status: 'Passed' },
      { subject: 'Physical Science', q1: 91, q2: 92, q3: 91, q4: 93, final: 91.75, status: 'Passed' },
      { subject: 'Basic Calculus', q1: 90, q2: 91, q3: 92, q4: 91, final: 91, status: 'Passed' },
      { subject: 'General Physics 1', q1: 91, q2: 92, q3: 90, q4: 92, final: 91.25, status: 'Passed' }
    ]
  },
  // HUMSS 12-Luna students
  {
    studentId: 'STU005',
    studentName: 'Carlos Mendoza',
    lrn: '123456789019',
    strand: 'HUMSS',
    section: 'HUMSS 12-Luna',
    gradeLevel: '12',
    overallAverage: 86.8,
    subjects: [
      { subject: 'Reading and Writing', q1: 87, q2: 86, q3: 88, q4: 87, final: 87, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 85, q2: 86, q3: 87, q4: 86, final: 86, status: 'Passed' },
      { subject: 'Physical Science', q1: 86, q2: 87, q3: 86, q4: 88, final: 86.75, status: 'Passed' },
      { subject: 'Creative Writing', q1: 88, q2: 87, q3: 89, q4: 88, final: 88, status: 'Passed' },
      { subject: 'Disciplines and Ideas in Social Sciences', q1: 85, q2: 86, q3: 87, q4: 86, final: 86, status: 'Passed' }
    ]
  },
  {
    studentId: 'STU006',
    studentName: 'Sofia Martinez',
    lrn: '123456789020',
    strand: 'HUMSS',
    section: 'HUMSS 12-Luna',
    gradeLevel: '12',
    overallAverage: 89.5,
    subjects: [
      { subject: 'Reading and Writing', q1: 90, q2: 89, q3: 90, q4: 89, final: 89.5, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 88, q2: 89, q3: 90, q4: 89, final: 89, status: 'Passed' },
      { subject: 'Physical Science', q1: 89, q2: 90, q3: 89, q4: 91, final: 89.75, status: 'Passed' },
      { subject: 'Creative Writing', q1: 91, q2: 90, q3: 92, q4: 90, final: 90.75, status: 'Passed' },
      { subject: 'Disciplines and Ideas in Social Sciences', q1: 88, q2: 89, q3: 90, q4: 89, final: 89, status: 'Passed' }
    ]
  },
  // ABM 12-Mabini students
  {
    studentId: 'STU009',
    studentName: 'Gabriel Cruz',
    lrn: '123456789023',
    strand: 'ABM',
    section: 'ABM 12-Mabini',
    gradeLevel: '12',
    overallAverage: 87.2,
    subjects: [
      { subject: 'Reading and Writing', q1: 88, q2: 87, q3: 88, q4: 87, final: 87.5, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 86, q2: 87, q3: 88, q4: 87, final: 87, status: 'Passed' },
      { subject: 'Physical Science', q1: 87, q2: 88, q3: 87, q4: 89, final: 87.75, status: 'Passed' },
      { subject: 'Business Ethics and Social Responsibility', q1: 88, q2: 87, q3: 89, q4: 88, final: 88, status: 'Passed' },
      { subject: 'Entrepreneurship', q1: 85, q2: 86, q3: 87, q4: 86, final: 86, status: 'Passed' }
    ]
  },
  {
    studentId: 'STU010',
    studentName: 'Samantha Lopez',
    lrn: '123456789024',
    strand: 'ABM',
    section: 'ABM 12-Mabini',
    gradeLevel: '12',
    overallAverage: 88.9,
    subjects: [
      { subject: 'Reading and Writing', q1: 90, q2: 89, q3: 89, q4: 90, final: 89.5, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 88, q2: 89, q3: 89, q4: 88, final: 88.5, status: 'Passed' },
      { subject: 'Physical Science', q1: 89, q2: 90, q3: 88, q4: 90, final: 89.25, status: 'Passed' },
      { subject: 'Business Ethics and Social Responsibility', q1: 89, q2: 88, q3: 90, q4: 89, final: 89, status: 'Passed' },
      { subject: 'Entrepreneurship', q1: 87, q2: 88, q3: 89, q4: 88, final: 88, status: 'Passed' }
    ]
  },
  // TVL 12-Burgos students
  {
    studentId: 'STU013',
    studentName: 'Nathaniel Gonzales',
    lrn: '123456789027',
    strand: 'TVL',
    section: 'TVL 12-Burgos',
    gradeLevel: '12',
    overallAverage: 85.9,
    subjects: [
      { subject: 'Reading and Writing', q1: 86, q2: 85, q3: 87, q4: 86, final: 86, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 84, q2: 85, q3: 86, q4: 85, final: 85, status: 'Passed' },
      { subject: 'Physical Science', q1: 85, q2: 86, q3: 85, q4: 87, final: 85.75, status: 'Passed' },
      { subject: 'Web Development', q1: 87, q2: 86, q3: 88, q4: 87, final: 87, status: 'Passed' },
      { subject: 'Computer Networking', q1: 85, q2: 86, q3: 87, q4: 86, final: 86, status: 'Passed' }
    ]
  },
  {
    studentId: 'STU014',
    studentName: 'Angelica Fernandez',
    lrn: '123456789028',
    strand: 'TVL',
    section: 'TVL 12-Burgos',
    gradeLevel: '12',
    overallAverage: 87.5,
    subjects: [
      { subject: 'Reading and Writing', q1: 88, q2: 87, q3: 88, q4: 88, final: 87.75, status: 'Passed' },
      { subject: 'Statistics and Probability', q1: 86, q2: 87, q3: 88, q4: 87, final: 87, status: 'Passed' },
      { subject: 'Physical Science', q1: 87, q2: 88, q3: 87, q4: 89, final: 87.75, status: 'Passed' },
      { subject: 'Web Development', q1: 89, q2: 88, q3: 90, q4: 89, final: 89, status: 'Passed' },
      { subject: 'Computer Networking', q1: 86, q2: 87, q3: 88, q4: 87, final: 87, status: 'Passed' }
    ]
  }
];

// Extended teachers list for principal portal
export const mockTeachersExtended = [
  {
    id: 'TCH001',
    name: 'Prof. Maria Santos',
    employeeId: 'EMP001',
    email: 'ms@teacher.ndga.edu.ph',
    department: 'Mathematics',
    specialization: 'Statistics and Probability',
    assignedSections: ['STEM 12-Mabini', 'ABM 12-Mabini'],
    yearsOfService: 12,
    status: 'Active'
  },
  {
    id: 'TCH002',
    name: 'Prof. Roberto Garcia',
    employeeId: 'EMP005',
    email: 'rg@teacher.ndga.edu.ph',
    department: 'Science',
    specialization: 'General Physics',
    assignedSections: ['STEM 12-Mabini', 'STEM 11-Rizal'],
    yearsOfService: 15,
    status: 'Active'
  },
  {
    id: 'TCH003',
    name: 'Prof. Elena Cruz',
    employeeId: 'EMP006',
    email: 'ec@teacher.ndga.edu.ph',
    department: 'English',
    specialization: 'Reading and Writing',
    assignedSections: ['HUMSS 12-Luna', 'HUMSS 11-Del Pilar'],
    yearsOfService: 8,
    status: 'Active'
  },
  {
    id: 'TCH004',
    name: 'Prof. Miguel Torres',
    employeeId: 'EMP007',
    email: 'mt@teacher.ndga.edu.ph',
    department: 'Business',
    specialization: 'Entrepreneurship',
    assignedSections: ['ABM 12-Mabini', 'ABM 11-Jacinto'],
    yearsOfService: 10,
    status: 'Active'
  },
  {
    id: 'TCH005',
    name: 'Prof. Ana Reyes',
    employeeId: 'EMP008',
    email: 'ar@teacher.ndga.edu.ph',
    department: 'ICT',
    specialization: 'Web Development',
    assignedSections: ['TVL 12-Burgos', 'TVL 11-Ponce'],
    yearsOfService: 6,
    status: 'Active'
  },
  {
    id: 'TCH006',
    name: 'Prof. Carlos Mendoza',
    employeeId: 'EMP009',
    email: 'cm@teacher.ndga.edu.ph',
    department: 'Social Sciences',
    specialization: 'Disciplines and Ideas in Social Sciences',
    assignedSections: ['HUMSS 12-Luna', 'HUMSS 11-Del Pilar'],
    yearsOfService: 9,
    status: 'Active'
  },
  {
    id: 'TCH007',
    name: 'Prof. Sofia Martinez',
    employeeId: 'EMP010',
    email: 'sm@teacher.ndga.edu.ph',
    department: 'Science',
    specialization: 'General Chemistry',
    assignedSections: ['STEM 12-Mabini', 'STEM 11-Rizal'],
    yearsOfService: 7,
    status: 'Active'
  },
  {
    id: 'TCH008',
    name: 'Prof. Gabriel Cruz',
    employeeId: 'EMP011',
    email: 'gc@teacher.ndga.edu.ph',
    department: 'Filipino',
    specialization: 'Pagbasa at Pagsusuri',
    assignedSections: ['STEM 12-Mabini', 'HUMSS 12-Luna'],
    yearsOfService: 11,
    status: 'Active'
  }
];

// Additional announcements for Principal Portal
export const mockPrincipalAnnouncements = [
  {
    id: 'PANN001',
    title: 'Quarterly Assessment Period',
    content: 'The third quarter assessment will be conducted from March 10-14, 2026. All students must prepare accordingly.',
    date: '2026-02-26',
    author: 'Principal Office',
    target: 'All Students',
    category: 'Academic',
    priority: 'high'
  },
  {
    id: 'PANN002',
    title: 'Teacher Development Workshop',
    content: 'All teaching staff are required to attend the Professional Development Workshop on March 8, 2026.',
    date: '2026-02-25',
    author: 'Principal Office',
    target: 'Teachers',
    category: 'Professional Development',
    priority: 'high'
  },
  {
    id: 'PANN003',
    title: 'Parent-Teacher Conference',
    content: 'Parent-Teacher Conference scheduled for March 20-21, 2026. Please coordinate with your advisers.',
    date: '2026-02-24',
    author: 'Principal Office',
    target: 'Parents and Teachers',
    category: 'School Events',
    priority: 'medium'
  },
  {
    id: 'PANN004',
    title: 'Scholarship Application Open',
    content: 'Merit-based scholarship applications for SY 2026-2027 are now open. Deadline: March 30, 2026.',
    date: '2026-02-23',
    author: 'Principal Office',
    target: 'All Students',
    category: 'Academic',
    priority: 'medium'
  }
];