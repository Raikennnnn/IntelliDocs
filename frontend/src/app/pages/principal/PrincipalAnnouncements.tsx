import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Megaphone, Send, Users, BookOpen, School } from 'lucide-react';
import { mockAnnouncements, mockStrands } from '../../data/mockData';
import { toast } from 'sonner';

export function PrincipalAnnouncements() {
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

    toast.success(`Announcement published successfully to ${targetText}`);

    // Reset form
    setTitle('');
    setMessage('');
    setSelectedStrand('');
    setSelectedSection('');
    setCategory('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Announcements</h2>
        <p className="text-gray-600">Post announcements to students and teachers</p>
      </div>

      {/* Announcement Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#8B1538]" />
            Create New Announcement
          </CardTitle>
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
              <Select 
                value={selectedStrand} 
                onValueChange={(value) => {
                  setSelectedStrand(value);
                  setSelectedSection(''); // Reset section when strand changes
                }}
              >
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
                className="bg-[#8B1538] hover:bg-[#6B1028]"
              >
                <Send className="w-4 h-4 mr-2" />
                Publish Announcement
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview of Target Section */}
      {selectedStrand && (
        <Card className="bg-[#2D5016] text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6" />
              <div>
                <p className="text-sm opacity-90">This announcement will be sent to:</p>
                <p className="text-lg font-bold">
                  {selectedStrand === 'all' 
                    ? 'All Strands (All Sections)' 
                    : selectedSection 
                      ? `${selectedStrand} - ${selectedSection} Section`
                      : `${selectedStrand} - (Select a section)`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Announcements */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockAnnouncements
              .filter((ann) => ann.author === 'Principal Office')
              .map((announcement) => (
                <div
                  key={announcement.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{announcement.title}</h3>
                      <p className="text-sm text-gray-600">{announcement.content}</p>
                    </div>
                    <Badge
                      className={
                        announcement.priority === 'high'
                          ? 'bg-red-600 text-white'
                          : 'bg-blue-600 text-white'
                      }
                    >
                      {announcement.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>📅 {announcement.date}</span>
                    <span>👥 {announcement.target}</span>
                    <span>📂 {announcement.category}</span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}