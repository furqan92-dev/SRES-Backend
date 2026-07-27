import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSuspiciousListing } from '../services/fraudDetection.service.js';

test('flags ads that reuse the same image across existing listings', () => {
  const result = detectSuspiciousListing(
    {
      description: 'Spacious 3 bedroom house in Gulberg Lahore with garden',
      images: ['data:image/jpeg;base64,abc123', 'data:image/jpeg;base64,def456'],
    },
    [
      {
        description: 'Luxury house in Bahria Town Rawalpindi',
        images: ['data:image/jpeg;base64,abc123'],
      },
    ]
  );

  assert.equal(result.suspicious, true);
  assert.ok(result.reasons.includes('duplicate_images'));
});

test('flags ads that reuse a near-identical description', () => {
  const result = detectSuspiciousListing(
    {
      description: 'Luxury 3 bedroom house in Gulberg Lahore with garden and parking',
      images: ['data:image/jpeg;base64,xyz789'],
    },
    [
      {
        description: 'Luxury 3 bedroom house in Gulberg Lahore with garden and parking',
        images: ['data:image/jpeg;base64,other'],
      },
    ]
  );

  assert.equal(result.suspicious, true);
  assert.ok(result.reasons.includes('duplicate_description'));
});

test('allows fresh listings with unique images and description', () => {
  const result = detectSuspiciousListing(
    {
      description: 'Beautiful family home near the lake with modern kitchen',
      images: ['data:image/jpeg;base64,new1', 'data:image/jpeg;base64,new2'],
    },
    [
      {
        description: 'Classic villa with large balcony in DHA',
        images: ['data:image/jpeg;base64,old1'],
      },
    ]
  );

  assert.equal(result.suspicious, false);
  assert.deepEqual(result.reasons, []);
});
