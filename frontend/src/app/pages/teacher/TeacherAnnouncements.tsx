import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { mockAnnouncements, mockStrands } from '../../data/mockData';
import { Megaphone, Send, Calendar, Users, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

export function TeacherAnnouncements() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedStrand, setSelectedStrand] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [category, setCategory] = useState('');

  const handlePublish = () => {
    if (!title || !message || !selectedStrand || !category) {
      toast.error('Please fill in all fields');
      return;
    }

    if (selectedStrand !== 'all' && !selectedSection) {
      toast.error('Please select a section');
      return;
    }
    
    const targetText = selectedStrand === 'all' 
      ? 'All Strands' 
      : `${selectedStrand} - ${selectedSection}`;
    
    toast.success(`Announcement published successfully to ${targetText}!`);
    // Reset form
    setTitle('');
    setMessage('');
    setSelectedStrand('');
    setSelectedSection('');
    setCategory('');
  };

  const teacherAnnouncements = mockAnnouncements.filter(
    a => a.author === 'Maria Santos' || a.target === 'Teachers'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Create Announcements</h2>
        <p className="text-gray-600">Post announcements for your students</p>
      </div>

      {/* Create Announcement Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#8B1538]" />
            New Announcement
          </CardTitle>
          <CardDescription>Fill in the details to create an announcement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Announcement Category */}
            <div>
              <Label htmlFor="category">Announcement Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="mt-1.5">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Exam Announcements">Exam Announcements</SelectItem>
                  <SelectItem value="Walang Pasok">Walang Pasok (No Classes)</SelectItem>
                  <SelectItem value="School Events">School Events</SelectItem>
                  <SelectItem value="General">General Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Select Strand */}
            <div>
              <Label htmlFor="strand">Select Strand</Label>
              <Select value={selectedStrand} onValueChange={(value) => {
                setSelectedStrand(value);
                setSelectedSection(''); // Reset section when strand changes
              }}>
                <SelectTrigger id="strand" className="mt-1.5">
                  <SelectValue placeholder="Select strand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strands</SelectItem>
                  {mockStrands.map((strand) => (
                    <SelectItem key={strand.name} value={strand.name}>
                      {strand.name} - {strand.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Select Section */}
            <div>
              <Label htmlFor="section">Select Section</Label>
              <Select 
                value={selectedSection} 
                onValueChange={setSelectedSection}
                disabled={!selectedStrand || selectedStrand === 'all'}
              >
                <SelectTrigger id="section" className="mt-1.5">
                  <SelectValue placeholder={
                    selectedStrand === 'all' 
                      ? "All sections included" 
                      : selectedStrand 
                        ? "Select section" 
                        : "Select strand first"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {selectedStrand && selectedStrand !== 'all' && mockStrands
                    .find((s) => s.name === selectedStrand)
                    ?.sections.map((section) => (
                      <SelectItem key={section} value={section}>
                        {selectedStrand} - {section}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Announcement Title */}
            <div>
              <Label htmlFor="title">Announcement Title</Label>
              <Input
                id="title"
                placeholder="Enter announcement title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>

            {/* Announcement Message */}
            <div>
              <Label htmlFor="message">Announcement Message</Label>
              <Textarea
                id="message"
                placeholder="Write your announcement message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="mt-1.5"
              />
            </div>

            {/* Publish Button */}
            <div className="flex justify-end pt-2">
              <Button 
                onClick={handlePublish}
                className="bg-[#8B1538] hover:bg-[#8B1538]/90"
              >
                <Send className="w-4 h-4 mr-2" />
                Publish Announcement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview of Published Announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#2D5016]" />
            My Published Announcements
          </CardTitle>
          <CardDescription>View your recent announcements</CardDescription>
        </CardHeader>
        <CardContent>
          {teacherAnnouncements.length > 0 ? (
            <div className="space-y-4">
              {teacherAnnouncements.map((announcement) => (
                <div 
                  key={announcement.id} 
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{announcement.title}</h3>
                        <Badge 
                          variant={
                            announcement.priority === 'high' ? 'destructive' : 'secondary'
                          }
                        >
                          {announcement.category}
                        </Badge>
                      </div>
                      <p className="text-gray-700 mb-3">{announcement.content}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(announcement.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>Target: {announcement.target}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Megaphone className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">No announcements published yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first announcement above</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Announcement Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-900">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Use clear and concise titles to grab attention</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Include important dates and deadlines in your message</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Select the appropriate category for better organization</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              <span>Target specific sections when announcements are class-specific</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}