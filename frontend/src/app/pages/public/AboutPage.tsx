import { Link } from 'react-router';
import { Footer } from '../../components/Footer';
import imgImageNuestraSenoraDeGuiaAcademy from '../../../assets/logo.png';
import aboutPageHero from '../../../assets/aboutpage.jpg';
import svgPaths from '../../../imports/svg-avo07mw5zs';

export function AboutPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Navigation */}
      <div className="bg-[rgba(255,255,255,0.95)] h-[64px] shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)] sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between px-8">
          {/* Logo */}
          <Link to="/landing" className="flex items-center gap-3">
            {/* TODO: Replace with official NSGDA logo image */}
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

      {/* Main Content Container */}
      <div className="bg-[#f9fafb]">
        {/* Hero Section with Background Image */}
        <section className="relative h-[600px] overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* TODO: Replace with legitimate hero background photo (e.g., school building) */}
            <img 
              alt="About Hero Background" 
              className="absolute h-full w-full object-cover" 
              src={aboutPageHero} 
            />
          </div>

          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black/70" />

          {/* Hero Content */}
          <div className="relative h-full max-w-[1280px] mx-auto px-8 flex items-center">
            {/* Red Background Box with Content */}
            <div className="relative w-full p-12">
              {/* Background layer with opacity */}
              <div className="absolute inset-0 bg-[#8b1538] border-[0.909px] border-[rgba(0,0,0,0.1)] border-solid opacity-50 rounded-[14px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] m-[0px] p-[100px]" />
              
              {/* Content layer at full opacity */}
              <div className="relative flex items-center gap-16">
                {/* Left Side - Heading */}
                <div className="flex-shrink-0">
                  <h1 className="font-bold text-[64px] text-white leading-[1.1] mb-2 font-[Inter]">
                    About
                  </h1>
                  <p className="font-bold text-[96px] text-white leading-[1] font-[Inter]">
                    NSDGA
                  </p>
                </div>

                {/* Right Side - Description Text */}
                <div className="flex-1">
                  <div className="font-normal text-[16px] text-white leading-[26px] text-justify space-y-4">
                    <p>
                      <span className="font-bold">NUESTRA SEÑORA DE GUIA ACADEMY OF MARIKINA</span> is a non-sectarian non-Catholic school primarily centered to the child's total personality development with spiritual and ethical values in order to live up to the aspiration of our patron, NUESTRA SEÑORA DE GUIA.
                    </p>
                    <p>
                      Inspired by the admonition of the Holy Bible: <span className="font-bold">"To train up a child the way he should go; and when he is old, he will not depart from it." (Prov. 22:6)</span>, the school emphasizes on the need for growth and the holistic development of the child. <span className="font-bold">NUESTRA SEÑORA DE GUIA ACADEMY OF MARIKINA</span> considers the child as the centerpiece of its foundation and organization. Thus, it commits itself to providing the child with quality education in the service of humanity and God.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission and Vision Cards */}
        <section className="max-w-[1280px] mx-auto px-8 py-16">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Mission Card */}
            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-[#8b1538] rounded-full size-[64px] flex items-center justify-center">
                  <svg className="size-[32px]" fill="none" viewBox="0 0 32 32">
                    <g>
                      <path 
                        d={svgPaths.p2eeb1a00} 
                        stroke="white" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2.66" 
                      />
                      <path 
                        d={svgPaths.p12cd9a80} 
                        stroke="white" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2.66" 
                      />
                      <path 
                        d={svgPaths.p68ddbf0} 
                        stroke="white" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2.66" 
                      />
                    </g>
                  </svg>
                </div>
                <h2 className="font-bold text-[24px] text-[#101828] leading-[32px]">
                  Mission
                </h2>
              </div>
              <p className="font-normal text-[16px] text-[#364153] leading-[26px]">
                Nuestra Señora De Guia Academy of Marikina shall provide quality education to prepare young children to harness their full intellectual capabilities that will aid them to effectively plot the paths they wish to stride later in life.
              </p>
            </div>

            {/* Vision Card */}
            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-[#2d5016] rounded-full size-[64px] flex items-center justify-center">
                  <svg className="size-[32px]" fill="none" viewBox="0 0 32 32">
                    <g>
                      <path 
                        d={svgPaths.p1e55af00} 
                        stroke="white" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2.66" 
                      />
                      <path 
                        d={svgPaths.p3dc23ac0} 
                        stroke="white" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2.66" 
                      />
                    </g>
                  </svg>
                </div>
                <h2 className="font-bold text-[24px] text-[#101828] leading-[32px]">
                  Vision
                </h2>
              </div>
              <p className="font-normal text-[16px] text-[#364153] leading-[26px]">
                Nuestra Senora De Guia Academy of Marikina shall be the epitome of <span className="font-bold">ACADEMIC EXCELLENCE</span> by providing quality education relevant to the changing needs of the society.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}