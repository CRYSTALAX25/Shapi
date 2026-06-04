// Parse a free-text headquarters string like "Riyadh, Saudi Arabia" into
// structured location fields ready to insert into the `locations` table.
//
// Used by:
//   • /api/company/spine/autofill-location  — pre-fills the new-location form
//   • /company/spine page                   — auto-promotes profile.location
//                                             to a primary `locations` row on
//                                             first visit to the spine
//
// The maps are intentionally small — MENA + South Asia + key Western/African
// markets only. Anything not in the map falls through: country=''/timezone=''
// and the user fills them in via the form.

const COUNTRY_TO_ISO: Record<string, string> = {
  'saudi arabia': 'SA', 'ksa': 'SA', 'kingdom of saudi arabia': 'SA',
  'united arab emirates': 'AE', 'uae': 'AE', 'emirates': 'AE',
  'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM',
  'yemen': 'YE', 'iraq': 'IQ', 'jordan': 'JO', 'lebanon': 'LB',
  'syria': 'SY', 'palestine': 'PS',
  'india': 'IN', 'pakistan': 'PK', 'bangladesh': 'BD',
  'philippines': 'PH', 'sri lanka': 'LK', 'nepal': 'NP',
  'egypt': 'EG', 'morocco': 'MA', 'algeria': 'DZ', 'tunisia': 'TN',
  'libya': 'LY', 'sudan': 'SD', 'kenya': 'KE', 'nigeria': 'NG',
  'south africa': 'ZA', 'ethiopia': 'ET', 'ghana': 'GH',
  'turkey': 'TR', 'germany': 'DE', 'france': 'FR', 'spain': 'ES',
  'italy': 'IT', 'netherlands': 'NL', 'belgium': 'BE', 'portugal': 'PT',
  'switzerland': 'CH', 'austria': 'AT', 'sweden': 'SE', 'norway': 'NO',
  'denmark': 'DK', 'finland': 'FI', 'poland': 'PL', 'ireland': 'IE',
  'united kingdom': 'GB', 'uk': 'GB', 'england': 'GB', 'scotland': 'GB',
  'united states': 'US', 'usa': 'US', 'us': 'US', 'america': 'US',
  'canada': 'CA', 'mexico': 'MX', 'brazil': 'BR', 'argentina': 'AR',
  'singapore': 'SG', 'malaysia': 'MY', 'indonesia': 'ID', 'thailand': 'TH',
  'vietnam': 'VN', 'hong kong': 'HK', 'china': 'CN', 'south korea': 'KR',
  'japan': 'JP', 'australia': 'AU', 'new zealand': 'NZ',
}

