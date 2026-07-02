import {
  BookOpen,
  Briefcase,
  Cpu,
  Lightbulb,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import type { StrandShowcaseItem } from '../components/public/StrandShowcaseCard';

export const STRAND_SHOWCASE_ITEMS: StrandShowcaseItem[] = [
  {
    slug: 'humss',
    track: 'Academic',
    title: 'ASSH',
    description: 'Arts, Social Sciences, and Humanities.',
    Icon: BookOpen,
  },
  {
    slug: 'abm',
    track: 'Academic',
    title: 'BAE',
    description: 'Business and Entrepreneurship.',
    Icon: Briefcase,
  },
  {
    slug: 'stem',
    track: 'Academic',
    title: 'STEM',
    description: 'Science, Technology, Engineering, and Mathematics (STEM).',
    Icon: Lightbulb,
  },
  {
    slug: 'ict',
    track: 'TECHPRO',
    title: 'CP',
    description: 'Computer Programming.',
    Icon: Cpu,
  },
  {
    slug: 'eim',
    track: 'TECHPRO',
    title: 'IT',
    description: 'Industrial Technologies.',
    Icon: Zap,
  },
  {
    slug: 'bpp-fbs',
    track: 'TECHPRO',
    title: 'HT',
    description: 'Hospitality and Tourism.',
    Icon: UtensilsCrossed,
  },
];
