import { basename } from 'node:path';

const normalizedName = value => basename(String(value || '')).toLowerCase().replace(/[^a-z0-9]+/g, '');

const hasName = (files, part, role) => files.some(file =>
  (!role || file.role === role) && normalizedName(file.name).includes(part),
);

// These are intentionally filename-set matches, rather than visual guesses. A
// matching upload opens the established demo sample with its authored 2D/3D
// treatment. Everything else remains an independent review.
export function recognizedSampleUpload(files) {
  if (!Array.isArray(files)) return null;
  const dancingFishArtwork = hasName(files, 'dancingfishgranolaberryuscarton', 'artwork');
  const dancingFishSheet = hasName(files, 'dancingfishgranolaberrycrunchuscontentsheet', 'spec');
  if (dancingFishArtwork && dancingFishSheet) return 'organizer';

  const fielddayArtwork = hasName(files, 'fielddayv1', 'artwork');
  const fielddaySpec = hasName(files, 'productspec', 'spec');
  if (fielddayArtwork && fielddaySpec) return 'fieldday';

  return null;
}
