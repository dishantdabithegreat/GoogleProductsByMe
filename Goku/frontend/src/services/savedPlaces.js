
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

// Common request handler
async function savedPlaceRequest(endpoint, token, options = {}) {
  const response = await fetch(`${API_URL}/saved-places${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Saved places request failed");
  }

  return data;
}

// Get all saved places
export async function getSavedPlaces(token) {
  const data = await savedPlaceRequest("", token);

  return data.places;
}

// Save a place
export async function savePlace(token, place) {
  const data = await savedPlaceRequest("", token, {
    method: "POST",
    body: JSON.stringify({
      placeId: place.id,
      name: place.name,
      address: place.address || "",
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.categories?.[0] || "Other",
      website: place.website || "",
      phone: place.phone || "",
    }),
  });

  return data.place;
}

// Remove a saved place
export async function removeSavedPlace(token, savedPlaceId) {
  return savedPlaceRequest(`/${encodeURIComponent(savedPlaceId)}`, token, {
    method: "DELETE",
  });
}


// Checking if already is a saved place
export async function isPlaceSaved(token, placeId) {
  const places = await getSavedPlaces(token);

  return places.find(
    (place) => place.placeId === placeId
  ) || null;
}
