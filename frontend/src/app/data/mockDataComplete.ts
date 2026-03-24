// Complete Mock Data for Student Information System with All 6 Strands
// Strands: STEM, HUMSS, ABM, TVL-ICT (Information Communications Technology), 
//          TVL-HE (Home Economics), TVL-IA (Industrial Arts)

// Complete Strands Data
export const mockStrandsComplete = [
  {
    name: 'STEM',
    fullName: 'Science, Technology, Engineering and Mathematics',
    sections: ['Sampaguita', 'Santan', 'Gumamela', 'Rosal']
  },
  {
    name: 'HUMSS',
    fullName: 'Humanities and Social Sciences',
    sections: ['Mabini', 'Rizal', 'Bonifacio', 'Luna']
  },
  {
    name: 'ABM',
    fullName: 'Accountancy, Business and Management',
    sections: ['Aguinaldo', 'Jacinto', 'Gomez', 'Burgos']
  },
  {
    name: 'ICT',
    fullName: 'Information and Communications Technology',
    sections: ['Tesla', 'Gates', 'Jobs', 'Turing']
  },
  {
    name: 'HE',
    fullName: 'Home Economics',
    sections: ['Orchid', 'Jasmine', 'Lily', 'Rose']
  },
  {
    name: 'IA',
    fullName: 'Industrial Arts',
    sections: ['Mactan', 'Calamba', 'Taal', 'Mayon']
  }
];

