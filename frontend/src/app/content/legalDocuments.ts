export type LegalDocumentId = 'terms' | 'privacy' | 'dpa';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  id: LegalDocumentId;
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: LegalSection[];
};

const schoolName = 'Nuestra Señora De Guia Academy of Marikina (NSDGA)';
const portalName = 'IntelliDocs';

export const legalDocuments: Record<LegalDocumentId, LegalDocument> = {
  terms: {
    id: 'terms',
    title: 'Terms of Use',
    subtitle: `${portalName} student registration portal`,
    effectiveDate: 'June 1, 2026',
    sections: [
      {
        title: '1. Acceptance',
        paragraphs: [
          `By creating an account on ${portalName}, you agree to these Terms of Use on behalf of yourself (or your parent/guardian if you are a minor). ${schoolName} may update these terms; continued use after notice constitutes acceptance of the revised terms.`,
        ],
      },
      {
        title: '2. Eligibility and account security',
        paragraphs: [
          'Accounts are intended for prospective and enrolled students of NSDGA and their authorized guardians. You must provide accurate contact information and keep your password confidential. You are responsible for activity under your account until you report unauthorized access to the Registrar.',
        ],
      },
      {
        title: '3. Permitted use',
        paragraphs: [
          `You may use ${portalName} to submit enrollment documents, track application status, and communicate with school staff through official channels. You may not attempt to access other users' data, disrupt the service, upload malware, or use the portal for unlawful purposes.`,
        ],
      },
      {
        title: '4. Submitted documents',
        paragraphs: [
          'Documents you upload remain your responsibility. By submitting files, you represent that they are authentic copies (or clear scans) of records requested by the school. NSDGA may verify documents using automated checks and manual review. Fraudulent submissions may result in rejection of your application and referral to appropriate authorities.',
        ],
      },
      {
        title: '5. Intellectual property',
        paragraphs: [
          'The portal software, branding, and school-provided content are owned by NSDGA or its licensors. You receive a limited, non-exclusive license to use the portal for enrollment purposes only.',
        ],
      },
      {
        title: '6. Suspension and termination',
        paragraphs: [
          'NSDGA may suspend or deactivate accounts that violate these terms, pose a security risk, or remain inactive after enrollment decisions are finalized, subject to applicable school policies.',
        ],
      },
      {
        title: '7. Limitation of liability',
        paragraphs: [
          'The portal is provided on an "as available" basis. NSDGA is not liable for indirect damages arising from temporary outages, email delivery delays, or third-party service failures, except where liability cannot be excluded under Philippine law.',
        ],
      },
      {
        title: '8. Governing law',
        paragraphs: [
          'These terms are governed by the laws of the Republic of the Philippines. Disputes shall be brought before the proper courts of Marikina City, without prejudice to amicable resolution through the school Registrar.',
        ],
      },
      {
        title: '9. Contact',
        paragraphs: [
          'For questions about these Terms, contact the NSDGA Registrar at registrar@nsdga.edu.ph or visit the school at 96 Soliven St., Greenheights Subd., Ph. 3, Nangka, Marikina City.',
        ],
      },
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    subtitle: 'How we handle personal information (RA 10173)',
    effectiveDate: 'June 1, 2026',
    sections: [
      {
        title: '1. Data controller',
        paragraphs: [
          `${schoolName} is the personal information controller for data collected through ${portalName}. Our Data Protection Officer may be reached through the Registrar's office.`,
        ],
      },
      {
        title: '2. Information we collect',
        paragraphs: [
          'We collect account data (email, username, password hash), profile and enrollment form data (name, birthdate, address, guardian details, strand choices), uploaded documents (e.g., Form 137, birth certificate, good moral certificate), system logs (login times, IP address, device/browser type), and consent records (including DPA acceptance timestamps).',
        ],
      },
      {
        title: '3. Purposes of processing',
        paragraphs: [
          'We process your data to manage admission and enrollment, verify documents, issue school credentials, send OTP and status notifications, maintain security, comply with DepEd and school reporting requirements, and improve our services.',
        ],
      },
      {
        title: '4. Legal basis',
        paragraphs: [
          'Processing is based on your consent, performance of enrollment contracts, legitimate interests in securing our systems, and compliance with legal obligations under the Data Privacy Act of 2012 (RA 10173) and related issuances.',
        ],
      },
      {
        title: '5. Sharing and disclosure',
        paragraphs: [
          'We do not sell personal data. We may share information with authorized NSDGA personnel, cloud/email providers under data processing agreements, and government agencies when required by law. Document images may be analyzed by automated OCR/tamper-detection services hosted on secured infrastructure.',
        ],
      },
      {
        title: '6. Retention',
        paragraphs: [
          'Enrollment records are retained according to school retention schedules and applicable regulations. Account data may be archived after you are no longer an active applicant or student, unless a longer period is required by law.',
        ],
      },
      {
        title: '7. Your rights',
        paragraphs: [
          'Under RA 10173, you may request access, correction, suspension, withdrawal of consent (where applicable), or object to processing. Submit requests to the Registrar. We will respond within reasonable timeframes prescribed by law.',
        ],
      },
      {
        title: '8. Security',
        paragraphs: [
          'We implement access controls, encrypted transport (HTTPS), password hashing, activity logging, and role-based permissions. No method of transmission over the Internet is 100% secure; please use strong passwords and report suspected breaches promptly.',
        ],
      },
      {
        title: '9. Cookies and local storage',
        paragraphs: [
          'The portal may store session identifiers and preferences in your browser to keep you signed in and remember UI settings. You can clear browser storage, but you may need to sign in again.',
        ],
      },
      {
        title: '10. Updates',
        paragraphs: [
          'We may update this Privacy Policy. Material changes will be reflected on this page with a revised effective date.',
        ],
      },
    ],
  },
  dpa: {
    id: 'dpa',
    title: 'Data Processing Agreement (DPA)',
    subtitle: 'Consent for enrollment-related processing',
    effectiveDate: 'June 1, 2026',
    sections: [
      {
        title: '1. Parties',
        paragraphs: [
          `You ("Data Subject") consent to ${schoolName} ("School") processing your personal information through ${portalName} for admission and enrollment purposes.`,
        ],
      },
      {
        title: '2. Scope of processing',
        paragraphs: [
          'The School may collect, store, organize, update, retrieve, use, disclose (to authorized staff and processors), and delete personal data including biometric-free document images, contact details, academic records, and system audit logs necessary to evaluate and manage your application.',
        ],
      },
      {
        title: '3. Automated processing',
        paragraphs: [
          'Uploaded documents may be processed by automated tools for text extraction, quality checks, and tamper indicators. Results assist registrars but do not replace human decision-making on admission outcomes.',
        ],
      },
      {
        title: '4. Processors',
        paragraphs: [
          'The School may engage email, hosting, and AI/OCR service providers as personal information processors bound by confidentiality and security obligations consistent with RA 10173.',
        ],
      },
      {
        title: '5. Your obligations',
        paragraphs: [
          'You agree to provide truthful information and promptly notify the School of changes to contact details. If you are under 18, your parent or legal guardian must provide this consent on your behalf.',
        ],
      },
      {
        title: '6. Withdrawal of consent',
        paragraphs: [
          'You may withdraw consent by written request to the Registrar. Withdrawal may prevent us from continuing your application. Some records may still be retained where required by law or school policy.',
        ],
      },
      {
        title: '7. Record of consent',
        paragraphs: [
          'When you check the agreement boxes during registration, we store one consent record per account in our database (Terms of Use, Privacy Policy, and DPA flags, plus timestamp and IP address when available) as proof of consent.',
        ],
      },
    ],
  },
};

export function getLegalDocument(id: string): LegalDocument | null {
  if (id === 'terms' || id === 'privacy' || id === 'dpa') {
    return legalDocuments[id];
  }
  return null;
}
