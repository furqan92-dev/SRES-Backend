const normalize = (value) => {
  if (!value) return '';
  return value.toString().toLowerCase().trim().replace(/\s+/g, ' ');
};

const normalizeDescription = (description) => {
  return normalize(description)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const detectSuspiciousListing = (newListing, existingListings = []) => {
  const reasons = [];

  const newImages = Array.isArray(newListing?.images) ? newListing.images : [];
  const newDescription = normalizeDescription(newListing?.description || '');

  const duplicateImageMatches = existingListings.filter((listing) => {
    const existingImages = Array.isArray(listing?.images) ? listing.images : [];
    return newImages.some((image) => existingImages.includes(image));
  });

  if (duplicateImageMatches.length > 0) {
    reasons.push('duplicate_images');
  }

  const duplicateDescriptionMatches = existingListings.filter((listing) => {
    const existingDescription = normalizeDescription(listing?.description || '');
    if (!newDescription || !existingDescription) return false;

    const similarity = calculateSimilarity(newDescription, existingDescription);
    return similarity >= 0.95;
  });

  if (duplicateDescriptionMatches.length > 0) {
    reasons.push('duplicate_description');
  }

  return {
    suspicious: duplicateImageMatches.length > 0,
    reasons,
  };
};

const calculateSimilarity = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  const intersection = [...wordsA].filter((word) => wordsB.has(word)).length;
  const union = new Set([...wordsA, ...wordsB]).size;

  return union === 0 ? 0 : intersection / union;
};
