/**
 * Operational topic classification.
 *
 * Method: a curated keyword/phrase lexicon matched on word boundaries, run
 * SEPARATELY over the "liked" and "disliked" text booking.com already gives us.
 * That split is what makes this defensible without a model — we are not
 * guessing sentiment, we are reading which side of the review a topic appeared
 * on. A review praising the location and complaining about noise produces
 * location/positive and noise/negative, so mixed feedback needs no special case.
 *
 * Known limitations (measured, see README):
 *   - English only. Non-English reviews match nothing and are excluded from
 *     topic percentages rather than counted as "no issues".
 *   - Paraphrasing is missed: "the room smelled" only matches via "smell".
 *   - Negation is not handled: "not clean" and "very clean" both match
 *     cleanliness. Polarity comes from which field the text sits in, not from
 *     the wording, which is why that is tolerable here.
 */
export const TOPICS = [
  'cleanliness',
  'check_in',
  'staff',
  'noise',
  'facilities',
  'location',
  'room_condition',
  'value',
] as const;

export type Topic = (typeof TOPICS)[number];
export type Polarity = 'positive' | 'negative';

export const TOPIC_LABELS: Record<Topic, string> = {
  cleanliness: 'Cleanliness',
  check_in: 'Check-in',
  staff: 'Staff & reception',
  noise: 'Noise',
  facilities: 'Facilities',
  location: 'Location',
  room_condition: 'Room condition',
  value: 'Value for money',
};

/**
 * Terms are matched whole-word. Deliberately excluded: the bare word "room",
 * which appears in most reviews and would make room_condition meaningless.
 */
const LEXICON: Record<Topic, string[]> = {
  cleanliness: [
    'clean', 'cleaned', 'cleaning', 'cleanliness', 'unclean', 'spotless', 'immaculate',
    'dirty', 'filthy', 'grubby', 'grime', 'dust', 'dusty', 'stain', 'stains', 'stained',
    'smell', 'smelly', 'smelt', 'stink', 'odour', 'odor', 'mould', 'mold', 'mouldy', 'moldy',
    'hygiene', 'hygienic', 'unhygienic', 'sticky', 'cockroach', 'cockroaches', 'roach',
    'bedbug', 'bedbugs', 'bed bug', 'bed bugs', 'insect', 'insects', 'hair', 'hairs',
    'housekeeping', 'rubbish', 'tidy', 'untidy', 'messy',
  ],
  check_in: [
    'check in', 'check-in', 'checkin', 'checked in', 'check out', 'check-out', 'checkout',
    'checked out', 'arrival', 'arriving', 'front desk', 'self check-in', 'self checkin',
    'key', 'keys', 'keycard', 'key card', 'access code', 'lockbox', 'lock box',
    'queue', 'queued', 'early check', 'late check',
  ],
  staff: [
    'staff', 'receptionist', 'reception', 'host', 'hosts', 'manager', 'management',
    'friendly', 'unfriendly', 'rude', 'helpful', 'unhelpful', 'polite', 'impolite',
    'welcoming', 'attitude', 'service', 'concierge', 'team', 'courteous',
  ],
  noise: [
    'noise', 'noisy', 'loud', 'quiet', 'silent', 'peaceful', 'soundproof', 'soundproofing',
    'sound proof', 'thin walls', 'could hear', 'hear everything', 'music', 'party',
    'shouting', 'yelling', 'snoring', 'traffic',
  ],
  facilities: [
    'wifi', 'wi-fi', 'internet', 'lift', 'elevator', 'kitchen', 'kitchenette', 'laundry',
    'pool', 'gym', 'parking', 'car park', 'aircon', 'air con', 'air-con', 'air conditioning',
    'heating', 'heater', 'fan', 'tv', 'television', 'fridge', 'refrigerator', 'microwave',
    'kettle', 'breakfast', 'restaurant', 'bar', 'facilities', 'amenities',
  ],
  location: [
    'location', 'located', 'close to', 'near', 'nearby', 'walk', 'walking distance',
    'station', 'transport', 'bus', 'train', 'tram', 'central', 'centre', 'center',
    // Bare 'area' was removed after evaluation: 25 of 189 location tags came from
    // it, and most were 'dining area' / 'communal area' / 'sitting area', which are
    // facilities, not location. Precision matters more than recall here — a wrong
    // tag misleads staff more than a missed one does.
    'convenient', 'local area', 'surrounding area', 'neighbourhood', 'neighborhood',
    'airport', 'far from',
  ],
  room_condition: [
    'bed', 'beds', 'mattress', 'pillow', 'pillows', 'sheets', 'linen', 'bathroom',
    'shower', 'toilet', 'towel', 'towels', 'window', 'windows', 'door', 'furniture',
    'carpet', 'wall', 'walls', 'ceiling', 'broken', 'worn', 'old', 'dated', 'tired',
    'cramped', 'tiny', 'spacious', 'leak', 'leaking', 'hot water', 'maintenance',
    'repair', 'damaged', 'refurbish', 'renovated',
  ],
  value: [
    'value', 'value for money', 'price', 'priced', 'pricey', 'expensive', 'cheap',
    'overpriced', 'worth', 'money', 'cost', 'affordable', 'bargain', 'rip off', 'ripoff',
  ],
};

const escapeRegex = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Longest terms first so "value for money" wins over "value" as the shown term. */
const COMPILED: Array<{ topic: Topic; term: string; re: RegExp }> = TOPICS.flatMap((topic) =>
  [...LEXICON[topic]]
    .sort((a, b) => b.length - a.length)
    .map((term) => ({ topic, term, re: new RegExp(`\\b${escapeRegex(term)}\\b`, 'i') })),
);

export type TopicMatch = { topic: Topic; term: string };

/** Topics mentioned in a piece of text, with the term that triggered each. */
export function classifyText(text: string | null | undefined): TopicMatch[] {
  if (!text) return [];
  const found = new Map<Topic, string>();
  for (const { topic, term, re } of COMPILED) {
    if (!found.has(topic) && re.test(text)) found.set(topic, term);
  }
  return [...found].map(([topic, term]) => ({ topic, term }));
}

export type ReviewTopic = { topic: Topic; polarity: Polarity; matchedTerm: string };

/**
 * Classify one review. Positive and negative text are classified independently,
 * so the same review can praise and complain about different things.
 */
export function classifyReview(review: {
  positive_text?: string | null;
  negative_text?: string | null;
  lang?: string | null;
}): ReviewTopic[] {
  // Only English is supported; see limitations above.
  if (review.lang && review.lang !== 'en') return [];

  return [
    ...classifyText(review.positive_text).map(
      (m): ReviewTopic => ({ topic: m.topic, polarity: 'positive', matchedTerm: m.term }),
    ),
    ...classifyText(review.negative_text).map(
      (m): ReviewTopic => ({ topic: m.topic, polarity: 'negative', matchedTerm: m.term }),
    ),
  ];
}

/** True when a review can contribute to topic percentages at all. */
export function isClassifiable(review: {
  positive_text?: string | null;
  negative_text?: string | null;
  lang?: string | null;
}): boolean {
  if (review.lang && review.lang !== 'en') return false;
  return Boolean(review.positive_text || review.negative_text);
}
