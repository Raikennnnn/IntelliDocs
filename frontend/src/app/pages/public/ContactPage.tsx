import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { MapPin, Phone, Mail, Clock, Building } from 'lucide-react';

export function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <LandingNavbar />

      {/* Hero Section */}
      <section className="bg-[#8B1538] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-gray-200">
            Get in touch with us for inquiries, enrollment, and support
          </p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Single Box Layout */}
          <Card className="shadow-xl border-[0.909px] border-[rgba(0,0,0,0.1)] max-w-5xl mx-auto">
            <CardContent className="p-12">
              <div className="grid md:grid-cols-2 gap-8">
                {/* School Address */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#8B1538] rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#101828] mb-2">School Address</h3>
                    <p className="text-[#364153] leading-relaxed">
                      <strong>Nuestra Señora De Guia Academy</strong><br />
                      96 soliven st., Greenheights Subd., Ph. 3, Nangka, Marikina City, Philippines
                    </p>
                  </div>
                </div>

                {/* Office Hours */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#2D5016] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#101828] mb-2">Office Hours</h3>
                    <p className="text-[#364153] leading-relaxed">
                      <strong>Monday – Friday</strong><br />
                      8:00 AM – 5:00 PM
                    </p>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#8B1538] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#101828] mb-2">Phone Number</h3>
                    <p className="text-[#364153] leading-relaxed">
                      Contact us for inquiries<br />
                      <strong>535-4384 | 719-3744</strong>
                    </p>
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#2D5016] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#101828] mb-2">Email Address</h3>
                    <p className="text-[#364153] leading-relaxed">
                      Send us your questions<br />
                      <strong>nsdga.gh@gmail.com</strong>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Additional Information */}
      <section className="py-16 bg-[#8B1538] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Have Questions?</h2>
          <p className="text-lg text-gray-200 mb-6">
            Our staff is here to help you with any inquiries about enrollment, programs, or 
            general information about the academy.
          </p>
          <p className="text-gray-300">
            Please visit us during office hours or contact us through the information provided above.
          </p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}