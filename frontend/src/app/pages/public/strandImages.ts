import type { StrandSlug } from './strandInfoData';
import humssPlaceholder from '../../assets/strands/humss.svg';
import abmPlaceholder from '../../assets/strands/abm.svg';
import stemPlaceholder from '../../assets/strands/stem.svg';
import ictPlaceholder from '../../assets/strands/ict.svg';
import eimPlaceholder from '../../assets/strands/eim.svg';
import bppFbsPlaceholder from '../../assets/strands/bpp-fbs.svg';

/** Bundled placeholders shown until a file exists in public/strands/ */
export const STRAND_PLACEHOLDER_IMAGES: Record<StrandSlug, string> = {
  humss: humssPlaceholder,
  abm: abmPlaceholder,
  stem: stemPlaceholder,
  ict: ictPlaceholder,
  eim: eimPlaceholder,
  'bpp-fbs': bppFbsPlaceholder,
};

const STRAND_IMAGE_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png'] as const;

/** Public-folder paths tried before the bundled placeholder (Vite base URL aware). */
export function strandImageSources(slug: StrandSlug): string[] {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const fromPublic = STRAND_IMAGE_EXTENSIONS.map((ext) => `${base}strands/${slug}.${ext}`);
  return [...fromPublic, STRAND_PLACEHOLDER_IMAGES[slug]];
}
