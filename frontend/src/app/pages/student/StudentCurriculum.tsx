import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { mockCurriculum } from '../../data/mockData';
import { BookOpen } from 'lucide-react';

export function StudentCurriculum() {
  const { user } = useAuth();
  
  // Get curriculum for student's strand
  const strandCurriculum = mockCurriculum[user?.strand as keyof typeof mockCurriculum];

  if (!strandCurriculum) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Curriculum</h2>
          <p className="text-gray-600">No curriculum data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">My Curriculum</h2>
        <p className="text-gray-600">{user?.strand} - Subject List</p>
      </div>

      {/* Grade 11 Subjects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#8B1538]" />
                Grade 11 Subjects
              </CardTitle>
              <CardDescription>First year of Senior High School</CardDescription>
            </div>
            <Badge className="bg-[#8B1538]">
              {strandCurriculum['Grade 11'].length} Subjects
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject Code</TableHead>
                <TableHead>Subject Title</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strandCurriculum['Grade 11'].map((subject, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">{subject.code}</TableCell>
                  <TableCell className="font-medium">{subject.subject}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={subject.type === 'Core' ? 'default' : 'secondary'}
                      className={subject.type === 'Core' ? 'bg-[#8B1538]' : 'bg-[#2D5016]'}
                    >
                      {subject.type}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Grade 12 Subjects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#8B1538]" />
                Grade 12 Subjects
              </CardTitle>
              <CardDescription>Second year of Senior High School</CardDescription>
            </div>
            <Badge className="bg-[#8B1538]">
              {strandCurriculum['Grade 12'].length} Subjects
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject Code</TableHead>
                <TableHead>Subject Title</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strandCurriculum['Grade 12'].map((subject, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">{subject.code}</TableCell>
                  <TableCell className="font-medium">{subject.subject}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={subject.type === 'Core' ? 'default' : 'secondary'}
                      className={subject.type === 'Core' ? 'bg-[#8B1538]' : 'bg-[#2D5016]'}
                    >
                      {subject.type}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Curriculum Legend */}
      <Card>
        
        
      </Card>
    </div>
  );
}