// Complete Sections with All Strands (Grade 11 & 12)
export const mockSectionsComplete = [
  // STEM Sections - Grade 11
  { id: 'SEC001', name: 'STEM 11-Sampaguita', strand: 'STEM', gradeLevel: '11', room: 'Room 301', studentCount: 38, capacity: 40, adviser: 'Maria Santos', adviserId: 'TCH001',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Earth and Life Science', teacher: 'Lisa Ramos' },
      { subject: 'General Chemistry 1', teacher: 'Lisa Ramos' },
      { subject: 'General Biology 1', teacher: 'Carlos Mendoza' },
      { subject: 'Oral Communication', teacher: 'John Cruz' },
      { subject: 'Komunikasyon at Pananaliksik', teacher: 'Rosa Garcia' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC002', name: 'STEM 11-Santan', strand: 'STEM', gradeLevel: '11', room: 'Room 302', studentCount: 36, capacity: 40, adviser: 'Lisa Ramos', adviserId: 'TCH003',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Earth and Life Science', teacher: 'Lisa Ramos' },
      { subject: 'General Chemistry 1', teacher: 'Lisa Ramos' },
      { subject: 'General Biology 1', teacher: 'Carlos Mendoza' },
      { subject: 'Oral Communication', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },
  
  // STEM Sections - Grade 12
  { id: 'SEC003', name: 'STEM 12-Gumamela', strand: 'STEM', gradeLevel: '12', room: 'Room 303', studentCount: 40, capacity: 40, adviser: 'Carlos Mendoza', adviserId: 'TCH004',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Physical Science', teacher: 'Lisa Ramos' },
      { subject: 'Basic Calculus', teacher: 'Maria Santos' },
      { subject: 'General Physics 1', teacher: 'Carlos Mendoza' },
      { subject: 'Reading and Writing', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC004', name: 'STEM 12-Rosal', strand: 'STEM', gradeLevel: '12', room: 'Room 304', studentCount: 39, capacity: 40, adviser: 'Maria Santos', adviserId: 'TCH001',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Physical Science', teacher: 'Lisa Ramos' },
      { subject: 'Basic Calculus', teacher: 'Maria Santos' },
      { subject: 'General Physics 1', teacher: 'Carlos Mendoza' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },

  // HUMSS Sections - Grade 11
  { id: 'SEC005', name: 'HUMSS 11-Mabini', strand: 'HUMSS', gradeLevel: '11', room: 'Room 201', studentCount: 35, capacity: 40, adviser: 'John Cruz', adviserId: 'TCH002',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Oral Communication', teacher: 'John Cruz' },
      { subject: 'Introduction to Philosophy', teacher: 'John Cruz' },
      { subject: 'Introduction to World Religions', teacher: 'Rosa Garcia' },
      { subject: 'Komunikasyon at Pananaliksik', teacher: 'Rosa Garcia' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC006', name: 'HUMSS 11-Rizal', strand: 'HUMSS', gradeLevel: '11', room: 'Room 202', studentCount: 33, capacity: 40, adviser: 'Rosa Garcia', adviserId: 'TCH005',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Oral Communication', teacher: 'John Cruz' },
      { subject: 'Introduction to Philosophy', teacher: 'John Cruz' },
      { subject: 'Introduction to World Religions', teacher: 'Rosa Garcia' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },

  // HUMSS Sections - Grade 12
  { id: 'SEC007', name: 'HUMSS 12-Bonifacio', strand: 'HUMSS', gradeLevel: '12', room: 'Room 203', studentCount: 37, capacity: 40, adviser: 'John Cruz', adviserId: 'TCH002',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Reading and Writing', teacher: 'John Cruz' },
      { subject: 'Creative Writing', teacher: 'Rosa Garcia' },
      { subject: 'Disciplines and Ideas in Social Sciences', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC008', name: 'HUMSS 12-Luna', strand: 'HUMSS', gradeLevel: '12', room: 'Room 204', studentCount: 34, capacity: 40, adviser: 'Rosa Garcia', adviserId: 'TCH005',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Reading and Writing', teacher: 'John Cruz' },
      { subject: 'Creative Writing', teacher: 'Rosa Garcia' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },

  // ABM Sections - Grade 11
  { id: 'SEC009', name: 'ABM 11-Aguinaldo', strand: 'ABM', gradeLevel: '11', room: 'Room 101', studentCount: 38, capacity: 40, adviser: 'Patricia Lim', adviserId: 'TCH007',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Fundamentals of Accountancy', teacher: 'Patricia Lim' },
      { subject: 'Business Management', teacher: 'Patricia Lim' },
      { subject: 'Oral Communication', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC010', name: 'ABM 11-Jacinto', strand: 'ABM', gradeLevel: '11', room: 'Room 102', studentCount: 40, capacity: 40, adviser: 'Patricia Lim', adviserId: 'TCH007',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Fundamentals of Accountancy', teacher: 'Patricia Lim' },
      { subject: 'Business Management', teacher: 'Patricia Lim' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },

  // ABM Sections - Grade 12
  { id: 'SEC011', name: 'ABM 12-Gomez', strand: 'ABM', gradeLevel: '12', room: 'Room 103', studentCount: 36, capacity: 40, adviser: 'Patricia Lim', adviserId: 'TCH007',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Business Ethics and Social Responsibility', teacher: 'Patricia Lim' },
      { subject: 'Entrepreneurship', teacher: 'Patricia Lim' },
      { subject: 'Reading and Writing', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC012', name: 'ABM 12-Burgos', strand: 'ABM', gradeLevel: '12', room: 'Room 104', studentCount: 35, capacity: 40, adviser: 'Patricia Lim', adviserId: 'TCH007',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Business Ethics and Social Responsibility', teacher: 'Patricia Lim' },
      { subject: 'Entrepreneurship', teacher: 'Patricia Lim' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },

  // ICT Sections - Grade 11
  { id: 'SEC013', name: 'ICT 11-Tesla', strand: 'ICT', gradeLevel: '11', room: 'Computer Lab 1', studentCount: 32, capacity: 35, adviser: 'Roberto Aquino', adviserId: 'TCH008',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Computer Systems Servicing', teacher: 'Roberto Aquino' },
      { subject: 'Programming (Java)', teacher: 'Roberto Aquino' },
      { subject: 'Oral Communication', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC014', name: 'ICT 11-Gates', strand: 'ICT', gradeLevel: '11', room: 'Computer Lab 2', studentCount: 30, capacity: 35, adviser: 'Roberto Aquino', adviserId: 'TCH008',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Computer Systems Servicing', teacher: 'Roberto Aquino' },
      { subject: 'Programming (Java)', teacher: 'Roberto Aquino' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },

  // ICT Sections - Grade 12
  { id: 'SEC015', name: 'ICT 12-Jobs', strand: 'ICT', gradeLevel: '12', room: 'Computer Lab 3', studentCount: 33, capacity: 35, adviser: 'Roberto Aquino', adviserId: 'TCH008',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Web Development', teacher: 'Roberto Aquino' },
      { subject: 'Computer Networking', teacher: 'Roberto Aquino' },
      { subject: 'Reading and Writing', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC016', name: 'ICT 12-Turing', strand: 'ICT', gradeLevel: '12', room: 'Computer Lab 4', studentCount: 31, capacity: 35, adviser: 'Roberto Aquino', adviserId: 'TCH008',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Web Development', teacher: 'Roberto Aquino' },
      { subject: 'Computer Networking', teacher: 'Roberto Aquino' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },

  // HE Sections - Grade 11
  { id: 'SEC017', name: 'HE 11-Orchid', strand: 'HE', gradeLevel: '11', room: 'HE Lab 1', studentCount: 28, capacity: 30, adviser: 'Angela Cruz', adviserId: 'TCH009',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Bread and Pastry Production', teacher: 'Angela Cruz' },
      { subject: 'Cookery', teacher: 'Angela Cruz' },
      { subject: 'Oral Communication', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC018', name: 'HE 11-Jasmine', strand: 'HE', gradeLevel: '11', room: 'HE Lab 2', studentCount: 27, capacity: 30, adviser: 'Angela Cruz', adviserId: 'TCH009',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Bread and Pastry Production', teacher: 'Angela Cruz' },
      { subject: 'Cookery', teacher: 'Angela Cruz' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },

  // HE Sections - Grade 12
  { id: 'SEC019', name: 'HE 12-Lily', strand: 'HE', gradeLevel: '12', room: 'HE Lab 3', studentCount: 29, capacity: 30, adviser: 'Angela Cruz', adviserId: 'TCH009',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Food and Beverage Services', teacher: 'Angela Cruz' },
      { subject: 'Housekeeping', teacher: 'Angela Cruz' },
      { subject: 'Reading and Writing', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC020', name: 'HE 12-Rose', strand: 'HE', gradeLevel: '12', room: 'HE Lab 4', studentCount: 26, capacity: 30, adviser: 'Angela Cruz', adviserId: 'TCH009',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Food and Beverage Services', teacher: 'Angela Cruz' },
      { subject: 'Housekeeping', teacher: 'Angela Cruz' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },

  // IA Sections - Grade 11
  { id: 'SEC021', name: 'IA 11-Mactan', strand: 'IA', gradeLevel: '11', room: 'Workshop 1', studentCount: 30, capacity: 35, adviser: 'Fernando Santos', adviserId: 'TCH010',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Welding', teacher: 'Fernando Santos' },
      { subject: 'Carpentry', teacher: 'Fernando Santos' },
      { subject: 'Oral Communication', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC022', name: 'IA 11-Calamba', strand: 'IA', gradeLevel: '11', room: 'Workshop 2', studentCount: 32, capacity: 35, adviser: 'Fernando Santos', adviserId: 'TCH010',
    subjectTeachers: [
      { subject: 'General Mathematics', teacher: 'Maria Santos' },
      { subject: 'Welding', teacher: 'Fernando Santos' },
      { subject: 'Carpentry', teacher: 'Fernando Santos' },
      { subject: 'Physical Education and Health 11', teacher: 'Mark Gonzales' }
    ]
  },

  // IA Sections - Grade 12
  { id: 'SEC023', name: 'IA 12-Taal', strand: 'IA', gradeLevel: '12', room: 'Workshop 3', studentCount: 34, capacity: 35, adviser: 'Fernando Santos', adviserId: 'TCH010',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Plumbing', teacher: 'Fernando Santos' },
      { subject: 'Electrical Installation', teacher: 'Fernando Santos' },
      { subject: 'Reading and Writing', teacher: 'John Cruz' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  },
  { id: 'SEC024', name: 'IA 12-Mayon', strand: 'IA', gradeLevel: '12', room: 'Workshop 4', studentCount: 31, capacity: 35, adviser: 'Fernando Santos', adviserId: 'TCH010',
    subjectTeachers: [
      { subject: 'Statistics and Probability', teacher: 'Maria Santos' },
      { subject: 'Plumbing', teacher: 'Fernando Santos' },
      { subject: 'Electrical Installation', teacher: 'Fernando Santos' },
      { subject: 'Physical Education and Health 12', teacher: 'Mark Gonzales' }
    ]
  }
];

// Complete Teachers List
export const mockTeachersComplete = [
  {
    id: 'TCH001',
    name: 'Maria Santos',
    employeeId: 'EMP001',
    email: 'maria.santos@school.edu.ph',
    department: 'Mathematics',
    assignedSections: ['STEM 11-Sampaguita', 'STEM 11-Santan', 'STEM 12-Gumamela', 'STEM 12-Rosal'],
    assignedSubjects: ['General Mathematics', 'Statistics and Probability', 'Basic Calculus'],
    isAdviser: true,
    advisorySection: 'STEM 11-Sampaguita'
  },
  {
    id: 'TCH002',
    name: 'John Cruz',
    employeeId: 'EMP002',
    email: 'john.cruz@school.edu.ph',
    department: 'English/Social Studies',
    assignedSections: ['HUMSS 11-Mabini', 'HUMSS 12-Bonifacio', 'STEM 11-Sampaguita'],
    assignedSubjects: ['Oral Communication', 'Reading and Writing', 'Introduction to Philosophy'],
    isAdviser: true,
    advisorySection: 'HUMSS 11-Mabini'
  },
  {
    id: 'TCH003',
    name: 'Lisa Ramos',
    employeeId: 'EMP003',
    email: 'lisa.ramos@school.edu.ph',
    department: 'Science',
    assignedSections: ['STEM 11-Sampaguita', 'STEM 11-Santan', 'STEM 12-Gumamela'],
    assignedSubjects: ['General Chemistry', 'Earth and Life Science', 'Physical Science'],
    isAdviser: true,
    advisorySection: 'STEM 11-Santan'
  },
  {
    id: 'TCH004',
    name: 'Carlos Mendoza',
    employeeId: 'EMP004',
    email: 'carlos.mendoza@school.edu.ph',
    department: 'Science',
    assignedSections: ['STEM 11-Sampaguita', 'STEM 11-Santan', 'STEM 12-Gumamela'],
    assignedSubjects: ['General Biology', 'General Physics'],
    isAdviser: true,
    advisorySection: 'STEM 12-Gumamela'
  },
  {
    id: 'TCH005',
    name: 'Rosa Garcia',
    employeeId: 'EMP005',
    email: 'rosa.garcia@school.edu.ph',
    department: 'Filipino',
    assignedSections: ['HUMSS 11-Mabini', 'HUMSS 11-Rizal', 'STEM 11-Sampaguita'],
    assignedSubjects: ['Komunikasyon at Pananaliksik', 'Pagbasa at Pagsusuri', 'Creative Writing'],
    isAdviser: true,
    advisorySection: 'HUMSS 11-Rizal'
  },
  {
    id: 'TCH006',
    name: 'Mark Gonzales',
    employeeId: 'EMP006',
    email: 'mark.gonzales@school.edu.ph',
    department: 'Physical Education',
    assignedSections: ['All Sections'],
    assignedSubjects: ['Physical Education and Health 11', 'Physical Education and Health 12'],
    isAdviser: false,
    advisorySection: null
  },
  {
    id: 'TCH007',
    name: 'Patricia Lim',
    employeeId: 'EMP007',
    email: 'patricia.lim@school.edu.ph',
    department: 'Business',
    assignedSections: ['ABM 11-Aguinaldo', 'ABM 11-Jacinto', 'ABM 12-Gomez', 'ABM 12-Burgos'],
    assignedSubjects: ['Fundamentals of Accountancy', 'Business Management', 'Entrepreneurship'],
    isAdviser: true,
    advisorySection: 'ABM 11-Aguinaldo'
  },
  {
    id: 'TCH008',
    name: 'Roberto Aquino',
    employeeId: 'EMP008',
    email: 'roberto.aquino@school.edu.ph',
    department: 'Information Technology',
    assignedSections: ['ICT 11-Tesla', 'ICT 11-Gates', 'ICT 12-Jobs', 'ICT 12-Turing'],
    assignedSubjects: ['Computer Systems Servicing', 'Programming', 'Web Development', 'Computer Networking'],
    isAdviser: true,
    advisorySection: 'ICT 11-Tesla'
  },
  {
    id: 'TCH009',
    name: 'Angela Cruz',
    employeeId: 'EMP009',
    email: 'angela.cruz@school.edu.ph',
    department: 'Home Economics',
    assignedSections: ['HE 11-Orchid', 'HE 11-Jasmine', 'HE 12-Lily', 'HE 12-Rose'],
    assignedSubjects: ['Bread and Pastry Production', 'Cookery', 'Food and Beverage Services', 'Housekeeping'],
    isAdviser: true,
    advisorySection: 'HE 11-Orchid'
  },
  {
    id: 'TCH010',
    name: 'Fernando Santos',
    employeeId: 'EMP010',
    email: 'fernando.santos@school.edu.ph',
    department: 'Industrial Arts',
    assignedSections: ['IA 11-Mactan', 'IA 11-Calamba', 'IA 12-Taal', 'IA 12-Mayon'],
    assignedSubjects: ['Welding', 'Carpentry', 'Plumbing', 'Electrical Installation'],
    isAdviser: true,
    advisorySection: 'IA 11-Mactan'
  }
];

// Complete Student Document Records (HUMSS and TVL strands only)
export const mockStudentDocumentsComplete = [
  // HUMSS Students
  { id: 'SDOC005', studentId: 'STU005', studentName: 'Gabriel Martinez', lrn: '123456789039', section: 'HUMSS 12-Bonifacio', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Available' },
  { id: 'SDOC006', studentId: 'STU006', studentName: 'Lucia Gutierrez', lrn: '123456789040', section: 'HUMSS 12-Luna', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Missing' },
  { id: 'SDOC007', studentId: 'STU007', studentName: 'Christian Perez', lrn: '123456789041', section: 'HUMSS 11-Mabini', gradeLevel: '11', form137: 'Missing', form138: 'Available', goodMoral: 'Available' },
  { id: 'SDOC020', studentId: 'STU020', studentName: 'Isabella Santos', lrn: '123456789042', section: 'HUMSS 12-Bonifacio', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Available' },
  { id: 'SDOC021', studentId: 'STU021', studentName: 'Marco Reyes', lrn: '123456789043', section: 'HUMSS 11-Mabini', gradeLevel: '11', form137: 'Available', form138: 'Missing', goodMoral: 'Available' },
  
  // TVL-ICT Students
  { id: 'SDOC011', studentId: 'STU011', studentName: 'Kevin Lopez', lrn: '123456789101', section: 'ICT 12-Jobs', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Available' },
  { id: 'SDOC012', studentId: 'STU012', studentName: 'Jasmine Reyes', lrn: '123456789102', section: 'ICT 12-Turing', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Available' },
  { id: 'SDOC013', studentId: 'STU013', studentName: 'Brandon Cruz', lrn: '123456789103', section: 'ICT 11-Tesla', gradeLevel: '11', form137: 'Missing', form138: 'Available', goodMoral: 'Available' },
  
  // TVL-HE Students
  { id: 'SDOC014', studentId: 'STU014', studentName: 'Sofia Mendoza', lrn: '123456789201', section: 'HE 12-Lily', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Available' },
  { id: 'SDOC015', studentId: 'STU015', studentName: 'Andrea Santos', lrn: '123456789202', section: 'HE 12-Rose', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Missing' },
  { id: 'SDOC016', studentId: 'STU016', studentName: 'Theresa Garcia', lrn: '123456789203', section: 'HE 11-Orchid', gradeLevel: '11', form137: 'Available', form138: 'Missing', goodMoral: 'Available' },
  
  // TVL-IA Students
  { id: 'SDOC017', studentId: 'STU017', studentName: 'Miguel Torres', lrn: '123456789301', section: 'IA 12-Taal', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Available' },
  { id: 'SDOC018', studentId: 'STU018', studentName: 'Ramon Diaz', lrn: '123456789302', section: 'IA 12-Mayon', gradeLevel: '12', form137: 'Available', form138: 'Available', goodMoral: 'Available' },
  { id: 'SDOC019', studentId: 'STU019', studentName: 'Eduardo Ramos', lrn: '123456789303', section: 'IA 11-Mactan', gradeLevel: '11', form137: 'Available', form138: 'Available', goodMoral: 'Missing' }
];

// Student Grades for Academic Reports (HUMSS and TVL strands only)
export const mockStudentGradesComplete = [
  // HUMSS 12-Bonifacio Students
  {
    studentId: 'STU005',
    studentName: 'Gabriel Martinez',
    lrn: '123456789039',
    strand: 'HUMSS',
    section: 'HUMSS 12-Bonifacio',
    gradeLevel: '12',
    gender: 'Male',
    subjects: [
      { subject: 'Statistics and Probability', q1: 85, q2: 86, q3: 87, q4: 88, final: 86.5, status: 'Passed' },
      { subject: 'Reading and Writing', q1: 90, q2: 91, q3: 89, q4: 90, final: 90, status: 'Passed' },
      { subject: 'Creative Writing', q1: 92, q2: 93, q3: 91, q4: 92, final: 92, status: 'Passed' },
      { subject: 'Disciplines and Ideas in Social Sciences', q1: 88, q2: 89, q3: 87, q4: 88, final: 88, status: 'Passed' },
      { subject: 'Physical Education and Health 12', q1: 90, q2: 91, q3: 89, q4: 90, final: 90, status: 'Passed' }
    ],
    overallAverage: 89.3
  },
  {
    studentId: 'STU006',
    studentName: 'Lucia Gutierrez',
    lrn: '123456789040',
    strand: 'HUMSS',
    section: 'HUMSS 12-Luna',
    gradeLevel: '12',
    gender: 'Female',
    subjects: [
      { subject: 'Statistics and Probability', q1: 88, q2: 89, q3: 87, q4: 88, final: 88, status: 'Passed' },
      { subject: 'Reading and Writing', q1: 93, q2: 94, q3: 92, q4: 93, final: 93, status: 'Passed' },
      { subject: 'Creative Writing', q1: 95, q2: 96, q3: 94, q4: 95, final: 95, status: 'Passed' },
      { subject: 'Physical Education and Health 12', q1: 92, q2: 93, q3: 91, q4: 92, final: 92, status: 'Passed' }
    ],
    overallAverage: 92
  },
  
  // TVL-ICT 12-Jobs Students
  {
    studentId: 'STU011',
    studentName: 'Kevin Lopez',
    lrn: '123456789101',
    strand: 'ICT',
    section: 'ICT 12-Jobs',
    gradeLevel: '12',
    gender: 'Male',
    subjects: [
      { subject: 'Statistics and Probability', q1: 86, q2: 87, q3: 88, q4: 89, final: 87.5, status: 'Passed' },
      { subject: 'Web Development', q1: 94, q2: 95, q3: 93, q4: 94, final: 94, status: 'Passed' },
      { subject: 'Computer Networking', q1: 92, q2: 93, q3: 91, q4: 92, final: 92, status: 'Passed' },
      { subject: 'Physical Education and Health 12', q1: 90, q2: 91, q3: 89, q4: 90, final: 90, status: 'Passed' }
    ],
    overallAverage: 90.875
  },
  {
    studentId: 'STU012',
    studentName: 'Jasmine Reyes',
    lrn: '123456789102',
    strand: 'ICT',
    section: 'ICT 12-Turing',
    gradeLevel: '12',
    gender: 'Female',
    subjects: [
      { subject: 'Statistics and Probability', q1: 88, q2: 89, q3: 90, q4: 91, final: 89.5, status: 'Passed' },
      { subject: 'Web Development', q1: 96, q2: 97, q3: 95, q4: 96, final: 96, status: 'Passed' },
      { subject: 'Computer Networking', q1: 94, q2: 95, q3: 93, q4: 94, final: 94, status: 'Passed' },
      { subject: 'Physical Education and Health 12', q1: 92, q2: 93, q3: 91, q4: 92, final: 92, status: 'Passed' }
    ],
    overallAverage: 92.875
  },
  
  // TVL-HE 12-Lily Students
  {
    studentId: 'STU014',
    studentName: 'Sofia Mendoza',
    lrn: '123456789201',
    strand: 'HE',
    section: 'HE 12-Lily',
    gradeLevel: '12',
    gender: 'Female',
    subjects: [
      { subject: 'Statistics and Probability', q1: 85, q2: 86, q3: 87, q4: 88, final: 86.5, status: 'Passed' },
      { subject: 'Food and Beverage Services', q1: 93, q2: 94, q3: 92, q4: 93, final: 93, status: 'Passed' },
      { subject: 'Housekeeping', q1: 91, q2: 92, q3: 90, q4: 91, final: 91, status: 'Passed' },
      { subject: 'Physical Education and Health 12', q1: 89, q2: 90, q3: 88, q4: 89, final: 89, status: 'Passed' }
    ],
    overallAverage: 89.875
  },
  {
    studentId: 'STU015',
    studentName: 'Andrea Santos',
    lrn: '123456789202',
    strand: 'HE',
    section: 'HE 12-Rose',
    gradeLevel: '12',
    gender: 'Female',
    subjects: [
      { subject: 'Statistics and Probability', q1: 87, q2: 88, q3: 89, q4: 90, final: 88.5, status: 'Passed' },
      { subject: 'Food and Beverage Services', q1: 95, q2: 96, q3: 94, q4: 95, final: 95, status: 'Passed' },
      { subject: 'Housekeeping', q1: 93, q2: 94, q3: 92, q4: 93, final: 93, status: 'Passed' },
      { subject: 'Physical Education and Health 12', q1: 91, q2: 92, q3: 90, q4: 91, final: 91, status: 'Passed' }
    ],
    overallAverage: 91.875
  },
  
  // TVL-IA 12-Taal Students
  {
    studentId: 'STU017',
    studentName: 'Miguel Torres',
    lrn: '123456789301',
    strand: 'IA',
    section: 'IA 12-Taal',
    gradeLevel: '12',
    gender: 'Male',
    subjects: [
      { subject: 'Statistics and Probability', q1: 83, q2: 84, q3: 85, q4: 86, final: 84.5, status: 'Passed' },
      { subject: 'Plumbing', q1: 90, q2: 91, q3: 89, q4: 90, final: 90, status: 'Passed' },
      { subject: 'Electrical Installation', q1: 92, q2: 93, q3: 91, q4: 92, final: 92, status: 'Passed' },
      { subject: 'Physical Education and Health 12', q1: 88, q2: 89, q3: 87, q4: 88, final: 88, status: 'Passed' }
    ],
    overallAverage: 88.625
  },
  {
    studentId: 'STU018',
    studentName: 'Ramon Diaz',
    lrn: '123456789302',
    strand: 'IA',
    section: 'IA 12-Mayon',
    gradeLevel: '12',
    gender: 'Male',
    subjects: [
      { subject: 'Statistics and Probability', q1: 80, q2: 81, q3: 82, q4: 83, final: 81.5, status: 'Passed' },
      { subject: 'Plumbing', q1: 88, q2: 89, q3: 87, q4: 88, final: 88, status: 'Passed' },
      { subject: 'Electrical Installation', q1: 90, q2: 91, q3: 89, q4: 90, final: 90, status: 'Passed' },
      { subject: 'Physical Education and Health 12', q1: 86, q2: 87, q3: 85, q4: 86, final: 86, status: 'Passed' }
    ],
    overallAverage: 86.375
  }
];

// Export for easy integration
export const completeStrandData = {
  strands: mockStrandsComplete,
  sections: mockSectionsComplete,
  teachers: mockTeachersComplete,
  studentDocuments: mockStudentDocumentsComplete,
  studentGrades: mockStudentGradesComplete
};