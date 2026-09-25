/**
 * Static geography + the story cast. Coordinates are approximate area centres;
 * Banani Road 11 / Mohakhali / Gulshan 1 are the ones the fare and matching
 * examples in docs/design.md are computed from — change them and the docs change.
 */

export interface SeedZone {
  code: string;
  name: string;
  subLocations: { code: string; name: string; lat: number; lng: number }[];
}

export const ZONES: SeedZone[] = [
  {
    code: 'BANANI_GULSHAN',
    name: 'Banani – Gulshan',
    subLocations: [
      { code: 'BANANI_RD_11', name: 'Banani Road 11', lat: 23.794, lng: 90.4043 },
      { code: 'BANANI_RD_27', name: 'Banani Road 27', lat: 23.7925, lng: 90.401 },
      { code: 'GULSHAN_1', name: 'Gulshan 1', lat: 23.7805, lng: 90.4163 },
      { code: 'GULSHAN_2', name: 'Gulshan 2', lat: 23.7925, lng: 90.4148 },
      { code: 'NIKETAN', name: 'Niketan', lat: 23.7728, lng: 90.411 },
      { code: 'BARIDHARA', name: 'Baridhara', lat: 23.8, lng: 90.421 },
    ],
  },
  {
    code: 'MOHAKHALI_TEJGAON',
    name: 'Mohakhali – Tejgaon',
    subLocations: [
      { code: 'MOHAKHALI', name: 'Mohakhali', lat: 23.7784, lng: 90.4 },
      { code: 'MOHAKHALI_DOHS', name: 'Mohakhali DOHS', lat: 23.784, lng: 90.395 },
      { code: 'TEJGAON', name: 'Tejgaon', lat: 23.764, lng: 90.392 },
      { code: 'FARMGATE', name: 'Farmgate', lat: 23.7575, lng: 90.39 },
      { code: 'KARWAN_BAZAR', name: 'Karwan Bazar', lat: 23.751, lng: 90.393 },
    ],
  },
  {
    code: 'UTTARA_AIRPORT',
    name: 'Uttara – Airport',
    subLocations: [
      { code: 'UTTARA_S7', name: 'Uttara Sector 7', lat: 23.871, lng: 90.398 },
      { code: 'UTTARA_S11', name: 'Uttara Sector 11', lat: 23.876, lng: 90.388 },
      { code: 'AIRPORT', name: 'Airport', lat: 23.851, lng: 90.408 },
      { code: 'KHILKHET', name: 'Khilkhet', lat: 23.829, lng: 90.42 },
    ],
  },
  {
    code: 'MIRPUR',
    name: 'Mirpur – Agargaon',
    subLocations: [
      { code: 'MIRPUR_1', name: 'Mirpur 1', lat: 23.795, lng: 90.353 },
      { code: 'MIRPUR_10', name: 'Mirpur 10', lat: 23.8069, lng: 90.3687 },
      { code: 'MIRPUR_12', name: 'Mirpur 12', lat: 23.826, lng: 90.365 },
      { code: 'KAZIPARA', name: 'Kazipara', lat: 23.798, lng: 90.372 },
      { code: 'AGARGAON', name: 'Agargaon', lat: 23.778, lng: 90.379 },
    ],
  },
  {
    code: 'DHANMONDI',
    name: 'Dhanmondi – Mohammadpur',
    subLocations: [
      { code: 'DHANMONDI_27', name: 'Dhanmondi 27', lat: 23.756, lng: 90.375 },
      { code: 'DHANMONDI_32', name: 'Dhanmondi 32', lat: 23.7515, lng: 90.378 },
      { code: 'LALMATIA', name: 'Lalmatia', lat: 23.758, lng: 90.368 },
      { code: 'MOHAMMADPUR', name: 'Mohammadpur', lat: 23.762, lng: 90.358 },
      { code: 'SCIENCE_LAB', name: 'Science Lab', lat: 23.7385, lng: 90.383 },
      { code: 'NEW_MARKET', name: 'New Market', lat: 23.733, lng: 90.384 },
    ],
  },
  {
    code: 'BADDA_BASHUNDHARA',
    name: 'Badda – Bashundhara',
    subLocations: [
      { code: 'BADDA', name: 'Badda', lat: 23.78, lng: 90.426 },
      { code: 'RAMPURA', name: 'Rampura', lat: 23.761, lng: 90.421 },
      { code: 'BASHUNDHARA', name: 'Bashundhara R/A', lat: 23.819, lng: 90.435 },
      { code: 'AFTABNAGAR', name: 'Aftabnagar', lat: 23.767, lng: 90.439 },
    ],
  },
];

/** Every demo account shares this password (documented in the README). */
export const DEMO_PASSWORD = 'oitesla123';

export const PASSENGERS = [
  // Nusrat, already late for Mohakhali.
  { name: 'Nusrat', phoneNumber: '01711000001', walletBalancePaisa: 50_000 },
  // Rafiq, the "total stranger" heading to Gulshan 1.
  { name: 'Rafiq', phoneNumber: '01711000002', walletBalancePaisa: 50_000 },
  // Shirin, going for the last seat — with only ৳40 in TeslaPay.
  { name: 'Shirin', phoneNumber: '01711000003', walletBalancePaisa: 4_000 },
];

export const DRIVERS = [
  {
    name: 'Jashim',
    phoneNumber: '01811000001',
    licenseNumber: 'DHK-TESLA-0001',
    startsOnlineAt: 'BANANI_RD_11',
    vehicle: { modelName: 'Bullet', plateNumber: 'DHAKA-TESLA-11-0001', capacity: 3 },
  },
];
