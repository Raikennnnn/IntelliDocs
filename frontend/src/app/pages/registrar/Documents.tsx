import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Search, Eye, CheckCircle, XCircle, FileText, Folder, Clock, Package, CheckCheck, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

export function Documents() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [newComment, setNewComment] = useState('');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('all');
  const [credentialRequests, setCredentialRequests] = useState([
    {
      id: 1,
      studentName: 'Juan Dela Cruz',
      lrn: '123456789012',
      strand: 'HUMSS',
      documentType: 'Certificate of Enrollment',
      purpose: 'Scholarship Application',
      dateRequested: '2024-02-20',
      status: 'Pending',
      copies: 1,
      paymentStatus: 'Pending',
      comments: [
        { id: 1, author: 'Registrar Staff', message: 'Request received. Will process soon.', timestamp: '2024-02-20 10:00 AM' },
        { id: 2, author: 'Registrar Staff', message: 'Waiting for payment verification.', timestamp: '2024-02-20 11:30 AM' }
      ]
    },
    {
      id: 2,
      studentName: 'Maria Santos',
      lrn: '123456789013',
      strand: 'HUMSS',
      documentType: 'Good Moral Certificate',
      purpose: 'Job Application',
      dateRequested: '2024-02-21',
      status: 'Processing',
      copies: 2,
      paymentStatus: 'Paid',
      comments: [
        { id: 1, author: 'Registrar Staff', message: 'Request received and payment verified.', timestamp: '2024-02-21 09:00 AM' },
        { id: 2, author: 'Registrar Staff', message: 'Processing document now.', timestamp: '2024-02-21 10:30 AM' },
        { id: 3, author: 'Registrar Staff', message: 'Document being prepared. Awaiting principal signature.', timestamp: '2024-02-21 02:00 PM' }
      ]
    },
    {
      id: 3,
      studentName: 'Pedro Reyes',
      lrn: '123456789014',
      strand: 'TVL',
      documentType: 'Transcript of Records',
      purpose: 'College Application',
      dateRequested: '2024-02-19',
      status: 'Ready for Pickup',
      copies: 1,
      paymentStatus: 'Paid',
      comments: [
        { id: 1, author: 'Registrar Staff', message: 'Request received and payment verified.', timestamp: '2024-02-19 09:00 AM' },
        { id: 2, author: 'Registrar Staff', message: 'Processing transcript of records.', timestamp: '2024-02-19 01:00 PM' },
        { id: 3, author: 'Registrar Staff', message: 'Document completed and sealed. Ready for pickup at registrar office.', timestamp: '2024-02-22 11:00 AM' }
      ]
    },
    {
      id: 4,
      studentName: 'Ana Garcia',
      lrn: '123456789015',
      strand: 'HUMSS',
      documentType: 'Form 137',
      purpose: 'Transfer to Another School',
      dateRequested: '2024-02-18',
      status: 'Released',
      copies: 1,
      paymentStatus: 'Paid',
      comments: [
        { id: 1, author: 'Registrar Staff', message: 'Request received and payment verified.', timestamp: '2024-02-18 10:00 AM' },
        { id: 2, author: 'Registrar Staff', message: 'Processing Form 137 with complete academic records.', timestamp: '2024-02-19 11:00 AM' },
        { id: 3, author: 'Registrar Staff', message: 'Document completed. Ready for pickup.', timestamp: '2024-02-22 02:00 PM' },
        { id: 4, author: 'Registrar Staff', message: 'Document released to student. Student signed pickup receipt.', timestamp: '2024-02-23 03:00 PM' }
      ]
    },
    {
      id: 5,
      studentName: 'Jose Mendoza',
      lrn: '123456789016',
      strand: 'TVL',
      documentType: 'Certificate of Enrollment',
      purpose: 'Student Discount Application',
      dateRequested: '2024-02-22',
      status: 'Pending',
      copies: 1,
      paymentStatus: 'Pending',
      comments: [
        { id: 1, author: 'Registrar Staff', message: 'Request received. Awaiting payment.', timestamp: '2024-02-22 09:00 AM' }
      ]
    },
    {
      id: 6,
      studentName: 'Carmen Lopez',
      lrn: '123456789017',
      strand: 'HUMSS',
      documentType: 'Certificate of Good Moral',
      purpose: 'Internship Requirement',
      dateRequested: '2024-02-20',
      status: 'Processing',
      copies: 1,
      paymentStatus: 'Paid',
      comments: [
        { id: 1, author: 'Registrar Staff', message: 'Request received and payment verified.', timestamp: '2024-02-20 09:00 AM' },
        { id: 2, author: 'Registrar Staff', message: 'Document being prepared. Checking disciplinary records.', timestamp: '2024-02-21 10:30 AM' }
      ]
    }
  ]);

  // Filter students
  const filteredStudents = credentialRequests.filter(request => {
    const matchesSearch = request.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.lrn.includes(searchTerm);
    const matchesDocType = selectedDocumentType === 'all' || request.documentType === selectedDocumentType;
    return matchesSearch && matchesDocType;
  });

  // Get unique document types
  const documentTypes = Array.from(new Set(credentialRequests.map(req => req.documentType))).sort();
  
  // Get count for each document type
  const getDocumentTypeCount = (docType: string) => {
    return credentialRequests.filter(req => req.documentType === docType).length;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return (
          <Badge className="bg-gray-500 text-white">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'Processing':
        return (
          <Badge className="bg-orange-500 text-white">
            <Package className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        );
      case 'Ready for Pickup':
        return (
          <Badge className="bg-blue-500 text-white">
            <Folder className="w-3 h-3 mr-1" />
            Ready for Pickup
          </Badge>
        );
      case 'Released':
        return (
          <Badge className="bg-[#2D5016] text-white">
            <CheckCheck className="w-3 h-3 mr-1" />
            Released
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500 text-white">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const totalRequests = credentialRequests.length;
  const pending = credentialRequests.filter(r => r.status === 'Pending').length;
  const processing = credentialRequests.filter(r => r.status === 'Processing').length;
  const readyForPickup = credentialRequests.filter(r => r.status === 'Ready for Pickup').length;
  const released = credentialRequests.filter(r => r.status === 'Released').length;

  const handleStatusUpdate = (requestId: number, newStatus: string) => {
    setCredentialRequests(prevRequests => 
      prevRequests.map(request => 
        request.id === requestId ? { ...request, status: newStatus } : request
      )
    );
    toast.success(`Request status updated to ${newStatus}`);
    setSelectedRequest(null);
  };

  const getActionButtons = (request: any) => {
    switch (request.status) {
      case 'Pending':
        return (
          <Button 
            size="sm" 
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => handleStatusUpdate(request.id, 'Processing')}
          >
            <Package className="w-4 h-4 mr-1" />
            Start Processing
          </Button>
        );
      case 'Processing':
        return (
          <Button 
            size="sm" 
            className="bg-blue-500 hover:bg-blue-600"
            onClick={() => handleStatusUpdate(request.id, 'Ready for Pickup')}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Mark as Ready
          </Button>
        );
      case 'Ready for Pickup':
        return (
          <Button 
            size="sm" 
            className="bg-[#2D5016] hover:bg-[#1D3010]"
            onClick={() => handleStatusUpdate(request.id, 'Released')}
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark as Released
          </Button>
        );
      case 'Released':
        return (
          <Badge className="bg-[#2D5016] text-white">
            <CheckCheck className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleAddComment = (requestId: number) => {
    if (newComment.trim() === '') return;
    setCredentialRequests(prevRequests => 
      prevRequests.map(request => 
        request.id === requestId ? { 
          ...request, 
          comments: [
            ...request.comments,
            { id: request.comments.length + 1, author: 'Registrar Staff', message: newComment, timestamp: new Date().toLocaleString() }
          ]
        } : request
      )
    );
    setNewComment('');
    toast.success('Comment added successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Document Management</h2>
        <p className="text-gray-600">Track student document submission status</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalRequests}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-500">{pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{processing}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ready for Pickup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{readyForPickup}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Released</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#2D5016]">{released}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Student</CardTitle>
          <CardDescription>Find student documents by name or LRN</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name or LRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Document Type Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Document Type</CardTitle>
          <CardDescription>View requests organized by document type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
              <SelectTrigger className="w-full md:w-[350px]">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>
                      {selectedDocumentType === 'all' 
                        ? 'All Documents' 
                        : selectedDocumentType}
                    </span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center justify-between w-full pr-8">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>All Documents</span>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {totalRequests}
                    </Badge>
                  </div>
                </SelectItem>
                {documentTypes.map((docType) => (
                  <SelectItem key={docType} value={docType}>
                    <div className="flex items-center justify-between w-full pr-8">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{docType}</span>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {getDocumentTypeCount(docType)}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Document Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>Credential Requests</CardTitle>
          <CardDescription>
            Student credential and document requests ({filteredStudents.length} of {totalRequests} requests)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Student</TableHead>
                  <TableHead className="w-[110px]">LRN</TableHead>
                  <TableHead className="w-[130px]">Document</TableHead>
                  <TableHead className="w-[100px]">Purpose</TableHead>
                  <TableHead className="w-[40px] text-center">Qty</TableHead>
                  <TableHead className="w-[80px]">Date</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">Payment</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-[#8B1538] flex-shrink-0" />
                        <span className="truncate">{request.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{request.lrn}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 whitespace-nowrap">{request.documentType}</Badge>
                    </TableCell>
                    <TableCell className="text-xs truncate" title={request.purpose}>{request.purpose}</TableCell>
                    <TableCell className="text-center text-xs">{request.copies}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{request.dateRequested}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] px-1.5 py-0.5 whitespace-nowrap ${
                        request.status === 'Pending' ? 'bg-gray-500' :
                        request.status === 'Processing' ? 'bg-orange-500' :
                        request.status === 'Ready for Pickup' ? 'bg-blue-500' :
                        'bg-[#2D5016]'
                      }`}>
                        {request.status === 'Pending' && <Clock className="w-2.5 h-2.5 mr-0.5 inline" />}
                        {request.status === 'Processing' && <Package className="w-2.5 h-2.5 mr-0.5 inline" />}
                        {request.status === 'Ready for Pickup' && <Folder className="w-2.5 h-2.5 mr-0.5 inline" />}
                        {request.status === 'Released' && <CheckCheck className="w-2.5 h-2.5 mr-0.5 inline" />}
                        <span className="text-[10px]">{request.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] px-1.5 py-0.5 whitespace-nowrap ${
                        request.paymentStatus === 'Paid' ? 'bg-green-600' :
                        request.paymentStatus === 'Pending' ? 'bg-yellow-500' :
                        'bg-red-600'
                      }`}>
                        {request.paymentStatus || 'Not Paid'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 px-1.5 text-xs">
                              <Eye className="w-3 h-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Credential Request Details</DialogTitle>
                              <DialogDescription>
                                Review and process credential request
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              {/* Student Information */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Student Information</h4>
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Full Name:</span>
                                    <span className="text-sm font-medium">{request.studentName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">LRN:</span>
                                    <span className="text-sm font-mono font-medium">{request.lrn}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Strand:</span>
                                    <Badge variant="outline">{request.strand}</Badge>
                                  </div>
                                </div>
                              </div>

                              {/* Request Details */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Request Details</h4>
                                <div className="bg-blue-50 p-4 rounded-lg space-y-2 border border-blue-200">
                                  <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Document Type:</span>
                                    <span className="text-sm font-medium">{request.documentType}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Number of Copies:</span>
                                    <span className="text-sm font-medium">{request.copies}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Purpose:</span>
                                    <span className="text-sm font-medium">{request.purpose}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Date Requested:</span>
                                    <span className="text-sm font-medium">{request.dateRequested}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Current Status:</span>
                                    {getStatusBadge(request.status)}
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Payment Status:</span>
                                    <Badge className={`text-[10px] px-1.5 py-0.5 ${
                                      request.paymentStatus === 'Paid' ? 'bg-green-600' :
                                      request.paymentStatus === 'Pending' ? 'bg-yellow-500' :
                                      'bg-red-600'
                                    }`}>
                                      {request.paymentStatus || 'Not Paid'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              {/* Status Timeline */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Status Timeline</h4>
                                <div className="space-y-2">
                                  <div className={`flex items-center gap-3 p-2 rounded ${request.status === 'Pending' || request.status === 'Processing' || request.status === 'Ready for Pickup' || request.status === 'Released' ? 'bg-green-50' : 'bg-gray-50'}`}>
                                    <div className={`w-2 h-2 rounded-full ${request.status === 'Pending' || request.status === 'Processing' || request.status === 'Ready for Pickup' || request.status === 'Released' ? 'bg-[#2D5016]' : 'bg-gray-300'}`}></div>
                                    <span className="text-sm">Request Submitted</span>
                                  </div>
                                  <div className={`flex items-center gap-3 p-2 rounded ${request.status === 'Processing' || request.status === 'Ready for Pickup' || request.status === 'Released' ? 'bg-green-50' : 'bg-gray-50'}`}>
                                    <div className={`w-2 h-2 rounded-full ${request.status === 'Processing' || request.status === 'Ready for Pickup' || request.status === 'Released' ? 'bg-[#2D5016]' : 'bg-gray-300'}`}></div>
                                    <span className="text-sm">Processing Document</span>
                                  </div>
                                  <div className={`flex items-center gap-3 p-2 rounded ${request.status === 'Ready for Pickup' || request.status === 'Released' ? 'bg-green-50' : 'bg-gray-50'}`}>
                                    <div className={`w-2 h-2 rounded-full ${request.status === 'Ready for Pickup' || request.status === 'Released' ? 'bg-[#2D5016]' : 'bg-gray-300'}`}></div>
                                    <span className="text-sm">Ready for Pickup</span>
                                  </div>
                                  <div className={`flex items-center gap-3 p-2 rounded ${request.status === 'Released' ? 'bg-green-50' : 'bg-gray-50'}`}>
                                    <div className={`w-2 h-2 rounded-full ${request.status === 'Released' ? 'bg-[#2D5016]' : 'bg-gray-300'}`}></div>
                                    <span className="text-sm">Released to Student</span>
                                  </div>
                                </div>
                              </div>

                              {/* Comments */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Comments</h4>
                                <div className="space-y-2">
                                  {request.comments.map(comment => (
                                    <div key={comment.id} className="bg-gray-50 p-2 rounded-lg flex items-center gap-2">
                                      <MessageSquare className="w-4 h-4 text-gray-600" />
                                      <div className="space-y-1">
                                        <span className="text-sm font-medium">{comment.author}</span>
                                        <span className="text-xs text-gray-500">{comment.timestamp}</span>
                                        <p className="text-sm text-gray-600">{comment.message}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Add Comment */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Add Comment</h4>
                                <div className="space-y-2">
                                  <Textarea
                                    placeholder="Add a comment..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    className="w-full"
                                  />
                                  <Button
                                    size="sm"
                                    className="bg-[#2D5016] hover:bg-[#1D3010] text-white"
                                    onClick={() => handleAddComment(request.id)}
                                  >
                                    <Send className="w-3 h-3 mr-0.5" />
                                    Send
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <DialogFooter className="mt-6">
                              <div className="flex items-center gap-2 w-full">
                                {getActionButtons(request)}
                              </div>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <div className="whitespace-nowrap">
                          {request.status === 'Pending' && (
                            <Button 
                              size="sm" 
                              className="bg-orange-500 hover:bg-orange-600 h-7 px-2 text-xs"
                              onClick={() => handleStatusUpdate(request.id, 'Processing')}
                            >
                              <Package className="w-3 h-3 mr-0.5" />
                              Process
                            </Button>
                          )}
                          {request.status === 'Processing' && (
                            <Button 
                              size="sm" 
                              className="bg-blue-500 hover:bg-blue-600 h-7 px-2 text-xs"
                              onClick={() => handleStatusUpdate(request.id, 'Ready for Pickup')}
                            >
                              <CheckCircle className="w-3 h-3 mr-0.5" />
                              Ready
                            </Button>
                          )}
                          {request.status === 'Ready for Pickup' && (
                            <Button 
                              size="sm" 
                              className="bg-[#2D5016] hover:bg-[#1D3010] h-7 px-2 text-xs"
                              onClick={() => handleStatusUpdate(request.id, 'Released')}
                            >
                              <CheckCheck className="w-3 h-3 mr-0.5" />
                              Release
                            </Button>
                          )}
                          {request.status === 'Released' && (
                            <Badge className="bg-[#2D5016] text-white text-[10px] px-1.5 py-0.5">
                              <CheckCheck className="w-2.5 h-2.5 mr-0.5" />
                              Done
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}