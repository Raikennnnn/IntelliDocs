import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Input } from '../../components/ui/input';
import { mockStrands } from '../../data/mockData';
import { mockTeacherGrades } from '../../data/teacherMockData';
import { Save, Calculator, Users, Search, ArrowUp, Eye, EyeOff, AlertTriangle, ShieldAlert, ChevronDown, ChevronRight, Plus, BookOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type GradeStatus = 'Draft' | 'Submitted' | 'Locked';

interface Assessment {
  id: string;
  name: string;
  rawScore: number;
  totalScore: number;
}

interface StudentAssessments {
  writtenWorks: Assessment[];
  performanceTasks: Assessment[];
  quarterlyAssessments: Assessment[];
}

// Initialize default assessments for a student
const initializeAssessments = (studentId: string): StudentAssessments => ({
  writtenWorks: [
    { id: `${studentId}-ww-1`, name: 'Quiz 1', rawScore: 10, totalScore: 10 },
    { id: `${studentId}-ww-2`, name: 'Quiz 2', rawScore: 5, totalScore: 10 },
    { id: `${studentId}-ww-3`, name: 'Assignment', rawScore: 18, totalScore: 20 },
  ],
  performanceTasks: [
    { id: `${studentId}-pt-1`, name: 'Project 1', rawScore: 45, totalScore: 50 },
    { id: `${studentId}-pt-2`, name: 'Activity 1', rawScore: 20, totalScore: 25 },
  ],
  quarterlyAssessments: [
    { id: `${studentId}-qa-1`, name: 'Quarterly Exam', rawScore: 44, totalScore: 50 },
  ],
});

// Transmutation table for converting initial grade to quarterly grade
const transmuteGrade = (initialGrade: number): number => {
  // For simplicity, we're using a 1:1 transmutation
  // In actual DepEd, there's a transmutation table
  return Math.round(initialGrade);
};

export function TeacherGradeManagement() {
  const [selectedStrand, setSelectedStrand] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('General Mathematics');
  const [selectedSemester, setSelectedSemester] = useState<'1st' | '2nd'>('1st');
  const [selectedQuarter, setSelectedQuarter] = useState<'1st Quarter' | '2nd Quarter'>('1st Quarter');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [gradeStatus, setGradeStatus] = useState<GradeStatus>('Draft');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [studentAssessments, setStudentAssessments] = useState<Record<string, StudentAssessments>>({});

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveGrades = () => {
    toast.success('Grades saved successfully!');
  };

  const handleSubmitGrades = () => {
    toast.success('Grades submitted for approval!');
    setGradeStatus('Submitted');
  };

  // Get available sections for selected strand
  const getAvailableSections = () => {
    if (!selectedStrand) return [];
    const strand = mockStrands.find(s => s.name === selectedStrand);
    return strand?.sections || [];
  };

  // Get assessments for a student
  const getStudentAssessments = (studentId: string): StudentAssessments => {
    if (!studentAssessments[studentId]) {
      const initialized = initializeAssessments(studentId);
      setStudentAssessments(prev => ({ ...prev, [studentId]: initialized }));
      return initialized;
    }
    return studentAssessments[studentId];
  };

  // Calculate percentage score for a category
  const calculatePercentage = (assessments: Assessment[]): number => {
    if (assessments.length === 0) return 0;
    const totalRaw = assessments.reduce((sum, a) => sum + a.rawScore, 0);
    const totalMax = assessments.reduce((sum, a) => sum + a.totalScore, 0);
    return totalMax > 0 ? (totalRaw / totalMax) * 100 : 0;
  };

  // Calculate weighted score
  const calculateWeightedScore = (percentage: number, weight: number): number => {
    return (percentage * weight) / 100;
  };

  // Calculate final grade for a student
  const calculateFinalGrade = (studentId: string) => {
    const assessments = getStudentAssessments(studentId);
    
    const wwPercentage = calculatePercentage(assessments.writtenWorks);
    const ptPercentage = calculatePercentage(assessments.performanceTasks);
    const qaPercentage = calculatePercentage(assessments.quarterlyAssessments);
    
    const wwWeighted = calculateWeightedScore(wwPercentage, 25);
    const ptWeighted = calculateWeightedScore(ptPercentage, 50);
    const qaWeighted = calculateWeightedScore(qaPercentage, 25);
    
    const initialGrade = wwWeighted + ptWeighted + qaWeighted;
    const quarterlyGrade = transmuteGrade(initialGrade);
    
    return {
      wwPercentage,
      ptPercentage,
      qaPercentage,
      wwWeighted,
      ptWeighted,
      qaWeighted,
      initialGrade,
      quarterlyGrade,
    };
  };

  // Toggle student expansion
  const toggleStudentExpansion = (studentId: string) => {
    if (expandedStudent === studentId) {
      setExpandedStudent(null);
    } else {
      setExpandedStudent(studentId);
      // Initialize assessments if not already done
      if (!studentAssessments[studentId]) {
        setStudentAssessments(prev => ({
          ...prev,
          [studentId]: initializeAssessments(studentId),
        }));
      }
    }
  };

  // Add assessment
  const addAssessment = (studentId: string, category: 'writtenWorks' | 'performanceTasks' | 'quarterlyAssessments') => {
    const categoryNames = {
      writtenWorks: 'New Assessment',
      performanceTasks: 'New Task',
      quarterlyAssessments: 'New Exam',
    };
    
    const newAssessment: Assessment = {
      id: `${studentId}-${category}-${Date.now()}`,
      name: categoryNames[category],
      rawScore: 0,
      totalScore: 10,
    };
    
    setStudentAssessments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [category]: [...(prev[studentId]?.[category] || []), newAssessment],
      },
    }));
    
    toast.success('Assessment added');
  };

  // Update assessment score
  const updateAssessmentScore = (
    studentId: string,
    category: 'writtenWorks' | 'performanceTasks' | 'quarterlyAssessments',
    assessmentId: string,
    field: 'rawScore' | 'totalScore',
    value: number
  ) => {
    setStudentAssessments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [category]: prev[studentId][category].map(a =>
          a.id === assessmentId ? { ...a, [field]: value } : a
        ),
      },
    }));
  };

  // Update assessment name
  const updateAssessmentName = (
    studentId: string,
    category: 'writtenWorks' | 'performanceTasks' | 'quarterlyAssessments',
    assessmentId: string,
    name: string
  ) => {
    setStudentAssessments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [category]: prev[studentId][category].map(a =>
          a.id === assessmentId ? { ...a, name } : a
        ),
      },
    }));
  };

  // Delete assessment
  const deleteAssessment = (
    studentId: string,
    category: 'writtenWorks' | 'performanceTasks' | 'quarterlyAssessments',
    assessmentId: string
  ) => {
    setStudentAssessments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [category]: prev[studentId][category].filter(a => a.id !== assessmentId),
      },
    }));
    toast.success('Assessment deleted');
  };

  // Get grades for selected section and subject
  const getSectionGrades = () => {
    if (!selectedStrand || !selectedSection) return { male: [], female: [] };
    const sectionKey = `${selectedStrand}-${selectedSection}`;
    const sectionData = mockTeacherGrades[sectionKey as keyof typeof mockTeacherGrades];
    if (!sectionData) return { male: [], female: [] };
    const subjectData = sectionData[selectedSubject as keyof typeof sectionData];
    return subjectData || { male: [], female: [] };
  };

  const grades = getSectionGrades();
  
  // Filter students based on search
  const filterStudents = (students: any[]) => {
    if (!searchQuery) return students;
    return students.filter(student => 
      student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.lrn.includes(searchQuery)
    );
  };

  const filteredMaleGrades = filterStudents(grades.male);
  const filteredFemaleGrades = filterStudents(grades.female);
  const totalStudents = grades.male.length + grades.female.length;
  const filteredTotal = filteredMaleGrades.length + filteredFemaleGrades.length;

  // Render expandable student row
  const renderStudentRow = (student: any, index: number, gender: 'male' | 'female') => {
    const isExpanded = expandedStudent === student.studentId;
    const gradeData = calculateFinalGrade(student.studentId);
    const assessments = getStudentAssessments(student.studentId);
    const bgColor = gender === 'male' ? 'blue' : 'pink';

    const rows = [
      <tr
        key={`${student.studentId}-main`}
        onClick={() => toggleStudentExpansion(student.studentId)}
        className={`cursor-pointer hover:bg-${bgColor}-50 transition-colors ${isExpanded ? `bg-${bgColor}-100` : ''}`}
      >
        <td className={`p-3 border border-gray-300 text-center font-semibold text-gray-600 bg-${bgColor}-50`}>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 mx-auto" />
          ) : (
            <ChevronRight className="w-5 h-5 mx-auto" />
          )}
        </td>
        <td className="p-3 border border-gray-300 text-center font-semibold text-gray-600">
          {index + 1}
        </td>
        <td className="p-3 border border-gray-300 font-medium">
          {student.studentName}
        </td>
        <td className="p-3 border border-gray-300 text-center text-xs text-gray-600">
          {student.lrn}
        </td>
        <td className="p-3 border border-gray-300 text-center bg-blue-50/30">
          <span className="font-semibold">{gradeData.wwPercentage.toFixed(1)}%</span>
        </td>
        <td className="p-3 border border-gray-300 text-center bg-green-50/30">
          <span className="font-semibold">{gradeData.ptPercentage.toFixed(1)}%</span>
        </td>
        <td className="p-3 border border-gray-300 text-center bg-orange-50/30">
          <span className="font-semibold">{gradeData.qaPercentage.toFixed(1)}%</span>
        </td>
        <td className="p-3 border border-gray-300 text-center bg-yellow-50/50">
          <div className="flex items-center justify-center gap-1">
            <Calculator className="w-3 h-3 text-gray-500" />
            <span className="font-semibold text-base">{gradeData.initialGrade.toFixed(2)}</span>
          </div>
        </td>
        <td className="p-3 border border-gray-300 text-center bg-purple-50/50">
          <Badge 
            variant={gradeData.quarterlyGrade >= 75 ? 'default' : 'destructive'}
            className={`${gradeData.quarterlyGrade >= 75 ? 'bg-[#2D5016]' : ''} text-base px-3 py-1`}
          >
            {gradeData.quarterlyGrade}
          </Badge>
          <div className="text-xs text-gray-600 mt-1">
            {gradeData.quarterlyGrade >= 75 ? 'Passed' : 'Failed'}
          </div>
        </td>
      </tr>
    ];

    if (isExpanded) {
      rows.push(
        <tr key={`${student.studentId}-expanded`}>
          <td colSpan={9} className="p-0 border border-gray-300 bg-gray-50">
            <div className="p-6 space-y-6">
              {/* Three Category Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Written Works */}
                <Card className="border-2 border-blue-200">
                  <CardHeader className="pb-2 bg-blue-50">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>WRITTEN WORKS</span>
                      <Badge variant="outline" className="bg-blue-100 text-xs">25%</Badge>
                    </CardTitle>
                    <div className="text-xs text-gray-600 mt-1">
                      <div className="font-semibold text-[#8B1538]">Score: {gradeData.wwPercentage.toFixed(1)}%</div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 pb-3">
                    <div className="overflow-auto max-h-[300px]">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="p-1 text-left border">Assessment</th>
                            <th className="p-1 text-center border w-16">Score</th>
                            <th className="p-1 text-center border w-16">Total</th>
                            <th className="p-1 text-center border w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessments.writtenWorks.map((assessment) => (
                            <tr key={assessment.id} className="border-b">
                              <td className="p-1 border">
                                <Input
                                  type="text"
                                  value={assessment.name}
                                  onChange={(e) => updateAssessmentName(student.studentId, 'writtenWorks', assessment.id, e.target.value)}
                                  className="h-7 text-xs border-0 focus:ring-1 focus:ring-blue-400"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border">
                                <Input
                                  type="number"
                                  value={assessment.rawScore}
                                  onChange={(e) => updateAssessmentScore(student.studentId, 'writtenWorks', assessment.id, 'rawScore', Number(e.target.value))}
                                  className="h-7 text-xs text-center border-0 focus:ring-1 focus:ring-blue-400"
                                  min="0"
                                  max={assessment.totalScore}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border">
                                <Input
                                  type="number"
                                  value={assessment.totalScore}
                                  onChange={(e) => updateAssessmentScore(student.studentId, 'writtenWorks', assessment.id, 'totalScore', Number(e.target.value))}
                                  className="h-7 text-xs text-center border-0 focus:ring-1 focus:ring-blue-400"
                                  min="1"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteAssessment(student.studentId, 'writtenWorks', assessment.id);
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        addAssessment(student.studentId, 'writtenWorks');
                      }}
                      className="w-full mt-2 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </CardContent>
                </Card>

                {/* Performance Task */}
                <Card className="border-2 border-green-200">
                  <CardHeader className="pb-2 bg-green-50">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>PERFORMANCE TASK</span>
                      <Badge variant="outline" className="bg-green-100 text-xs">50%</Badge>
                    </CardTitle>
                    <div className="text-xs text-gray-600 mt-1">
                      <div className="font-semibold text-[#8B1538]">Score: {gradeData.ptPercentage.toFixed(1)}%</div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 pb-3">
                    <div className="overflow-auto max-h-[300px]">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="p-1 text-left border">Assessment</th>
                            <th className="p-1 text-center border w-16">Score</th>
                            <th className="p-1 text-center border w-16">Total</th>
                            <th className="p-1 text-center border w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessments.performanceTasks.map((assessment) => (
                            <tr key={assessment.id} className="border-b">
                              <td className="p-1 border">
                                <Input
                                  type="text"
                                  value={assessment.name}
                                  onChange={(e) => updateAssessmentName(student.studentId, 'performanceTasks', assessment.id, e.target.value)}
                                  className="h-7 text-xs border-0 focus:ring-1 focus:ring-green-400"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border">
                                <Input
                                  type="number"
                                  value={assessment.rawScore}
                                  onChange={(e) => updateAssessmentScore(student.studentId, 'performanceTasks', assessment.id, 'rawScore', Number(e.target.value))}
                                  className="h-7 text-xs text-center border-0 focus:ring-1 focus:ring-green-400"
                                  min="0"
                                  max={assessment.totalScore}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border">
                                <Input
                                  type="number"
                                  value={assessment.totalScore}
                                  onChange={(e) => updateAssessmentScore(student.studentId, 'performanceTasks', assessment.id, 'totalScore', Number(e.target.value))}
                                  className="h-7 text-xs text-center border-0 focus:ring-1 focus:ring-green-400"
                                  min="1"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteAssessment(student.studentId, 'performanceTasks', assessment.id);
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        addAssessment(student.studentId, 'performanceTasks');
                      }}
                      className="w-full mt-2 h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </CardContent>
                </Card>

                {/* Quarterly Assessment */}
                <Card className="border-2 border-orange-200">
                  <CardHeader className="pb-2 bg-orange-50">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>QUARTERLY ASSESSMENT</span>
                      <Badge variant="outline" className="bg-orange-100 text-xs">25%</Badge>
                    </CardTitle>
                    <div className="text-xs text-gray-600 mt-1">
                      <div className="font-semibold text-[#8B1538]">Score: {gradeData.qaPercentage.toFixed(1)}%</div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 pb-3">
                    <div className="overflow-auto max-h-[300px]">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="p-1 text-left border">Assessment</th>
                            <th className="p-1 text-center border w-16">Score</th>
                            <th className="p-1 text-center border w-16">Total</th>
                            <th className="p-1 text-center border w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessments.quarterlyAssessments.map((assessment) => (
                            <tr key={assessment.id} className="border-b">
                              <td className="p-1 border">
                                <Input
                                  type="text"
                                  value={assessment.name}
                                  onChange={(e) => updateAssessmentName(student.studentId, 'quarterlyAssessments', assessment.id, e.target.value)}
                                  className="h-7 text-xs border-0 focus:ring-1 focus:ring-orange-400"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border">
                                <Input
                                  type="number"
                                  value={assessment.rawScore}
                                  onChange={(e) => updateAssessmentScore(student.studentId, 'quarterlyAssessments', assessment.id, 'rawScore', Number(e.target.value))}
                                  className="h-7 text-xs text-center border-0 focus:ring-1 focus:ring-orange-400"
                                  min="0"
                                  max={assessment.totalScore}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border">
                                <Input
                                  type="number"
                                  value={assessment.totalScore}
                                  onChange={(e) => updateAssessmentScore(student.studentId, 'quarterlyAssessments', assessment.id, 'totalScore', Number(e.target.value))}
                                  className="h-7 text-xs text-center border-0 focus:ring-1 focus:ring-orange-400"
                                  min="1"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="p-1 border text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteAssessment(student.studentId, 'quarterlyAssessments', assessment.id);
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        addAssessment(student.studentId, 'quarterlyAssessments');
                      }}
                      className="w-full mt-2 h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </td>
        </tr>
      );
    }

    return rows;
  };

  return (
    <div className="space-y-6" ref={topRef}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Grade Management</h2>
        <p className="text-gray-600">DepEd grading format organized by gender per section</p>
      </div>

      {/* Grade Status Alert */}
      {gradeStatus !== 'Draft' && (
        <Alert className={gradeStatus === 'Locked' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}>
          {gradeStatus === 'Locked' ? (
            <>
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-900">
                <strong>Grades Locked:</strong> These grades are locked and cannot be modified without Admin approval. Any unauthorized modification attempts will be logged in the Security Monitoring system.
              </AlertDescription>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Grades Submitted:</strong> Grades have been submitted for approval. Click "Lock" to finalize and prevent further modifications.
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      {/* Selection Filters - Dropdown Style */}
      <Card>
        <CardHeader>
          <CardTitle>Select Section & Configuration</CardTitle>
          <CardDescription>Choose strand, section, and grading parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Row 1: Strand and Section Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strand Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Strand</label>
                <Select 
                  value={selectedStrand || ''} 
                  onValueChange={(val) => {
                    setSelectedStrand(val);
                    setSelectedSection(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Strand" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockStrands.map((strand) => (
                      <SelectItem key={strand.name} value={strand.name}>
                        {strand.name} - {strand.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Section Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <Select 
                  value={selectedSection || ''} 
                  onValueChange={setSelectedSection}
                  disabled={!selectedStrand}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedStrand ? "Select Section" : "Select Strand first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableSections().map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Grading Configuration (Only show when strand and section are selected) */}
            {selectedStrand && selectedSection && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
                {/* Semester */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                  <Select value={selectedSemester} onValueChange={(val) => setSelectedSemester(val as '1st' | '2nd')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st">1ST</SelectItem>
                      <SelectItem value="2nd">2ND</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Quarter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quarter</label>
                  <Select value={selectedQuarter} onValueChange={(val) => setSelectedQuarter(val as '1st Quarter' | '2nd Quarter')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st Quarter">1st Quarter</SelectItem>
                      <SelectItem value="2nd Quarter">2nd Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General Mathematics">General Mathematics</SelectItem>
                      <SelectItem value="Statistics and Probability">Statistics and Probability</SelectItem>
                      <SelectItem value="English">English for Academic Purposes</SelectItem>
                      <SelectItem value="Filipino">Komunikasyon at Pananaliksik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Search Bar Row (Only show when strand and section are selected) */}
            {selectedStrand && selectedSection && totalStudents > 0 && (
              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="flex-1 max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Student</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by name or LRN..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1538]"
                    />
                  </div>
                </div>
                
                <div className="flex items-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery('')}
                    disabled={!searchQuery}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation & Action Controls */}
      {selectedStrand && selectedSection && totalStudents > 0 && (
        <Card className="sticky top-0 z-10 bg-white shadow-md">
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Gender Selection Tabs */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2">View Students:</span>
                <Button
                  variant={selectedGender === 'male' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedGender('male')}
                  className={selectedGender === 'male' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Male Students ({grades.male.length})
                </Button>
                <Button
                  variant={selectedGender === 'female' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedGender('female')}
                  className={selectedGender === 'female' ? 'bg-pink-600 hover:bg-pink-700' : 'border-pink-300 text-pink-700 hover:bg-pink-50'}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Female Students ({grades.female.length})
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleSaveGrades}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button 
                  size="sm"
                  onClick={handleSubmitGrades}
                  className="bg-[#8B1538] hover:bg-[#8B1538]/90"
                  disabled={gradeStatus !== 'Draft'}
                >
                  Submit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Male Students Section - Only show if male is selected */}
      {selectedStrand && selectedSection && selectedGender === 'male' && filteredMaleGrades.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Male Students - DepEd Grading Sheet
                </CardTitle>
                <CardDescription>
                  {selectedStrand} - {selectedSection} • {selectedSubject} • {selectedSemester} Semester, {selectedQuarter} 2026
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm bg-blue-50 border-blue-200">
                {filteredMaleGrades.length} Male Students
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-blue-50">
                  <tr className="border-b-2 border-gray-300">
                    <th className="p-2 text-center border border-gray-300 font-semibold min-w-[50px] bg-blue-100">
                      <Eye className="w-4 h-4 mx-auto" />
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold min-w-[50px] bg-blue-100">#</th>
                    <th className="p-2 text-left border border-gray-300 font-semibold min-w-[200px] bg-blue-50">Student Name</th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-blue-50 min-w-[120px]">LRN</th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-blue-100 min-w-[100px]">
                      WW<br/>
                      <span className="text-xs font-normal text-gray-600">(25%)</span>
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-green-100 min-w-[100px]">
                      PT<br/>
                      <span className="text-xs font-normal text-gray-600">(50%)</span>
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-orange-100 min-w-[100px]">
                      QA<br/>
                      <span className="text-xs font-normal text-gray-600">(25%)</span>
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-yellow-100 min-w-[110px]">
                      Initial<br/>Grade
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-purple-100 min-w-[110px]">
                      Quarterly<br/>Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaleGrades.map((student: any, index: number) => 
                    renderStudentRow(student, index, 'male')
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Female Students Section - Only show if female is selected */}
      {selectedStrand && selectedSection && selectedGender === 'female' && filteredFemaleGrades.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-pink-600" />
                  Female Students - DepEd Grading Sheet
                </CardTitle>
                <CardDescription>
                  {selectedStrand} - {selectedSection} • {selectedSubject} • {selectedSemester} Semester, {selectedQuarter} 2026
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm bg-pink-50 border-pink-200">
                {filteredFemaleGrades.length} Female Students
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-pink-50">
                  <tr className="border-b-2 border-gray-300">
                    <th className="p-2 text-center border border-gray-300 font-semibold min-w-[50px] bg-pink-100">
                      <Eye className="w-4 h-4 mx-auto" />
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold min-w-[50px] bg-pink-100">#</th>
                    <th className="p-2 text-left border border-gray-300 font-semibold min-w-[200px] bg-pink-50">Student Name</th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-pink-50 min-w-[120px]">LRN</th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-blue-100 min-w-[100px]">
                      WW<br/>
                      <span className="text-xs font-normal text-gray-600">(25%)</span>
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-green-100 min-w-[100px]">
                      PT<br/>
                      <span className="text-xs font-normal text-gray-600">(50%)</span>
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-orange-100 min-w-[100px]">
                      QA<br/>
                      <span className="text-xs font-normal text-gray-600">(25%)</span>
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-yellow-100 min-w-[110px]">
                      Initial<br/>Grade
                    </th>
                    <th className="p-2 text-center border border-gray-300 font-semibold bg-purple-100 min-w-[110px]">
                      Quarterly<br/>Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFemaleGrades.map((student: any, index: number) => 
                    renderStudentRow(student, index, 'female')
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grading Legend */}
      {selectedStrand && selectedSection && totalStudents > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#8B1538]" />
              DepEd Grading System Formula
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                <div className="flex justify-between p-3 bg-blue-50 rounded border border-blue-200">
                  <span className="font-medium text-gray-700">Written Work (WW):</span>
                  <span className="font-bold text-[#8B1538]">25%</span>
                </div>
                <div className="flex justify-between p-3 bg-green-50 rounded border border-green-200">
                  <span className="font-medium text-gray-700">Performance Task (PT):</span>
                  <span className="font-bold text-[#8B1538]">50%</span>
                </div>
                <div className="flex justify-between p-3 bg-orange-50 rounded border border-orange-200">
                  <span className="font-medium text-gray-700">Quarterly Assessment (QA):</span>
                  <span className="font-bold text-[#8B1538]">25%</span>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-300">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Formula:</strong> Initial Grade = (WW × 0.25) + (PT × 0.50) + (QA × 0.25)
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Passing Grade:</strong> 75 or above • Click any student row to expand and view detailed assessment breakdown
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {selectedStrand && selectedSection && totalStudents === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">No grades found for this section and subject</p>
            <p className="text-sm text-gray-500 mt-1">Please select a different section or subject</p>
          </CardContent>
        </Card>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 p-3 bg-[#8B1538] text-white rounded-full shadow-lg hover:bg-[#8B1538]/90 transition-all z-50"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}