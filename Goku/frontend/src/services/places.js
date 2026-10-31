
const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

const BASE_URL = "https://api.geoapify.com";

export const PLACE_CATEGORIES = {
  Restaurants: ["catering.restaurant"],
  Cafes: ["catering.cafe"],
  Hospitals: ["healthcare.hospital"],
  Shopping: [
    "commercial.shopping_mall",
    "commercial.marketplace",
    "commercial.supermarket",
  ],
  Hotels: [
    "accommodation.hotel",
    "accommodation.guest_house",
    "accommodation.hostel",
  ],
  Tourism: [
    "tourism.attraction",
    "tourism.sights",
    "entertainment.museum",
    "entertainment.culture",
  ],
};

function checkAPIKey() {
  if (!API_KEY) {
    throw new Error("Geoapify API key is missing.");
  }
}

function normalizePlace(feature) {
  const properties = feature.properties || {};
  const coordinates = feature.geometry?.coordinates || [];

  return {
    id: properties.place_id || properties.osm_id,
    name:
      properties.name ||
      properties.address_line1 ||
      properties.formatted ||
      "Unnamed place",
    address:
      properties.formatted ||
      properties.address_line2 ||
      "Address unavailable",
    longitude: coordinates[0],
    latitude: coordinates[1],
    categories: properties.categories || [],
    category: properties.categories?.[0] || "Place",
    distance: properties.distance ?? null,
    phone: properties.datasource?.raw?.phone || null,
    website: properties.datasource?.raw?.website || null,
    openingHours:
      properties.datasource?.raw?.opening_hours || null,
    rating: properties.datasource?.raw?.rating || null,
    reviewCount:
      properties.datasource?.raw?.review_count || null,
    description: null,
    photos: [],
    videos: [],
    reviews: [],
  };
}

// Discover places around a selected location.
export async function getNearbyPlaces({
  longitude,
  latitude,
  category,
  signal,
  radius = 5000,
  limit = 30,
}) {
  checkAPIKey();

  const categories = PLACE_CATEGORIES[category];

  if (!categories) {
    throw new Error(`Unsupported category: ${category}`);
  }

  const params = new URLSearchParams({
    categories: categories.join(","),
    filter: `circle:${longitude},${latitude},${radius}`,
    bias: `proximity:${longitude},${latitude}`,
    limit: String(limit),
    lang: "en",
    apiKey: API_KEY,
  });

  const response = await fetch(
    `${BASE_URL}/v2/places?${params}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(
      `Nearby places request failed: ${response.status}`
    );
  }

  const data = await response.json();

  return (data.features || []).map(normalizePlace);
}

// Search cities, localities, streets, landmarks and businesses.
export async function searchPlaces(query, {
  longitude,
  latitude,
  signal,
  limit = 10,
} = {}) {
  checkAPIKey();

  const trimmedQuery = query?.trim();

  if (!trimmedQuery || trimmedQuery.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    text: trimmedQuery,
    format: "geojson",
    limit: String(limit),
    lang: "en",
    apiKey: API_KEY,
  });

  if (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude)
  ) {
    params.set(
      "bias",
      `proximity:${longitude},${latitude}`
    );
  }

  const response = await fetch(
    `${BASE_URL}/v1/geocode/search?${params}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(`Place search failed: ${response.status}`);
  }

  const data = await response.json();

  return (data.features || []).map(normalizePlace);
}

// Identify an address or locality from a clicked map coordinate.
export async function reverseGeocode({
  longitude,
  latitude,
  signal,
}) {
  checkAPIKey();

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "geojson",
    lang: "en",
    apiKey: API_KEY,
  });

  const response = await fetch(
    `${BASE_URL}/v1/geocode/reverse?${params}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(
      `Reverse geocoding failed: ${response.status}`
    );
  }

  const data = await response.json();

  const feature = data.features?.[0];

  if (!feature) {
    return null;
  }

  return normalizePlace(feature);
}

// Get nearby recommendations for a place.
export async function getNearbyRecommendations({
  longitude,
  latitude,
  signal,
}) {
  const categories = [
    "Hotels",
    "Restaurants",
    "Cafes",
    "Tourism",
  ];

  const results = await Promise.all(
    categories.map(async (category) => {
      try {
        const places = await getNearbyPlaces({
          longitude,
          latitude,
          category,
          signal,
          radius: 5000,
          limit: 10,
        });

        return {
          category,
          places,
        };
      } catch (error) {
        if (error.name === "AbortError") {
          throw error;
        }

        return {
          category,
          places: [],
        };
      }
    })
  );

  return Object.fromEntries(
    results.map((result) => [
      result.category,
      result.places,
    ])
  );
}
