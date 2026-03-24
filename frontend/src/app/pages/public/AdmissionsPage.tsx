import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { BookOpen, GraduationCap, FileText, CheckCircle, Users, Lightbulb, Briefcase, Wrench } from 'lucide-react';

export function AdmissionsPage() {
  const requirements = [
    'Completed Application Form',
    'Copy of Report Card (Form 9 / SF9)',
    'SF10 / Form 137',
    'PSA Birth Certificate',
    '2×2 ID Picture',
    'Certificate of Good Moral Character',
    'Transcript of Records (TOR) - for transferee only',
  ];

  const enrollmentSteps = [
    {
      step: 1,
      title: 'Create an Account',
      description: 'Register for a new account by providing your basic information and creating login credentials.',
    },
    {
      step: 2,
      title: 'Login to Your Account',
      description: 'Access your student portal using your registered email and password.',
    },
    {
      step: 3,
      title: 'Fill Up Enrollment Forms',
      description: 'Complete all required enrollment forms with accurate personal and academic information.',
    },
    {
      step: 4,
      title: 'Submit Application & Documents',
      description: 'Upload and submit all required documents including Birth Certificate, Good Moral, SF9, SF10/Form 137, and TOR.',
    },
    {
      step: 5,
      title: 'Document Verification',
      description: 'Your submitted documents will be verified by the Registrar\'s Office.',
    },
    {
      step: 6,
      title: 'Await Confirmation',
      description: 'Wait for enrollment confirmation and further instructions from the Registrar\'s Office.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="bg-[#8B1538] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Admissions</h1>
          <p className="text-xl text-gray-200 max-w-3xl">
            We welcome aspiring students who are committed to academic growth and personal development. 
            Our Senior High School program offers structured academic tracks designed to prepare learners 
            for higher education and future careers.
          </p>
        </div>
      </section>

      {/* Offered Programs */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#8B1538] mb-4">
              Offered Programs
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose the academic strand that aligns with your interests and career goals
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Academic Track Card */}
            <Card className="shadow-xl border border-gray-200">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-[#8B1538] rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-[#8B1538]">Academic Track</h3>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* HUMSS */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-5 h-5 text-[#8B1538]" />
                      <h4 className="font-bold text-gray-900">Humanities and Social Sciences (HUMSS)</h4>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed pl-7">
                      For students interested in social sciences, education, humanities, liberal arts, and communication arts.
                    </p>
                  </div>

                  {/* ABM */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="w-5 h-5 text-[#8B1538]" />
                      <h4 className="font-bold text-gray-900">Accountancy, Business, and Management (ABM)</h4>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed pl-7">
                      Ideal for students aiming for careers in business, entrepreneurship, finance, and management.
                    </p>
                  </div>

                  {/* STEM */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-5 h-5 text-[#8B1538]" />
                      <h4 className="font-bold text-gray-900">Science, Technology, Engineering, and Mathematics (STEM)</h4>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed pl-7">
                      Designed for students pursuing careers in engineering, medicine, IT, and other science-related fields.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TVL Track Card */}
            <Card className="shadow-xl border border-gray-200">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-[#2D5016] rounded-lg flex items-center justify-center">
                    <Wrench className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-[#2D5016]">Technical-Vocational-Livelihood (TVL)</h3>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* ICT */}
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Information and Communications Technology (ICT)</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Focuses on computer systems, programming, networking, and digital technologies.
                    </p>
                  </div>

                  {/* EIM */}
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Electrical Installation and Maintenance (EIM)</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Covers electrical wiring, troubleshooting, and maintenance of electrical systems.
                    </p>
                  </div>

                  {/* BPP/FBS */}
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Bread and Pastry Production / Food and Beverages Services (BPP/FBS)</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Training in culinary arts, baking, food preparation, and hospitality services.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Admission Requirements */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#8B1538] mb-4">
              Admission Requirements
            </h2>
            <p className="text-gray-600">
              Applicants must submit the following documents
            </p>
          </div>

          <Card className="max-w-3xl mx-auto shadow-lg">
            <CardContent className="p-8">
              <div className="space-y-4">
                {requirements.map((requirement, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#2D5016] mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">{requirement}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Enrollment Process */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#8B1538] mb-4">
              Enrollment Process
            </h2>
            <p className="text-gray-600">
              Follow these simple steps to complete your enrollment
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">
              {enrollmentSteps.map((item, index) => (
                <Card key={index} className="shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-[#8B1538] rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {item.step}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {item.title}
                        </h3>
                        <p className="text-gray-600">{item.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-[#8B1538] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Users className="w-16 h-16 mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Begin Your Academic Journey?
          </h2>
          <p className="text-lg mb-8 text-gray-200">
            Join our community and take the first step towards a brighter future.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/registration">
              <Button 
                size="lg" 
                className="bg-white text-[#8B1538] hover:bg-gray-100 text-lg px-8 py-6"
              >
                <FileText className="w-5 h-5 mr-2" />
                Create Account
              </Button>
            </Link>
            <Link to="/contact">
              <Button 
                size="lg" 
                variant="outline"
                className="bg-transparent text-white border-white hover:bg-white hover:text-[#8B1538] text-lg px-8 py-6"
              >
                Contact Admissions Office
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-300 mt-4">
            For questions about enrollment, contact our Registrar's Office
          </p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}