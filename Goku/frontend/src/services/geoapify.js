
const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

const GEOCODING_URL =
  "https://api.geoapify.com/v1/geocode/autocomplete";

export async function searchPlaces(query, signal) {
  if (!API_KEY || API_KEY === "your_actual_api_key_here") {
    throw new Error("Geoapify API key is missing. Check frontend/.env.");
  }

  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  const normalizedQuery = trimmedQuery.toLowerCase();
  const isJaipur = normalizedQuery === "jaipur";

  const params = new URLSearchParams({
    text: isJaipur
      ? "Jaipur, Rajasthan, India"
      : trimmedQuery,
    apiKey: API_KEY,
    limit: "10",
    format: "geojson",
    filter: "countrycode:in",
    lang: "en",
  });

  // IMPORTANT:
  // Do not set type=city here.
  // Autocomplete must be allowed to return cities, suburbs,
  // neighbourhoods, streets, buildings and individual places.

  const response = await fetch(
    `${GEOCODING_URL}?${params.toString()}`,
    { signal }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      errorData.message ||
        `Location search failed (${response.status}).`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data.features)) {
    return [];
  }

  let results = data.features
    .map((feature) => {
      const properties = feature.properties || {};
      const coordinates = feature.geometry?.coordinates;

      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2
      ) {
        return null;
      }

      const longitude = Number(coordinates[0]);
      const latitude = Number(coordinates[1]);

      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude)
      ) {
        return null;
      }

      return {
        id:
          properties.place_id ||
          properties.osm_id ||
          `${longitude}-${latitude}`,

        name:
          properties.name ||
          properties.address_line1 ||
          properties.formatted ||
          "Unknown location",

        address:
          properties.formatted ||
          properties.address_line2 ||
          properties.name ||
          "Address unavailable",

        longitude,
        latitude,

        resultType: properties.result_type || "",
        state: properties.state || "",
        city:
          properties.city ||
          properties.town ||
          properties.village ||
          "",

        country: properties.country || "",

        confidence:
          Number(properties.rank?.confidence) || 0,
      };
    })
    .filter(Boolean);

  // Keep Jaipur results within Rajasthan.
  if (isJaipur) {
    results = results.filter((place) => {
      const state = place.state.toLowerCase();
      const country = place.country.toLowerCase();

      return (
        state.includes("rajasthan") &&
        country.includes("india")
      );
    });
  }

  // Preserve Geoapify's relevance ordering.
  // Do not sort alphabetically or force city results.

  return results.slice(0, 8);
}
