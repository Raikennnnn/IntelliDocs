import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { mockDocumentRequests } from '../../data/mockData';
import { FileText, Download, CheckCircle, Clock, XCircle, DollarSign, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

type PaymentStatus = 'Unpaid' | 'Under Verification' | 'Paid' | 'Processing';

type DocumentRequest = {
  id: string;
  documentType: string;
  purpose: string;
  status: string;
  requestDate: string;
  approvedBy?: string;
  releaseDate?: string;
  paymentStatus?: PaymentStatus;
};

export function StudentDocuments() {
  const [requests, setRequests] = useState<DocumentRequest[]>(
    mockDocumentRequests.map((req, index) => ({
      ...req,
      paymentStatus: index === 0 ? 'Paid' : index === 1 ? 'Under Verification' : index === 2 ? 'Processing' : 'Unpaid'
    }))
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPaymentNotification, setShowPaymentNotification] = useState(false);

  const handleNewRequest = (documentType: string, purpose: string) => {
    // Show payment notification popup
    setShowPaymentNotification(true);
    setIsDialogOpen(false);
    
    // Add new request with Unpaid status
    const newRequest: DocumentRequest = {
      id: `REQ${String(requests.length + 1).padStart(3, '0')}`,
      documentType,
      purpose,
      status: 'Processing',
      requestDate: new Date().toISOString(),
      paymentStatus: 'Unpaid'
    };
    
    setRequests([newRequest, ...requests]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Released':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Ready':
        return <Download className="w-4 h-4 text-blue-600" />;
      case 'Processing':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Released':
        return 'default';
      case 'Ready':
        return 'secondary';
      case 'Processing':
        return 'outline';
      default:
        return 'destructive';
    }
  };

  const getPaymentStatusBadge = (paymentStatus?: PaymentStatus) => {
    if (!paymentStatus) return null;
    
    switch (paymentStatus) {
      case 'Paid':
        return (
          <Badge className="bg-[#2D5016] hover:bg-[#2D5016]">
            <CheckCircle className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case 'Under Verification':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-600">
            <Clock className="w-3 h-3 mr-1" />
            Under Verification
          </Badge>
        );
      case 'Processing':
        return (
          <Badge className="bg-orange-600 hover:bg-orange-600">
            <Clock className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        );
      case 'Unpaid':
        return (
          <Badge className="bg-red-600 hover:bg-red-600">
            <DollarSign className="w-3 h-3 mr-1" />
            Unpaid
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPaymentStatusCount = (status: PaymentStatus) => {
    return requests.filter(r => r.paymentStatus === status).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Document & Credential Requests</h2>
          <p className="text-gray-600">Request and track your academic documents</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileText className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Document</DialogTitle>
              <DialogDescription>Submit a new document request</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleNewRequest(
                formData.get('documentType') as string,
                formData.get('purpose') as string
              );
            }}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="documentType">Document Type</Label>
                  <Select name="documentType" required>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Form 137">Form 137</SelectItem>
                      <SelectItem value="Report Card">Report Card</SelectItem>
                      <SelectItem value="Transcript of Records">Transcript of Records</SelectItem>
                      <SelectItem value="Certification">Certification</SelectItem>
                      <SelectItem value="Good Moral Certificate">Good Moral Certificate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="purpose">Purpose</Label>
                  <Textarea 
                    id="purpose"
                    name="purpose"
                    placeholder="Enter purpose of request"
                    className="mt-1"
                    required
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="submit" className="bg-[#8B1538] hover:bg-[#6c102c]">
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment Notification Dialog */}
      <Dialog open={showPaymentNotification} onOpenChange={setShowPaymentNotification}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#8B1538]">
              <DollarSign className="w-5 h-5" />
              Payment Required
            </DialogTitle>
            <DialogDescription>
              Complete payment at the Registrar's Office to process your document request
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-900">
                <strong>Important:</strong> Your document request has been submitted successfully.
              </AlertDescription>
            </Alert>
            <div className="text-center py-4">
              <DollarSign className="w-16 h-16 mx-auto text-[#8B1538] mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Please proceed to Registrar for payment.
              </h3>
              <p className="text-sm text-gray-600">
                Your request will be processed after payment verification.
              </p>
            </div>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Office Hours:</strong> Monday to Friday, 8:00 AM - 5:00 PM<br />
                <strong>Location:</strong> Registrar's Office, Main Building
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPaymentNotification(false)} className="w-full bg-[#8B1538] hover:bg-[#6c102c]">
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {getPaymentStatusCount('Unpaid')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Under Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {getPaymentStatusCount('Under Verification')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#2D5016]">
              {getPaymentStatusCount('Paid')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {getPaymentStatusCount('Processing')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Requests */}
      <Card>
        <CardHeader>
          <CardTitle>My Document Requests</CardTitle>
          <CardDescription>Track the status and payment of your document requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {requests.map((doc) => (
              <div key={doc.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">{doc.documentType}</p>
                      <p className="text-sm text-gray-600">Request ID: {doc.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={getStatusColor(doc.status)}>
                      {getStatusIcon(doc.status)}
                      <span className="ml-1">{doc.status}</span>
                    </Badge>
                    {doc.paymentStatus && getPaymentStatusBadge(doc.paymentStatus)}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Purpose</p>
                    <p className="font-medium">{doc.purpose}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Request Date</p>
                    <p className="font-medium">{new Date(doc.requestDate).toLocaleDateString()}</p>
                  </div>
                  {doc.approvedBy && (
                    <div>
                      <p className="text-gray-600">Approved By</p>
                      <p className="font-medium">{doc.approvedBy}</p>
                    </div>
                  )}
                  {doc.releaseDate && (
                    <div>
                      <p className="text-gray-600">Release Date</p>
                      <p className="font-medium">{new Date(doc.releaseDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                {/* Payment Status Alerts */}
                {doc.paymentStatus === 'Unpaid' && (
                  <div className="mt-3 pt-3 border-t">
                    <Alert className="bg-red-50 border-red-200">
                      <DollarSign className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-900 text-sm">
                        <strong>Payment Required:</strong> Please proceed to the Registrar's Office to complete payment.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {doc.paymentStatus === 'Under Verification' && (
                  <div className="mt-3 pt-3 border-t">
                    <Alert className="bg-blue-50 border-blue-200">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-900 text-sm">
                        <strong>Payment Under Verification:</strong> Your payment is being verified by the Registrar.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {doc.paymentStatus === 'Paid' && doc.status === 'Processing' && (
                  <div className="mt-3 pt-3 border-t">
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-900 text-sm">
                        <strong>Payment Confirmed:</strong> Your document is now being processed.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {doc.status === 'Ready' && (
                  <div className="mt-3 pt-3 border-t">
                    <Alert className="bg-green-50 border-green-200">
                      <Download className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-900 text-sm">
                        ✓ Your document is ready for pickup at the Registrar's Office
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help Information */}
      <Card>
        <CardHeader>
          <CardTitle>Processing & Payment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm mb-2 text-gray-900">Payment Process:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-[#8B1538] font-bold">1.</span>
                  Submit document request online
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8B1538] font-bold">2.</span>
                  Proceed to Registrar's Office for payment
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8B1538] font-bold">3.</span>
                  Wait for payment verification (1-2 business days)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8B1538] font-bold">4.</span>
                  Document processing begins after payment confirmation
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 text-gray-900">Important Notes:</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  Processing time: 3-5 business days after payment
                </li>
                <li className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  Pick up documents at the Registrar's Office
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  Bring your school ID when claiming documents
                </li>
                <li className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  Office Hours: Mon-Fri, 8:00 AM - 5:00 PM
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}