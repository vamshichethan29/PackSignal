import { basename } from 'node:path';
import { createHash } from 'node:crypto';

const normalizedName = value => basename(String(value || '')).toLowerCase().replace(/[^a-z0-9]+/g, '');

const hasName = (files, part, role) => files.some(file =>
  (!role || file.role === role) && normalizedName(file.name).includes(part),
);

const uploadedHash = file => {
  if (typeof file?.base64 !== 'string' || !file.base64) return null;
  return createHash('sha256').update(Buffer.from(file.base64, 'base64')).digest('hex');
};

const hasFingerprintSet = (files, fingerprints) =>
  fingerprints && Object.entries(fingerprints).every(([role, expected]) =>
    // The uploader initially labels every selected file as artwork. Match the
    // prepared pair by its bytes, not the temporary role a user sees in the
    // picker. Once recognised, the server replaces it with the preserved
    // sample files and their correct roles.
    files.some(file => uploadedHash(file) === expected),
  );

// These are exact file fingerprints, with filenames retained only as a
// convenience fallback for old clients. A matching upload opens the
// established demo sample with its authored 2D/3D treatment. Everything else
// remains an independent review.
export function recognizedSampleUpload(files, fingerprints = {}) {
  if (!Array.isArray(files)) return null;
  if (hasFingerprintSet(files, fingerprints.organizer)) return 'organizer';
  if (hasFingerprintSet(files, fingerprints.fieldday)) return 'fieldday';
  // Keep this legacy filename fallback for older browsers, but do not require
  // a role selection: the sample intake itself assigns its artwork and spec
  // roles after opening the known pair.
  const dancingFishArtwork = hasName(files, 'dancingfishgranolaberryuscarton');
  const dancingFishSheet = hasName(files, 'dancingfishgranolaberrycrunchuscontentsheet');
  if (dancingFishArtwork && dancingFishSheet) return 'organizer';

  const fielddayArtwork = hasName(files, 'fielddayv1', 'artwork');
  const fielddaySpec = hasName(files, 'productspec', 'spec');
  if (fielddayArtwork && fielddaySpec) return 'fieldday';

  return null;
}
