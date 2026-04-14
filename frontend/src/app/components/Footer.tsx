import { Link } from 'react-router';
import schoolLogo from '../../assets/logo.png';

export function Footer() {
  return (
    <footer className="bg-[#101828] py-4">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="grid md:grid-cols-3 gap-6 mb-4">
          {/* School Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="size-[28px]">
                <img 
                  alt="School Logo" 
                  className="w-full h-full object-contain" 
                  src={schoolLogo} 
                />
              </div>
              <div>
                <p className="font-bold text-[13px] text-white leading-tight">
                  Nuestra Señora De Guia
                </p>
                <p className="font-normal text-[11px] text-[#99a1af]">
                  Academy of Marikina
                </p>
              </div>
            </div>
            <p className="font-normal text-[11px] text-[#99a1af] leading-[16px]">
              Empowering students through quality education, strong values, and innovative learning pathways for a brighter future.
            </p>
          </div>

          {/* Quick Links - 2 Columns */}
          <div>
            <h4 className="font-bold text-[13px] text-white mb-2">Quick Links</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <Link to="/landing" className="font-normal text-[11px] text-[#99a1af] hover:text-white transition-colors">
                Home
              </Link>
              <Link to="/admissions" className="font-normal text-[11px] text-[#99a1af] hover:text-white transition-colors">
                Admissions
              </Link>
              <Link to="/about" className="font-normal text-[11px] text-[#99a1af] hover:text-white transition-colors">
                About Us
              </Link>
              <Link to="/contact" className="font-normal text-[11px] text-[#99a1af] hover:text-white transition-colors">
                Contact
              </Link>
              <Link to="/login" className="font-normal text-[11px] text-[#99a1af] hover:text-white transition-colors">
                Student Portal
              </Link>
              <Link to="/register" className="font-normal text-[11px] text-[#99a1af] hover:text-white transition-colors">
                Enroll Now
              </Link>
            </div>
          </div>

          {/* Contact Us */}
          <div>
            <h4 className="font-bold text-[13px] text-white mb-2">Contact Us</h4>
            <ul className="space-y-1.5">
              <li className="font-normal text-[11px] text-[#99a1af] leading-[16px]">
                <span className="font-semibold text-white block mb-0.5">Address:</span>
                96 Soliven St., Greenheights Subd., Ph. 3, Nangka, Marikina City, Philippines
              </li>
              <li className="font-normal text-[11px] text-[#99a1af]">
                <span className="font-semibold text-white block mb-0.5">Office Hours:</span>
                Monday - Friday | 8:00 AM - 5:00 PM
              </li>
              <li className="font-normal text-[11px] text-[#99a1af]">
                <span className="font-semibold text-white block mb-0.5">Email:</span>
                registrar@nsdga.edu.ph
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-[#1e2939] pt-3">
          <p className="font-normal text-[11px] text-[#99a1af] text-center">
            © 2026 Nuestra Señora De Guia Academy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}