const CITY_TO_TZ: Record<string, string> = {
  'riyadh': 'Asia/Riyadh', 'jeddah': 'Asia/Riyadh', 'dammam': 'Asia/Riyadh',
  'mecca': 'Asia/Riyadh', 'medina': 'Asia/Riyadh', 'khobar': 'Asia/Riyadh',
  'dubai': 'Asia/Dubai', 'abu dhabi': 'Asia/Dubai', 'sharjah': 'Asia/Dubai',
  'ajman': 'Asia/Dubai',
  'doha': 'Asia/Qatar', 'kuwait city': 'Asia/Kuwait', 'manama': 'Asia/Bahrain',
  'muscat': 'Asia/Muscat', 'cairo': 'Africa/Cairo', 'alexandria': 'Africa/Cairo',
  'amman': 'Asia/Amman', 'beirut': 'Asia/Beirut',
  'istanbul': 'Europe/Istanbul', 'ankara': 'Europe/Istanbul',
  'mumbai': 'Asia/Kolkata', 'bangalore': 'Asia/Kolkata', 'delhi': 'Asia/Kolkata',
  'new delhi': 'Asia/Kolkata', 'chennai': 'Asia/Kolkata', 'hyderabad': 'Asia/Kolkata',
  'karachi': 'Asia/Karachi', 'lahore': 'Asia/Karachi', 'islamabad': 'Asia/Karachi',
  'dhaka': 'Asia/Dhaka', 'manila': 'Asia/Manila', 'colombo': 'Asia/Colombo',
  'kathmandu': 'Asia/Kathmandu',
  'london': 'Europe/London', 'manchester': 'Europe/London', 'edinburgh': 'Europe/London',
  'paris': 'Europe/Paris', 'berlin': 'Europe/Berlin', 'munich': 'Europe/Berlin',
  'madrid': 'Europe/Madrid', 'barcelona': 'Europe/Madrid',
  'milan': 'Europe/Rome', 'rome': 'Europe/Rome',
  'amsterdam': 'Europe/Amsterdam', 'lisbon': 'Europe/Lisbon',
  'zurich': 'Europe/Zurich', 'vienna': 'Europe/Vienna',
  'stockholm': 'Europe/Stockholm', 'oslo': 'Europe/Oslo',
  'copenhagen': 'Europe/Copenhagen', 'helsinki': 'Europe/Helsinki',
  'warsaw': 'Europe/Warsaw', 'dublin': 'Europe/Dublin',
  'new york': 'America/New_York', 'boston': 'America/New_York',
  'washington': 'America/New_York', 'miami': 'America/New_York',
  'chicago': 'America/Chicago', 'houston': 'America/Chicago',
  'dallas': 'America/Chicago', 'austin': 'America/Chicago',
  'los angeles': 'America/Los_Angeles', 'san francisco': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles',
  'toronto': 'America/Toronto', 'montreal': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'mexico city': 'America/Mexico_City', 'sao paulo': 'America/Sao_Paulo',
  'rio de janeiro': 'America/Sao_Paulo', 'buenos aires': 'America/Argentina/Buenos_Aires',
  'singapore': 'Asia/Singapore', 'kuala lumpur': 'Asia/Kuala_Lumpur',
  'jakarta': 'Asia/Jakarta', 'bangkok': 'Asia/Bangkok',
  'ho chi minh city': 'Asia/Ho_Chi_Minh', 'hanoi': 'Asia/Ho_Chi_Minh',
  'hong kong': 'Asia/Hong_Kong', 'beijing': 'Asia/Shanghai',
  'shanghai': 'Asia/Shanghai', 'seoul': 'Asia/Seoul',
  'tokyo': 'Asia/Tokyo', 'osaka': 'Asia/Tokyo',
  'sydney': 'Australia/Sydney', 'melbourne': 'Australia/Melbourne',
  'auckland': 'Pacific/Auckland',
  'nairobi': 'Africa/Nairobi', 'lagos': 'Africa/Lagos',
  'johannesburg': 'Africa/Johannesburg', 'cape town': 'Africa/Johannesburg',
  'casablanca': 'Africa/Casablanca', 'rabat': 'Africa/Casablanca',
  'tunis': 'Africa/Tunis', 'algiers': 'Africa/Algiers',
}

export type ParsedHQ = {
  city: string
  country: string  // ISO-3166-1 alpha-2 (empty if unrecognized)
  timezone: string  // IANA TZ (empty if unrecognized)
}

export function parseHQ(hq: string | null | undefined): ParsedHQ {
  if (!hq) return { city: '', country: '', timezone: '' }
  const parts = hq.split(/[,·]/).map(s => s.trim()).filter(Boolean)
  const cityRaw = parts[0] || ''
  const countryRaw = parts[parts.length - 1] || ''
  const cityLower = cityRaw.toLowerCase()
  const countryLower = countryRaw.toLowerCase()
  const country = COUNTRY_TO_ISO[countryLower]
    || (countryRaw.length === 2 ? countryRaw.toUpperCase() : '')
  const timezone = CITY_TO_TZ[cityLower] || ''
  return { city: cityRaw, country, timezone }
}
