import { Link } from 'react-router';
import schoolLogo from '../../assets/logo.png';
import { BRAND } from '../lib/publicBrand';

export function Footer() {
  return (
    <footer style={{ backgroundColor: BRAND.ink }}>
      <div className="section-container py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <img alt="NSDGA" className="size-8 object-contain" src={schoolLogo} />
              <div>
                <p className="text-sm font-bold text-white">Nuestra Señora De Guia</p>
                <p className="text-xs text-white/60">Academy of Marikina</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-white/55">
              Senior High School — Grades 11 &amp; 12 with online enrollment and registrar support.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-bold text-white">Quick Links</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link to="/landing" className="text-white/55 hover:text-white">
                Home
              </Link>
              <Link to="/admissions" className="text-white/55 hover:text-white">
                Admissions
              </Link>
              <Link to="/about" className="text-white/55 hover:text-white">
                About
              </Link>
              <Link to="/contact" className="text-white/55 hover:text-white">
                Contact
              </Link>
              <Link to="/login" className="text-white/55 hover:text-white">
                Student Portal
              </Link>
              <Link to="/registration" className="text-white/55 hover:text-white">
                Enroll Now
              </Link>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-bold text-white">Registrar</h4>
            <ul className="space-y-2 text-sm text-white/55">
              <li>96 Soliven St., Greenheights Subd., Ph. 3, Nangka, Marikina City</li>
              <li>Mon – Fri · 8:00 AM – 5:00 PM</li>
              <li>registrar@nsdga.edu.ph</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-white/45">
          © 2026 Nuestra Señora De Guia Academy. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
