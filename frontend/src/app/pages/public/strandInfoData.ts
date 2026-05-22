export type StrandSlug = 'humss' | 'abm' | 'stem' | 'ict' | 'eim' | 'bpp-fbs';

export interface StrandInfo {
  slug: StrandSlug;
  title: string;
  shorthand: string;
  trackLabel: string;
  trackType: 'academic' | 'tvl';
  intro: string;
  overview: string[];
  focusAreas: string[];
  careers: string[];
  furtherStudy?: string[];
}

export const STRAND_SLUGS: StrandSlug[] = ['humss', 'abm', 'stem', 'ict', 'eim', 'bpp-fbs'];

export const STRAND_INFO: Record<StrandSlug, StrandInfo> = {
  humss: {
    slug: 'humss',
    title: 'Humanities and Social Sciences',
    shorthand: 'HUMSS',
    trackLabel: 'Academic Track',
    trackType: 'academic',
    intro:
      'HUMSS develops strong reading, writing, research, and critical thinking skills through the lens of people, society, and culture.',
    overview: [
      'You will engage with literature, history, philosophy, politics, and communication—disciplines that help explain how communities work and how ideas shape the world.',
      'This strand is a strong fit if you see yourself in education, law, public service, media, psychology, or the liberal arts at the tertiary level.',
    ],
    focusAreas: [
      'Reading, writing, and argumentation',
      'Social sciences and civic awareness',
      'Creative and media-based communication',
      'Research and inquiry skills',
    ],
    careers: [
      'Teacher / educator',
      'Lawyer (with further study)',
      'Writer, editor, or journalist',
      'Psychologist or counselor (with further study)',
      'Public administration and NGO work',
    ],
    furtherStudy: ['BA programs in Political Science, Psychology, Communication, Education, and related fields'],
  },
  abm: {
    slug: 'abm',
    title: 'Accountancy, Business, and Management',
    shorthand: 'ABM',
    trackLabel: 'Academic Track',
    trackType: 'academic',
    intro:
      'ABM introduces how organizations create value: accounting fundamentals, marketing, entrepreneurship, and how financial decisions support business goals.',
    overview: [
      'You will practice basic bookkeeping and financial literacy, explore how products reach customers, and learn what it takes to plan and pitch a small venture.',
      'The strand suits learners who enjoy organizing information, working with numbers, and leading projects or teams.',
    ],
    focusAreas: [
      'Financial literacy and fundamentals of accounting',
      'Marketing, operations, and business models',
      'Entrepreneurship and business planning',
      'Ethics, teamwork, and professional communication',
    ],
    careers: [
      'Accountant (with further study and licensure)',
      'Entrepreneur or business owner',
      'Banking, finance, and sales roles',
      'Marketing and brand coordination',
      'Human resources and office administration',
    ],
    furtherStudy: ['BS Accountancy, BSBA majors (Marketing, Financial Management, Human Resource, etc.)'],
  },
  stem: {
    slug: 'stem',
    title: 'Science, Technology, Engineering, and Mathematics',
    shorthand: 'STEM',
    trackLabel: 'Academic Track',
    trackType: 'academic',
    intro:
      'STEM builds scientific literacy, mathematical reasoning, and problem-solving habits used in engineering, health sciences, computing, and research.',
    overview: [
      'You will deepen skills in mathematics and laboratory sciences, interpret data, and model real-world situations—foundations for technical college programs.',
      'Choose STEM if you are curious about how things work, enjoy experiments or coding, and want flexible pathways into high-demand fields.',
    ],
    focusAreas: [
      'Advanced mathematics and scientific inquiry',
      'Physics, chemistry, and life sciences concepts',
      'Engineering design habits and technology applications',
      'Data literacy and logical reasoning',
    ],
    careers: [
      'Engineer (with further study)',
      'Medical doctor or allied health professional (with further study)',
      'Data analyst or software developer (with further study)',
      'Research and laboratory careers',
      'Environmental and sustainability roles',
    ],
    furtherStudy: ['BS Engineering, BS Computer Science, BS Biology/Chemistry, BS Nursing (per college prerequisites), etc.'],
  },
  ict: {
    slug: 'ict',
    title: 'Information and Communications Technology',
    shorthand: 'ICT',
    trackLabel: 'Technical-Vocational-Livelihood (TVL)',
    trackType: 'tvl',
    intro:
      'ICT focuses on how computers, networks, and software work together so learners can support digital systems in school, community, or workplace settings.',
    overview: [
      'Hands-on topics typically include computer assembly and maintenance, networking basics, programming logic, and productivity tools used in modern offices.',
      'TVL ICT can lead to national certifications (NC) that recognize skills employers value, alongside options to continue in IT-related college programs.',
    ],
    focusAreas: [
      'Computer systems and troubleshooting',
      'Networking concepts and basic configuration',
      'Programming logic and simple application development',
      'Digital citizenship and workplace productivity tools',
    ],
    careers: [
      'Technical support specialist',
      'Junior network or systems assistant',
      'Web or software junior roles (with portfolio / further study)',
      'Freelance IT services for small businesses',
    ],
    furtherStudy: ['BS Information Technology, BS Computer Science, and related ladderized programs where offered'],
  },
  eim: {
    slug: 'eim',
    title: 'Electrical Installation and Maintenance',
    shorthand: 'EIM',
    trackLabel: 'Technical-Vocational-Livelihood (TVL)',
    trackType: 'tvl',
    intro:
      'EIM trains safe practices in residential and commercial electrical wiring, fault finding, and maintenance aligned to industry standards.',
    overview: [
      'You will read plans and symbols, select materials, install and test circuits, and maintain equipment while following occupational health and safety rules.',
      'This strand suits learners who prefer concrete tasks, working with tools, and clear procedures that connect directly to trade and industry jobs.',
    ],
    focusAreas: [
      'Electrical theory and safety',
      'Wiring methods and conduit installation',
      'Troubleshooting and preventive maintenance',
      'Use of measuring instruments and codes of practice',
    ],
    careers: [
      'Electrician (with certification and apprenticeship)',
      'Maintenance technician in facilities or manufacturing',
      'Assistant in construction and MEP teams',
    ],
    furtherStudy: ['Electrical engineering technology programs and trade ladderization where available'],
  },
  'bpp-fbs': {
    slug: 'bpp-fbs',
    title: 'Bread and Pastry Production / Food and Beverage Services',
    shorthand: 'BPP / FBS',
    trackLabel: 'Technical-Vocational-Livelihood (TVL)',
    trackType: 'tvl',
    intro:
      'This specialization combines kitchen production skills with front-of-house service so learners understand both how food is made and how guests are cared for.',
    overview: [
      'Bread and Pastry Production covers mixing methods, baking, plating, and quality checks; Food and Beverage Services covers service sequence, sanitation, and guest experience.',
      'Expect a mix of kitchen lab work, service simulations, and lessons on hygiene, costing, and teamwork in hospitality settings.',
    ],
    focusAreas: [
      'Baking and pastry fundamentals',
      'Menu knowledge and food safety (HACCP basics)',
      'Table service, beverage service, and guest handling',
      'Costing, portion control, and workplace communication',
    ],
    careers: [
      'Commis baker or pastry assistant',
      'Restaurant or café service staff',
      'Catering and banquet support roles',
      'Hotel food and beverage operations (entry level)',
    ],
    furtherStudy: ['BS Hospitality Management, Culinary Arts programs, and entrepreneurship in food business'],
  },
};

export function isStrandSlug(value: string | undefined): value is StrandSlug {
  return value != null && STRAND_SLUGS.includes(value as StrandSlug);
}
