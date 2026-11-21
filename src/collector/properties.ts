/**
 * The four Azzurro properties from the brief.
 *
 * `assessmentLabel` is the name used in ASSESSMENT.md; `displayName` is the
 * live name on booking.com. They differ for every property, which is why the
 * URL slug — not the name — is the stable identity.
 *
 * bookingHotelId is discovered at collection time from the page's own GraphQL
 * call, so it is optional here; 16211291 for Olympic Paddington was captured
 * during the Milestone 1 spike.
 */
export type PropertyConfig = {
  slug: string;
  assessmentLabel: string;
  displayName: string;
  url: string;
};

export const PROPERTIES: PropertyConfig[] = [
  {
    slug: 'olympic-paddington',
    assessmentLabel: 'Olympic Hotel Paddington',
    displayName: 'Olympic Paddington Budget Hotel - across Allianz Stadium',
    url: 'https://www.booking.com/hotel/au/olympic-paddington.html',
  },
  {
    slug: 'venus-potts-point-sydney',
    assessmentLabel: 'Potts Point',
    displayName: 'Venus Potts Point',
    url: 'https://www.booking.com/hotel/au/venus-potts-point-sydney.html',
  },
  {
    slug: 'venus-surry-hills',
    assessmentLabel: 'Central Sydney',
    displayName: 'Venus Surry Hills',
    url: 'https://www.booking.com/hotel/au/venus-surry-hills.html',
  },
  {
    slug: 'chateau-de-venus',
    assessmentLabel: 'Darling Harbour',
    displayName: 'Azzurro Pod Hotel Darling Harbour - Near Convention Center',
    url: 'https://www.booking.com/hotel/au/chateau-de-venus.html',
  },
];
