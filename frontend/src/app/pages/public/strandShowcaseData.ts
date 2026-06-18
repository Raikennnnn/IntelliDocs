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
    title: 'HUMSS',
    description: 'Humanities, social sciences, communication, and liberal arts.',
    Icon: BookOpen,
  },
  {
    slug: 'abm',
    track: 'Academic',
    title: 'ABM',
    description: 'Business, accountancy, entrepreneurship, and management.',
    Icon: Briefcase,
  },
  {
    slug: 'stem',
    track: 'Academic',
    title: 'STEM',
    description: 'Science, technology, engineering, mathematics, and medicine.',
    Icon: Lightbulb,
  },
  {
    slug: 'ict',
    track: 'TVL',
    title: 'ICT',
    description: 'Programming, networking, and digital technologies.',
    Icon: Cpu,
  },
  {
    slug: 'eim',
    track: 'TVL',
    title: 'EIM',
    description: 'Electrical installation, wiring, and maintenance.',
    Icon: Zap,
  },
  {
    slug: 'bpp-fbs',
    track: 'TVL',
    title: 'BPP / FBS',
    description: 'Culinary arts, baking, and hospitality services.',
    Icon: UtensilsCrossed,
  },
];
