import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import imgImageNuestraSenoraDeGuiaAcademy from 'figma:asset/e11655a0bb448323cab4def085b422d71c615f64.png';
import img6425705401609027733346922618764889990646353N1 from 'figma:asset/ec0f266d7e7cff918808f5daaab9064f36194772.png';
import svgPaths from '../../../imports/svg-01fncooay9';

export function LandingPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Navigation */}
      <div className="bg-[rgba(255,255,255,0.95)] h-[64px] shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)] sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between px-8">
          {/* Logo */}
          {/* TODO: Replace with official NSGDA logo image */}
          <Link to="/landing" className="flex items-center gap-3">
            <div className="size-[40px]">
              <img 
                alt="School Logo" 
                className="w-full h-full object-contain" 
                src={imgImageNuestraSenoraDeGuiaAcademy} 
              />
            </div>
            <div>
              <p className="font-bold text-[18px] text-[#8b1538] leading-tight">
                Nuestra Señora De Guia
              </p>
              <p className="font-semibold text-[12px] text-[#2d5016]">
                Academy of Marikina
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-8">
            <Link to="/landing" className="font-medium text-[16px] text-[#364153] hover:text-[#8b1538]">
              Home
            </Link>
            <Link to="/about" className="font-medium text-[16px] text-[#364153] hover:text-[#8b1538]">
              About
            </Link>
            <Link to="/admissions" className="font-medium text-[16px] text-[#364153] hover:text-[#8b1538]">
              Admissions
            </Link>
            <Link to="/contact" className="font-medium text-[16px] text-[#364153] hover:text-[#8b1538]">
              Contact Us
            </Link>
            <Link to="/login">
              <div className="bg-[#2d5016] h-[36px] rounded-[8px] px-6 flex items-center justify-center hover:bg-[#2d5016]/90 transition-colors">
                <p className="font-medium text-[14px] text-white">Login</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative h-[600px] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* TODO: Replace with legitimate hero background photo (e.g., school campus) */}
          <img 
            alt="Hero Background" 
            className="absolute h-full w-full object-cover" 
            src={img6425705401609027733346922618764889990646353N1} 
          />
        </div>

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Hero Content */}
        <div className="relative h-full max-w-[1280px] mx-auto px-8">
          <div className="pt-[90px] max-w-[768px]">
            <p className="font-semibold text-[20px] text-white leading-[28px] mb-4">
              WELCOME TO
            </p>
            <h1 className="font-bold text-[60px] text-white leading-[75px] mb-6 max-w-[672px]">
              Nuestra Señora De Guia Academy Marikina
            </h1>
            <p className="font-semibold text-[24px] text-white leading-[32px] mb-12">
              Senior High School
            </p>

            {/* CTA Buttons */}
            <div className="flex gap-4">
              <div>
                <Link to="/admissions">
                  <div className="bg-[#8b1538] h-[48px] rounded-[8px] px-6 flex items-center justify-center hover:bg-[#8b1538]/90 transition-colors">
                    <p className="font-medium text-[18px] text-white">Apply Now</p>
                  </div>
                </Link>
                <p className="font-normal text-[12px] text-[#d1d5dc] leading-[16px] mt-2">
                  Not yet enrolled?
                </p>
              </div>

              <div>
                <Link to="/login">
                  <div className="bg-[rgba(255,255,255,0.9)] border border-white h-[50px] rounded-[8px] px-6 flex items-center justify-center hover:bg-white transition-colors">
                    <p className="font-medium text-[18px] text-[#8b1538]">Login</p>
                  </div>
                </Link>
                <p className="font-normal text-[12px] text-[#d1d5dc] leading-[16px] mt-2">For already have portal access</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Strands Section */}
      <section className="bg-white py-16">
        <div className="max-w-[1280px] mx-auto px-8">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="font-bold text-[36px] text-[#8b1538] leading-[40px] mb-4">
              Academic Strands
            </h2>
            <p className="font-normal text-[16px] text-[#4a5565] leading-[24px]">
              Choose your path to success
            </p>
          </div>

          {/* Strands Grid */}
          <div className="grid md:grid-cols-2 gap-8 max-w-[1106px] mx-auto">
            {/* Academic Track */}
            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-8 shadow-lg">
              {/* Icon */}
              <div className="bg-[#8b1538] rounded-[10px] size-[64px] mb-6 flex items-center justify-center">
                <svg className="size-[32px]" fill="none" viewBox="0 0 32 32">
                  <g>
                    <path d={svgPaths.p27718b80} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d="M29.323 13.329V21.326" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d={svgPaths.p291942c0} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                  </g>
                </svg>
              </div>

              <h3 className="font-bold text-[24px] text-[#8b1538] leading-[32px] mb-4">
                Academic Track
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-[14px] text-[#101828] mb-1">
                    Humanities and Social Sciences (HUMSS)
                  </p>
                  <p className="font-normal text-[13px] text-[#4a5565] leading-[20px]">
                    Focuses on human behavior, societal structures, and communication arts.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-[14px] text-[#101828] mb-1">
                    Accountancy, Business, and Management (ABM)
                  </p>
                  <p className="font-normal text-[13px] text-[#4a5565] leading-[20px]">
                    Ideal for students aiming for careers in business and entrepreneurship.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-[14px] text-[#101828] mb-1">
                    Science, Technology, Engineering, and Mathematics (STEM)
                  </p>
                  <p className="font-normal text-[13px] text-[#4a5565] leading-[20px]">
                    Designed for students pursuing careers in engineering, medicine, and IT.
                  </p>
                </div>
              </div>
            </div>

            {/* TVL Track */}
            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-8 shadow-lg">
              {/* Icon */}
              <div className="bg-[#2d5016] rounded-[10px] size-[64px] mb-6 flex items-center justify-center">
                <svg className="size-[32px]" fill="none" viewBox="0 0 32 32">
                  <g>
                    <path d={svgPaths.p27718b80} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d="M29.323 13.329V21.326" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                    <path d={svgPaths.p291942c0} stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66" />
                  </g>
                </svg>
              </div>

              <h3 className="font-bold text-[24px] text-[#2d5016] leading-[32px] mb-4">
                Technical-Vocational-Livelihood (TVL)
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-[14px] text-[#101828] mb-1">
                    Information and Communications Technology (ICT)
                  </p>
                  <p className="font-normal text-[13px] text-[#4a5565] leading-[20px]">
                    Focuses on computer systems, programming, and digital technologies.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-[14px] text-[#101828] mb-1">
                    Electrical Installation and Maintenance (EIM)
                  </p>
                  <p className="font-normal text-[13px] text-[#4a5565] leading-[20px]">
                    Covers electrical wiring, troubleshooting, and maintenance systems.
                  </p>
                </div>
                <div>
                  <p className="font-bold text-[14px] text-[#101828] mb-1">
                    Bread and Pastry Production / Food and Beverages Services (BPP/FBS)
                  </p>
                  <p className="font-normal text-[13px] text-[#4a5565] leading-[20px]">
                    Training in culinary arts, baking, and hospitality services.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#8b1538] py-16">
        <div className="max-w-[1280px] mx-auto px-8 text-center">
          <h2 className="font-bold text-[36px] text-white leading-[40px] mb-4">
            Ready to Begin Your Journey?
          </h2>
          <p className="font-normal text-[18px] text-[#e5e7eb] leading-[28px] mb-8">
            Join our community of learners committed to excellence and values-driven education.
          </p>
          <Link to="/admissions">
            <div className="bg-white h-[48px] rounded-[8px] px-8 inline-flex items-center justify-center hover:bg-gray-100 transition-colors">
              <p className="font-medium text-[18px] text-[#8b1538]">Learn More</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}