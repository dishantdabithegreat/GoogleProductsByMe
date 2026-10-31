
const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;
const ROUTING_URL = "https://api.geoapify.com/v1/routing";

const SUPPORTED_MODES = ["drive", "bicycle", "walk"];

function normalizeMode(mode) {
  const aliases = {
    car: "drive",
    bike: "bicycle",
    walking: "walk",
  };

  return aliases[mode] || mode;
}

function normalizeLocation(location, label) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      `Invalid coordinates for ${label}. Select this location again.`
    );
  }

  return {
    ...location,
    latitude,
    longitude,
  };
}

function validateGeometry(geometry) {
  if (!geometry) {
    throw new Error("The routing service returned no route geometry.");
  }

  function validPosition(position) {
    return (
      Array.isArray(position) &&
      position.length >= 2 &&
      Number.isFinite(Number(position[0])) &&
      Number.isFinite(Number(position[1])) &&
      Number(position[0]) >= -180 &&
      Number(position[0]) <= 180 &&
      Number(position[1]) >= -90 &&
      Number(position[1]) <= 90
    );
  }

  if (geometry.type === "LineString") {
    if (
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2 ||
      !geometry.coordinates.every(validPosition)
    ) {
      throw new Error("The route contains invalid coordinates.");
    }

    return;
  }

  if (geometry.type === "MultiLineString") {
    const valid =
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.length > 0 &&
      geometry.coordinates.every(
        (line) =>
          Array.isArray(line) &&
          line.length >= 2 &&
          line.every(validPosition)
      );

    if (!valid) {
      throw new Error("The route contains invalid coordinates.");
    }

    return;
  }

  throw new Error(
    `Unsupported route geometry: ${geometry.type || "unknown"}.`
  );
}

async function readApiError(response) {
  let data;

  try {
    data = await response.json();
  } catch {
    return `Routing API error (${response.status}).`;
  }

  return (
    data.message ||
    data.error ||
    data.details ||
    `Routing API error (${response.status}).`
  );
}

async function requestRoute({
  locations,
  type,
  mode,
  signal,
}) {
  // Geoapify waypoint order is latitude,longitude.
  const waypoints = locations
    .map(
      ({ latitude, longitude }) =>
        `${latitude},${longitude}`
    )
    .join("|");

  const params = new URLSearchParams({
    waypoints,
    mode,
    type,
    format: "geojson",
    apiKey: API_KEY,
  });

  const response = await fetch(
    `${ROUTING_URL}?${params.toString()}`,
    { signal }
  );

  if (!response.ok) {
    const message = await readApiError(response);
    throw new Error(message);
  }

  const data = await response.json();

  if (
    data.type !== "FeatureCollection" ||
    !Array.isArray(data.features) ||
    data.features.length === 0
  ) {
    throw new Error("No route was found between these locations.");
  }

  return data.features.map((feature) => {
    const properties = feature.properties || {};
    const geometry = feature.geometry;

    validateGeometry(geometry);

    const distance = Number(properties.distance);
    const time = Number(properties.time);

    if (
      !Number.isFinite(distance) ||
      distance < 0 ||
      !Number.isFinite(time) ||
      time < 0
    ) {
      throw new Error(
        "The routing service returned invalid distance or travel time."
      );
    }

    return {
      geometry,
      distance,
      time,
      legs: properties.legs || [],
      raw: properties,
      type,
      mode,
    };
  });
}

export async function getRoutes({
  origin,
  destination,
  stops = [],
  mode = "drive",
  signal,
}) {
  if (!API_KEY) {
    throw new Error(
      "Geoapify API key is missing. Check frontend/.env."
    );
  }

  const normalizedMode = normalizeMode(mode);

  if (!SUPPORTED_MODES.includes(normalizedMode)) {
    throw new Error(
      `Unsupported travel mode: ${mode}. Use car, bike or walk.`
    );
  }

  if (!Array.isArray(stops)) {
    throw new Error("Route stops must be an array.");
  }

  const locations = [
    normalizeLocation(origin, "starting location"),
    ...stops.map((stop, index) =>
      normalizeLocation(stop, `stop ${index + 1}`)
    ),
    normalizeLocation(destination, "destination"),
  ];

  if (locations.length < 2) {
    throw new Error("Select a starting point and destination.");
  }

  // Avoid sending consecutive duplicate coordinates.
  for (let index = 1; index < locations.length; index += 1) {
    const previous = locations[index - 1];
    const current = locations[index];

    if (
      previous.latitude === current.latitude &&
      previous.longitude === current.longitude
    ) {
      throw new Error(
        `Two consecutive route points are identical. Check stop ${index}.`
      );
    }
  }

  if (signal?.aborted) {
    throw new DOMException("Route request cancelled.", "AbortError");
  }

  // Ask for two route types. If one fails, retain the successful result.
  const results = await Promise.allSettled([
    requestRoute({
      locations,
      type: "balanced",
      mode: normalizedMode,
      signal,
    }),
    requestRoute({
      locations,
      type: "short",
      mode: normalizedMode,
      signal,
    }),
  ]);

  if (signal?.aborted) {
    throw new DOMException("Route request cancelled.", "AbortError");
  }

  const successfulRoutes = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);

  if (successfulRoutes.length === 0) {
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason?.message)
      .filter(Boolean);

    throw new Error(
      errors.join(" | ") || "Unable to calculate this route."
    );
  }

  // Remove duplicate alternatives.
  const uniqueRoutes = successfulRoutes.filter(
    (route, index, routes) =>
      routes.findIndex(
        (candidate) =>
          candidate.distance === route.distance &&
          candidate.time === route.time
      ) === index
  );

  const fastest = [...uniqueRoutes].sort(
    (a, b) => a.time - b.time
  )[0];

  const shortest = [...uniqueRoutes].sort(
    (a, b) => a.distance - b.distance
  )[0];

  return {
    fastest,
    shortest,
    alternatives: uniqueRoutes,
    mode: normalizedMode,
  };
}

export async function getDrivingRoutes(options) {
  return getRoutes({
    ...options,
    mode: "drive",
  });
}
