import { Footer } from '../../components/Footer';
import { LandingNavbar } from '../../components/LandingNavbar';
import aboutPageHero from '../../../assets/aboutpage-C52rUoUG.png';
import svgPaths from '../../../imports/svg-avo07mw5zs';

export function AboutPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <LandingNavbar />

      {/* Main Content Container */}
      <div className="bg-[#f9fafb]">
        {/* Hero — full viewport below nav */}
        <section className="relative min-h-[calc(100dvh-4rem)] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              alt="About Hero Background"
              className="absolute h-full min-h-full w-full object-cover"
              src={aboutPageHero}
            />
          </div>

          <div className="absolute inset-0 bg-black/70" aria-hidden />

          <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[1280px] items-center px-8 py-8">
            {/* Red Background Box with Content */}
            <div className="relative w-full p-4 sm:p-8 lg:p-12">
              {/* Background layer with opacity */}
              <div className="absolute inset-0 rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-[#8b1538] opacity-50 shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]" />
              
              {/* Content layer at full opacity */}
              <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:gap-16">
                {/* Left Side - Heading */}
                <div className="shrink-0">
                  <h1 className="mb-1 font-[Inter] text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-[64px]">
                    About
                  </h1>
                  <p className="font-[Inter] text-5xl font-bold leading-none text-white sm:text-6xl lg:text-[96px]">
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
        <section className="mx-auto max-w-[1280px] px-8 py-16">
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