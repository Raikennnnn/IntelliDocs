import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { mockStrands } from '../../data/mockData';
import { mockTeacherGrades } from '../../data/teacherMockData';
import { Save, Lock, Plus, Download, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Assessment {
  id: string;
  highestScore: number;
}

interface StudentGrade {
  studentId: string;
  studentName: string;
  lrn: string;
  gender: 'male' | 'female';
  writtenWork: number[];
  performanceTask: number[];
  quarterlyAssessment: number[];
}

export function TeacherGradeManagementDepEd() {
  const [selectedStrand, setSelectedStrand] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('General Mathematics');
  const [selectedSemester, setSelectedSemester] = useState<'1st' | '2nd'>('1st');
  const [selectedQuarter, setSelectedQuarter] = useState<'First Quarter' | 'Second Quarter'>('First Quarter');
  
  // DepEd Header Fields - Now editable
  const [region, setRegion] = useState<string>('NCR');
  const [division, setDivision] = useState<string>('Marikina City');
  const [schoolName, setSchoolName] = useState<string>('Nuestra Señora De Guia Academy');
  const [schoolId, setSchoolId] = useState<string>('400000');
  const [schoolYear, setSchoolYear] = useState<string>('2025-2026');
  const [teacherName, setTeacherName] = useState<string>('');
  
  // Assessment configuration
  const [wwAssessments, setWwAssessments] = useState<Assessment[]>([
    { id: 'ww1', highestScore: 10 },
    { id: 'ww2', highestScore: 10 },
    { id: 'ww3', highestScore: 10 },
  ]);
  const [ptAssessments, setPtAssessments] = useState<Assessment[]>([
    { id: 'pt1', highestScore: 50 },
    { id: 'pt2', highestScore: 50 },
  ]);
  const [qaAssessments, setQaAssessments] = useState<Assessment[]>([
    { id: 'qa1', highestScore: 50 },
  ]);

  const [isLocked, setIsLocked] = useState(false);
  
  // Gender filter state
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  // Mock student grades
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([
    {
      studentId: '1',
      studentName: 'DELA CRUZ, JUAN A.',
      lrn: '123456789012',
      gender: 'male',
      writtenWork: [8, 9, 7],
      performanceTask: [45, 48],
      quarterlyAssessment: [44],
    },
    {
      studentId: '2',
      studentName: 'SANTOS, MARIA B.',
      lrn: '123456789013',
      gender: 'female',
      writtenWork: [10, 8, 9],
      performanceTask: [50, 46],
      quarterlyAssessment: [48],
    },
    {
      studentId: '3',
      studentName: 'REYES, PEDRO C.',
      lrn: '123456789014',
      gender: 'male',
      writtenWork: [7, 6, 8],
      performanceTask: [40, 42],
      quarterlyAssessment: [40],
    },
    {
      studentId: '4',
      studentName: 'GARCIA, ANA C.',
      lrn: '123456789015',
      gender: 'female',
      writtenWork: [9, 10, 8],
      performanceTask: [48, 49],
      quarterlyAssessment: [46],
    },
    {
      studentId: '5',
      studentName: 'LOPEZ, CARLOS D.',
      lrn: '123456789016',
      gender: 'male',
      writtenWork: [6, 7, 7],
      performanceTask: [38, 40],
      quarterlyAssessment: [42],
    },
  ]);

  // Filter students by gender
  const filteredStudents = studentGrades.filter(student => {
    if (genderFilter === 'all') return true;
    return student.gender === genderFilter;
  });

  const maleCount = studentGrades.filter(s => s.gender === 'male').length;
  const femaleCount = studentGrades.filter(s => s.gender === 'female').length;

  const getAvailableSections = () => {
    if (!selectedStrand) return [];
    const strand = mockStrands.find(s => s.name === selectedStrand);
    return strand?.sections || [];
  };

  const calculateTotal = (scores: number[]): number => {
    return scores.reduce((sum, score) => sum + score, 0);
  };

  const calculatePS = (total: number, highestScores: number[]): number => {
    const highestTotal = highestScores.reduce((sum, score) => sum + score, 0);
    return highestTotal > 0 ? (total / highestTotal) * 100 : 0;
  };

  const calculateWeighted = (ps: number, weight: number): number => {
    return (ps * weight) / 100;
  };

  const calculateInitialGrade = (studentIndex: number): number => {
    const student = studentGrades[studentIndex];
    const wwTotal = calculateTotal(student.writtenWork);
    const ptTotal = calculateTotal(student.performanceTask);
    const qaTotal = calculateTotal(student.quarterlyAssessment);

    const wwPS = calculatePS(wwTotal, wwAssessments.map(a => a.highestScore));
    const ptPS = calculatePS(ptTotal, ptAssessments.map(a => a.highestScore));
    const qaPS = calculatePS(qaTotal, qaAssessments.map(a => a.highestScore));

    const wwWeighted = calculateWeighted(wwPS, 25);
    const ptWeighted = calculateWeighted(ptPS, 50);
    const qaWeighted = calculateWeighted(qaPS, 25);

    return wwWeighted + ptWeighted + qaWeighted;
  };

  const calculateQuarterlyGrade = (initialGrade: number): number => {
    return Math.round(initialGrade);
  };

  const updateStudentScore = (studentIndex: number, category: 'writtenWork' | 'performanceTask' | 'quarterlyAssessment', assessmentIndex: number, value: number) => {
    if (isLocked) {
      toast.error('Grades are locked and cannot be modified');
      return;
    }

    const newGrades = [...studentGrades];
    newGrades[studentIndex][category][assessmentIndex] = value;
    setStudentGrades(newGrades);
  };

  const addAssessment = (category: 'ww' | 'pt' | 'qa') => {
    if (isLocked) {
      toast.error('Grades are locked. Cannot add assessments');
      return;
    }

    if (category === 'ww') {
      const newAssessment: Assessment = { id: `ww${wwAssessments.length + 1}`, highestScore: 10 };
      setWwAssessments([...wwAssessments, newAssessment]);
      // Add score slot for all students
      setStudentGrades(studentGrades.map(s => ({ ...s, writtenWork: [...s.writtenWork, 0] })));
      toast.success('Written Work assessment added');
    } else if (category === 'pt') {
      const newAssessment: Assessment = { id: `pt${ptAssessments.length + 1}`, highestScore: 50 };
      setPtAssessments([...ptAssessments, newAssessment]);
      setStudentGrades(studentGrades.map(s => ({ ...s, performanceTask: [...s.performanceTask, 0] })));
      toast.success('Performance Task assessment added');
    } else if (category === 'qa') {
      const newAssessment: Assessment = { id: `qa${qaAssessments.length + 1}`, highestScore: 50 };
      setQaAssessments([...qaAssessments, newAssessment]);
      setStudentGrades(studentGrades.map(s => ({ ...s, quarterlyAssessment: [...s.quarterlyAssessment, 0] })));
      toast.success('Quarterly Assessment added');
    }
  };

  const handleSave = () => {
    toast.success('Grades saved successfully');
  };

  const handleLock = () => {
    setIsLocked(true);
    toast.success('Grades locked successfully');
  };

  const handleExport = () => {
    toast.success('Exporting to Excel format...');
  };

  return (
    <div className="space-y-0 bg-white">
      {/* Configuration Panel */}
      <div className="bg-gray-50 border-b border-gray-300 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Strand</label>
            <Select value={selectedStrand} onValueChange={(val) => {
              setSelectedStrand(val);
              setSelectedSection('');
            }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select Strand" />
              </SelectTrigger>
              <SelectContent>
                {mockStrands.map((strand) => (
                  <SelectItem key={strand.name} value={strand.name}>
                    {strand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Section</label>
            <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedStrand}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select Section" />
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

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Subject</label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="General Mathematics">General Mathematics</SelectItem>
                <SelectItem value="Statistics and Probability">Statistics and Probability</SelectItem>
                <SelectItem value="English">English for Academic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={isLocked} className="h-8 text-xs">
            <Save className="w-3 h-3 mr-1" />
            Save Grades
          </Button>
          <Button size="sm" onClick={handleLock} disabled={isLocked} className="h-8 text-xs bg-[#8B1538] hover:bg-[#8B1538]/90">
            <Lock className="w-3 h-3 mr-1" />
            Lock Grades
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="h-8 text-xs">
            <Download className="w-3 h-3 mr-1" />
            Export
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => addAssessment('ww')} disabled={isLocked} className="h-8 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Add WW
            </Button>
            <Button size="sm" variant="outline" onClick={() => addAssessment('pt')} disabled={isLocked} className="h-8 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Add PT
            </Button>
            <Button size="sm" variant="outline" onClick={() => addAssessment('qa')} disabled={isLocked} className="h-8 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Add QA
            </Button>
          </div>
        </div>
      </div>

      {/* DepEd Header Form */}
      <div className="p-4 bg-white border-b border-gray-300">
        <h1 className="text-center text-base font-bold mb-4">SENIOR HIGH SCHOOL CLASS RECORD</h1>
        
        {/* Gender Filter Buttons */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-xs font-medium text-gray-700">Show Students:</span>
          <Button
            size="sm"
            variant={genderFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setGenderFilter('all')}
            className={`h-7 text-xs ${genderFilter === 'all' ? 'bg-[#2D5016] hover:bg-[#2D5016]/90' : ''}`}
          >
            <Users className="w-3 h-3 mr-1" />
            All ({studentGrades.length})
          </Button>
          <Button
            size="sm"
            variant={genderFilter === 'male' ? 'default' : 'outline'}
            onClick={() => setGenderFilter('male')}
            className={`h-7 text-xs ${genderFilter === 'male' ? 'bg-blue-600 hover:bg-blue-700' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}
          >
            <Users className="w-3 h-3 mr-1" />
            Male ({maleCount})
          </Button>
          <Button
            size="sm"
            variant={genderFilter === 'female' ? 'default' : 'outline'}
            onClick={() => setGenderFilter('female')}
            className={`h-7 text-xs ${genderFilter === 'female' ? 'bg-pink-600 hover:bg-pink-700' : 'border-pink-300 text-pink-700 hover:bg-pink-50'}`}
          >
            <Users className="w-3 h-3 mr-1" />
            Female ({femaleCount})
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 max-w-2xl mx-auto text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium w-24">School Year:</span>
            <Select value={schoolYear} onValueChange={setSchoolYear} disabled={isLocked}>
              <SelectTrigger className="flex-1 h-7 text-xs border-b border-gray-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024-2025">2024-2025</SelectItem>
                <SelectItem value="2025-2026">2025-2026</SelectItem>
                <SelectItem value="2026-2027">2026-2027</SelectItem>
                <SelectItem value="2027-2028">2027-2028</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium w-24">Semester:</span>
            <Select value={selectedSemester} onValueChange={(val) => setSelectedSemester(val as '1st' | '2nd')} disabled={isLocked}>
              <SelectTrigger className="flex-1 h-7 text-xs border-b border-gray-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1st">1st</SelectItem>
                <SelectItem value="2nd">2nd</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium w-24">Quarter:</span>
            <Select value={selectedQuarter} onValueChange={(val) => setSelectedQuarter(val as 'First Quarter' | 'Second Quarter')} disabled={isLocked}>
              <SelectTrigger className="flex-1 h-7 text-xs border-b border-gray-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="First Quarter">First Quarter</SelectItem>
                <SelectItem value="Second Quarter">Second Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium w-24">Subject:</span>
            <div className="flex-1 h-7 text-xs border-b border-gray-400 px-2 flex items-center">{selectedSubject}</div>
          </div>
        </div>
      </div>

      {/* Grading Sheet Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs" style={{ borderSpacing: 0 }}>
          {/* Header Row 1 - Category Groups */}
          <thead>
            <tr className="bg-gray-100">
              <th rowSpan={2} className="border border-black p-1 text-[10px] font-bold text-center" style={{ minWidth: '35px' }}>No.</th>
              <th rowSpan={2} className="border border-black p-1 text-[10px] font-bold text-left" style={{ minWidth: '150px' }}>LEARNERS' NAMES</th>
              <th rowSpan={2} className="border border-black p-1 text-[10px] font-bold text-center" style={{ minWidth: '100px' }}>LRN</th>
              
              {/* Written Work Group */}
              <th colSpan={wwAssessments.length + 3} className="border border-black p-1 text-[10px] font-bold text-center bg-blue-50">
                WRITTEN WORK (25%)
              </th>
              
              {/* Performance Task Group */}
              <th colSpan={ptAssessments.length + 3} className="border border-black p-1 text-[10px] font-bold text-center bg-green-50">
                PERFORMANCE TASK (50%)
              </th>
              
              {/* Quarterly Assessment Group */}
              <th colSpan={qaAssessments.length + 3} className="border border-black p-1 text-[10px] font-bold text-center bg-orange-50">
                QUARTERLY ASSESSMENT (25%)
              </th>
              
              <th rowSpan={2} className="border border-black p-1 text-[10px] font-bold text-center bg-yellow-50" style={{ minWidth: '60px' }}>Initial Grade</th>
              <th rowSpan={2} className="border border-black p-1 text-[10px] font-bold text-center bg-purple-50" style={{ minWidth: '65px' }}>Quarterly Grade</th>
            </tr>

            {/* Header Row 2 - Assessment Numbers */}
            <tr className="bg-gray-100">
              {/* Written Work Numbers */}
              {wwAssessments.map((_, index) => (
                <th key={`ww-${index}`} className="border border-black p-1 text-[10px] font-bold text-center bg-blue-50" style={{ minWidth: '35px' }}>
                  {index + 1}
                </th>
              ))}
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-blue-50" style={{ minWidth: '40px' }}>Total</th>
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-blue-50" style={{ minWidth: '40px' }}>PS</th>
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-blue-50" style={{ minWidth: '40px' }}>25%</th>

              {/* Performance Task Numbers */}
              {ptAssessments.map((_, index) => (
                <th key={`pt-${index}`} className="border border-black p-1 text-[10px] font-bold text-center bg-green-50" style={{ minWidth: '35px' }}>
                  {index + 1}
                </th>
              ))}
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-green-50" style={{ minWidth: '40px' }}>Total</th>
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-green-50" style={{ minWidth: '40px' }}>PS</th>
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-green-50" style={{ minWidth: '40px' }}>50%</th>

              {/* Quarterly Assessment Numbers */}
              {qaAssessments.map((_, index) => (
                <th key={`qa-${index}`} className="border border-black p-1 text-[10px] font-bold text-center bg-orange-50" style={{ minWidth: '35px' }}>
                  {index + 1}
                </th>
              ))}
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-orange-50" style={{ minWidth: '40px' }}>Total</th>
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-orange-50" style={{ minWidth: '40px' }}>PS</th>
              <th className="border border-black p-1 text-[10px] font-bold text-center bg-orange-50" style={{ minWidth: '40px' }}>25%</th>
            </tr>

            {/* Highest Possible Score Row */}
            <tr className="bg-gray-200">
              <td colSpan={3} className="border border-black p-1 text-[10px] font-bold text-center">
                HIGHEST POSSIBLE SCORE
              </td>
              
              {/* WW Highest Scores */}
              {wwAssessments.map((assessment, index) => (
                <td key={`ww-hs-${index}`} className="border border-black p-0.5 text-center bg-blue-50">
                  <Input
                    type="number"
                    value={assessment.highestScore}
                    onChange={(e) => {
                      if (!isLocked) {
                        const newAssessments = [...wwAssessments];
                        newAssessments[index].highestScore = Number(e.target.value);
                        setWwAssessments(newAssessments);
                      }
                    }}
                    disabled={isLocked}
                    className="h-5 text-[10px] text-center border-0 bg-transparent p-0 font-semibold"
                  />
                </td>
              ))}
              <td className="border border-black p-1 text-[10px] font-bold text-center bg-blue-100">
                {wwAssessments.reduce((sum, a) => sum + a.highestScore, 0)}
              </td>
              <td colSpan={2} className="border border-black bg-blue-50"></td>

              {/* PT Highest Scores */}
              {ptAssessments.map((assessment, index) => (
                <td key={`pt-hs-${index}`} className="border border-black p-0.5 text-center bg-green-50">
                  <Input
                    type="number"
                    value={assessment.highestScore}
                    onChange={(e) => {
                      if (!isLocked) {
                        const newAssessments = [...ptAssessments];
                        newAssessments[index].highestScore = Number(e.target.value);
                        setPtAssessments(newAssessments);
                      }
                    }}
                    disabled={isLocked}
                    className="h-5 text-[10px] text-center border-0 bg-transparent p-0 font-semibold"
                  />
                </td>
              ))}
              <td className="border border-black p-1 text-[10px] font-bold text-center bg-green-100">
                {ptAssessments.reduce((sum, a) => sum + a.highestScore, 0)}
              </td>
              <td colSpan={2} className="border border-black bg-green-50"></td>

              {/* QA Highest Scores */}
              {qaAssessments.map((assessment, index) => (
                <td key={`qa-hs-${index}`} className="border border-black p-0.5 text-center bg-orange-50">
                  <Input
                    type="number"
                    value={assessment.highestScore}
                    onChange={(e) => {
                      if (!isLocked) {
                        const newAssessments = [...qaAssessments];
                        newAssessments[index].highestScore = Number(e.target.value);
                        setQaAssessments(newAssessments);
                      }
                    }}
                    disabled={isLocked}
                    className="h-5 text-[10px] text-center border-0 bg-transparent p-0 font-semibold"
                  />
                </td>
              ))}
              <td className="border border-black p-1 text-[10px] font-bold text-center bg-orange-100">
                {qaAssessments.reduce((sum, a) => sum + a.highestScore, 0)}
              </td>
              <td colSpan={2} className="border border-black bg-orange-50"></td>

              <td colSpan={2} className="border border-black bg-gray-200"></td>
            </tr>
          </thead>

          {/* Student Rows */}
          <tbody>
            {filteredStudents.map((student, studentIndex) => {
              const wwTotal = calculateTotal(student.writtenWork);
              const ptTotal = calculateTotal(student.performanceTask);
              const qaTotal = calculateTotal(student.quarterlyAssessment);

              const wwPS = calculatePS(wwTotal, wwAssessments.map(a => a.highestScore));
              const ptPS = calculatePS(ptTotal, ptAssessments.map(a => a.highestScore));
              const qaPS = calculatePS(qaTotal, qaAssessments.map(a => a.highestScore));

              const wwWeighted = calculateWeighted(wwPS, 25);
              const ptWeighted = calculateWeighted(ptPS, 50);
              const qaWeighted = calculateWeighted(qaPS, 25);

              const initialGrade = calculateInitialGrade(studentIndex);
              const quarterlyGrade = calculateQuarterlyGrade(initialGrade);

              return (
                <tr key={student.studentId} className="hover:bg-gray-50">
                  <td className="border border-black p-1 text-[10px] text-center">{studentIndex + 1}</td>
                  <td className="border border-black p-1 text-[10px] font-medium">{student.studentName}</td>
                  <td className="border border-black p-1 text-[10px] text-center">{student.lrn}</td>

                  {/* Written Work Scores */}
                  {student.writtenWork.map((score, scoreIndex) => (
                    <td key={`ww-score-${scoreIndex}`} className="border border-black p-0.5">
                      <Input
                        type="number"
                        value={score}
                        onChange={(e) => updateStudentScore(studentIndex, 'writtenWork', scoreIndex, Number(e.target.value))}
                        disabled={isLocked}
                        className="h-5 text-[10px] text-center border-0 bg-white p-0"
                        min="0"
                        max={wwAssessments[scoreIndex]?.highestScore}
                      />
                    </td>
                  ))}
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{wwTotal}</td>
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{wwPS.toFixed(1)}</td>
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{wwWeighted.toFixed(2)}</td>

                  {/* Performance Task Scores */}
                  {student.performanceTask.map((score, scoreIndex) => (
                    <td key={`pt-score-${scoreIndex}`} className="border border-black p-0.5">
                      <Input
                        type="number"
                        value={score}
                        onChange={(e) => updateStudentScore(studentIndex, 'performanceTask', scoreIndex, Number(e.target.value))}
                        disabled={isLocked}
                        className="h-5 text-[10px] text-center border-0 bg-white p-0"
                        min="0"
                        max={ptAssessments[scoreIndex]?.highestScore}
                      />
                    </td>
                  ))}
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{ptTotal}</td>
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{ptPS.toFixed(1)}</td>
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{ptWeighted.toFixed(2)}</td>

                  {/* Quarterly Assessment Scores */}
                  {student.quarterlyAssessment.map((score, scoreIndex) => (
                    <td key={`qa-score-${scoreIndex}`} className="border border-black p-0.5">
                      <Input
                        type="number"
                        value={score}
                        onChange={(e) => updateStudentScore(studentIndex, 'quarterlyAssessment', scoreIndex, Number(e.target.value))}
                        disabled={isLocked}
                        className="h-5 text-[10px] text-center border-0 bg-white p-0"
                        min="0"
                        max={qaAssessments[scoreIndex]?.highestScore}
                      />
                    </td>
                  ))}
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{qaTotal}</td>
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{qaPS.toFixed(1)}</td>
                  <td className="border border-black p-1 text-[10px] text-center font-semibold bg-gray-100">{qaWeighted.toFixed(2)}</td>

                  <td className="border border-black p-1 text-[10px] text-center font-bold bg-yellow-50">{initialGrade.toFixed(2)}</td>
                  <td className={`border border-black p-1 text-[10px] text-center font-bold ${quarterlyGrade >= 75 ? 'bg-green-100' : 'bg-red-100'}`}>
                    {quarterlyGrade}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}