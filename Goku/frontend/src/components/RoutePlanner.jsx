
import { useEffect, useRef, useState } from "react";

import {
  Bike,
  Car,
  CircleDot,
  Clock,
  Footprints,
  GripVertical,
  LoaderCircle,
  MapPin,
  LocateFixed,
  Navigation,
  Plus,
  Route,
  X,
} from "lucide-react";

import { getRoutes } from "../services/routing";
import "./RoutePlanner.css";

const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

const AUTOCOMPLETE_URL =
  "https://api.geoapify.com/v1/geocode/autocomplete";

const MODES = [
  { id: "drive", label: "Car", Icon: Car },
  { id: "motorcycle", label: "Bike", Icon: Bike },
  { id: "bicycle", label: "Cycle", Icon: Bike },
  { id: "walk", label: "Walk", Icon: Footprints },
];

function createPoint(name = "", latitude = null, longitude = null) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    latitude,
    longitude,
  };
}

function hasValidCoordinates(point) {
  return (
    point &&
    point.latitude !== null &&
    point.longitude !== null &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

function formatDistance(meters) {
  if (!Number.isFinite(Number(meters))) return "N/A";

  const value = Number(meters);

  return value >= 1000
    ? `${(value / 1000).toFixed(1)} km`
    : `${Math.round(value)} m`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds))) return "N/A";

  const minutes = Math.round(Number(seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${minutes} min`;

  return remainingMinutes
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}

function parseFeature(feature) {
  const properties = feature.properties || {};
  const coordinates = feature.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
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
    id: properties.place_id || `${longitude}-${latitude}`,
    name:
      properties.name ||
      properties.address_line1 ||
      properties.formatted ||
      "Unknown location",
    address: properties.formatted || "",
    longitude,
    latitude,
  };
}

export default function RoutePlanner({
  onRoutesFound,
  onSelectRoute,
  onClose,
  initialDestination,
}) {
  const [points, setPoints] = useState([
    createPoint(),
    createPoint(),
  ]);

  const [activeIndex, setActiveIndex] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const [mode, setMode] = useState("drive");
  const [routes, setRoutes] = useState(null);
  const [selectedType, setSelectedType] = useState("fastest");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [locationLoadingIndex, setLocationLoadingIndex] = useState(null);

  const searchAbortRef = useRef(null);
  const routeAbortRef = useRef(null);
  const lastDestinationRef = useRef(null);

  // The first completed route in a directions session may fit the map.
  // Subsequent recalculations must not keep moving the camera.
  const hasFittedInitialRouteRef = useRef(false);

  // Keep the latest callbacks without restarting route calculations.
  const onRoutesFoundRef = useRef(onRoutesFound);
  const onSelectRouteRef = useRef(onSelectRoute);

  useEffect(() => {
    onRoutesFoundRef.current = onRoutesFound;
    onSelectRouteRef.current = onSelectRoute;
  }, [onRoutesFound, onSelectRoute]);

  // Populate destination when Directions is opened from Place Details.
  useEffect(() => {
    if (!initialDestination) return;

    const name =
      initialDestination.name ||
      initialDestination.address ||
      "";

    const latitude =
      initialDestination.latitude != null
        ? Number(initialDestination.latitude)
        : null;

    const longitude =
      initialDestination.longitude != null
        ? Number(initialDestination.longitude)
        : null;

    const destinationKey =
      initialDestination.id ||
      `${name}-${latitude}-${longitude}`;

    if (lastDestinationRef.current === destinationKey) return;

    lastDestinationRef.current = destinationKey;
    hasFittedInitialRouteRef.current = false;

    setPoints((previous) => {
      const updated = [...previous];
      const lastIndex = updated.length - 1;

      updated[lastIndex] = {
        ...updated[lastIndex],
        name,
        latitude:
          latitude !== null && Number.isFinite(latitude)
            ? latitude
            : null,
        longitude:
          longitude !== null && Number.isFinite(longitude)
            ? longitude
            : null,
      };

      return updated;
    });

    setRoutes(null);
    setError("");
    setSelectedType("fastest");
  }, [
    initialDestination?.id,
    initialDestination?.name,
    initialDestination?.address,
    initialDestination?.latitude,
    initialDestination?.longitude,
  ]);

  // Autocomplete for the currently active location field.
  useEffect(() => {
    if (activeIndex === null) {
      setSuggestions([]);
      setSuggestionLoading(false);
      return;
    }

    const query = points[activeIndex]?.name?.trim() || "";

    searchAbortRef.current?.abort();

    if (!API_KEY || query.length < 2) {
      setSuggestions([]);
      setSuggestionLoading(false);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;

    const timeout = setTimeout(async () => {
      setSuggestionLoading(true);

      try {
        const params = new URLSearchParams({
          text: query,
          apiKey: API_KEY,
          limit: "8",
          format: "geojson",
          filter: "countrycode:in",
          lang: "en",
        });

        const response = await fetch(
          `${AUTOCOMPLETE_URL}?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Location suggestions could not be loaded.");
        }

        const data = await response.json();

        const results = (data.features || [])
          .map(parseFeature)
          .filter(Boolean);

        if (!controller.signal.aborted) {
          setSuggestions(results);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Goku autocomplete error:", err);
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggestionLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [activeIndex, points]);

  function updatePoint(index, changes) {
    setPoints((previous) =>
      previous.map((point, currentIndex) =>
        currentIndex === index
          ? { ...point, ...changes }
          : point
      )
    );

    setRoutes(null);
    setError("");
  }

  function selectSuggestion(place, index) {
    updatePoint(index, {
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    });

    setActiveIndex(null);
    setSuggestions([]);
  }

  function addStop(afterIndex) {
    const newPoint = createPoint();

    setPoints((previous) => {
      const updated = [...previous];
      updated.splice(afterIndex + 1, 0, newPoint);
      return updated;
    });

    setRoutes(null);
    setError("");
    setActiveIndex(afterIndex + 1);

    requestAnimationFrame(() => {
      const input = document.querySelector(
        `[data-route-point="${newPoint.id}"] input`
      );

      input?.focus();
    });
  }

  function removeStop(index) {
    if (index === 0 || index === points.length - 1) return;

    setPoints((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index)
    );

    setActiveIndex(null);
    setSuggestions([]);
    setRoutes(null);
    setError("");
  }

  // Drag and drop: reorder route points.
  function handleDragStart(event, index) {
    setDraggedIndex(index);

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event, targetIndex) {
    event.preventDefault();

    const sourceIndex = draggedIndex;

    if (
      sourceIndex === null ||
      sourceIndex === targetIndex
    ) {
      setDraggedIndex(null);
      return;
    }

    setPoints((previous) => {
      const updated = [...previous];
      const [movedPoint] = updated.splice(sourceIndex, 1);

      updated.splice(targetIndex, 0, movedPoint);

      return updated;
    });

    setDraggedIndex(null);
    setActiveIndex(null);
    setSuggestions([]);
    setRoutes(null);
    setError("");
  }

  function handleDragEnd() {
    setDraggedIndex(null);
  }

  // Browser geolocation followed by reverse geocoding.
  async function useCurrentLocation(index) {
    if (!navigator.geolocation) {
      setError("Your browser does not support location access.");
      return;
    }

    setLocationLoadingIndex(index);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        let locationName = "Your location";

        try {
          if (API_KEY) {
            const params = new URLSearchParams({
              lat: String(latitude),
              lon: String(longitude),
              format: "json",
              apiKey: API_KEY,
            });

            const response = await fetch(
              `https://api.geoapify.com/v1/geocode/reverse?${params}`
            );

            if (response.ok) {
              const data = await response.json();

              locationName =
                data.results?.[0]?.formatted ||
                "Your location";
            }
          }
        } catch (err) {
          console.error("Reverse geocoding error:", err);
        }

        updatePoint(index, {
          name: locationName,
          latitude,
          longitude,
        });

        setActiveIndex(null);
        setSuggestions([]);
        setLocationLoadingIndex(null);
      },
      (err) => {
        console.error("Geolocation error:", err);

        setError(
          err.code === 1
            ? "Location permission was denied. Allow location access in your browser."
            : "Unable to get your current location."
        );

        setLocationLoadingIndex(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  }

  // AUTOMATIC ROUTE CALCULATION.
  // Runs when all points are valid or when the travel mode changes.
  useEffect(() => {
    routeAbortRef.current?.abort();

    const allPointsValid =
      points.length >= 2 &&
      points.every(
        (point) =>
          point.name.trim() &&
          hasValidCoordinates(point)
      );

    if (!allPointsValid) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    routeAbortRef.current = controller;

    const timeout = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const locations = points.map((point) => ({
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          name: point.name,
        }));

        const origin = locations[0];
        const destination = locations[locations.length - 1];
        const stops = locations.slice(1, -1);

        const result = await getRoutes({
          origin,
          destination,
          stops,
          mode,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!result?.fastest && !result?.shortest) {
          throw new Error("No routes were found for these locations.");
        }

        const defaultType = result.fastest
          ? "fastest"
          : "shortest";

        setRoutes(result);
        setSelectedType(defaultType);

        const routePayload = {
          ...result,
          origin,
          destination,
          stops,
          points: locations,
        };

        const shouldFitBounds =
          !hasFittedInitialRouteRef.current;

        if (shouldFitBounds) {
          hasFittedInitialRouteRef.current = true;
        }

        onRoutesFoundRef.current?.(routePayload, {
          fitBounds: shouldFitBounds,
        });

        onSelectRouteRef.current?.(
          result[defaultType],
          defaultType
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Goku route calculation error:", err);
          setRoutes(null);
          setError(
            err.message || "Could not calculate the route."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [points, mode]);

  // Select fastest or shortest after routes have been calculated.
  function chooseRoute(type) {
    const route = routes?.[type];

    if (!route) return;

    setSelectedType(type);
    onSelectRouteRef.current?.(route, type);
  }

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      routeAbortRef.current?.abort();
    };
  }, []);

  return (
    <section className="route-planner">
      <header className="route-planner-header">
        <div>
          <h2>
            <Route size={21} />
            Plan your route
          </h2>
          <p>Add destinations and arrange your journey.</p>
        </div>

        <button
          type="button"
          className="route-close-button"
          onClick={onClose}
          aria-label="Close directions"
        >
          <X size={20} />
        </button>
      </header>

      <div className="route-points-list">
        {points.map((point, index) => {
          const isFirst = index === 0;
          const isLast = index === points.length - 1;
          const isActive = activeIndex === index;

          const label = isFirst
            ? "FROM"
            : isLast
              ? "TO"
              : `STOP ${index}`;

          return (
            <div
              key={point.id}
              className="route-point-wrapper"
              data-route-point={point.id}
              onDragOver={handleDragOver}
              onDrop={(event) => handleDrop(event, index)}
            >
              <div
                className={`route-point ${
                  draggedIndex === index ? "dragging" : ""
                }`}
              >
                <button
                  type="button"
                  className="route-drag-handle"
                  draggable
                  onDragStart={(event) =>
                    handleDragStart(event, index)
                  }
                  onDragEnd={handleDragEnd}
                  aria-label={`Drag ${point.name || label} to reorder`}
                  title="Drag to reorder"
                >
                  <GripVertical size={19} />
                </button>

                <span
                  className={`route-point-icon ${
                    isFirst
                      ? "route-origin-icon"
                      : isLast
                        ? "route-destination-icon"
                        : "route-stop-icon"
                  }`}
                >
                  {isFirst ? (
                    <CircleDot size={19} />
                  ) : isLast ? (
                    <Navigation size={19} />
                  ) : (
                    <MapPin size={19} />
                  )}
                </span>

                <div className="route-point-field">
                  <label>{label}</label>

                  <input
                    type="text"
                    value={point.name}
                    placeholder={
                      isFirst
                        ? "Choose starting point"
                        : isLast
                          ? "Choose destination"
                          : "Choose a stop"
                    }
                    autoComplete="off"
                    onFocus={() => setActiveIndex(index)}
                    onChange={(event) => {
                      updatePoint(index, {
                        name: event.target.value,
                        latitude: null,
                        longitude: null,
                      });

                      setActiveIndex(index);
                    }}
                  />
                </div>

                {!isFirst && !isLast && (
                  <button
                    type="button"
                    className="route-remove-stop"
                    onClick={() => removeStop(index)}
                    aria-label="Remove stop"
                    title="Remove stop"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>

              {isActive && (
                <div className="route-suggestions">
                  <button
                    type="button"
                    className="route-current-location"
                    disabled={locationLoadingIndex === index}
                    onMouseDown={(event) =>
                      event.preventDefault()
                    }
                    onClick={() => useCurrentLocation(index)}
                  >
                    <span className="current-location-symbol">
                      {locationLoadingIndex === index ? (
                        <LoaderCircle
                          size={19}
                          className="route-spinner"
                        />
                      ) : (
                        <LocateFixed size={19} />
                      )}
                    </span>

                    <span>
                      <strong>Use your location</strong>
                      <small>
                        Use your device's current position
                      </small>
                    </span>
                  </button>

                  {suggestionLoading && (
                    <div className="route-suggestion-status">
                      <LoaderCircle
                        size={16}
                        className="route-spinner"
                      />
                      Searching locations...
                    </div>
                  )}

                  {!suggestionLoading &&
                    suggestions.map((place) => (
                      <button
                        type="button"
                        key={place.id}
                        className="route-suggestion-item"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          selectSuggestion(place, index)
                        }
                      >
                        <MapPin size={17} />

                        <span>
                          <strong>{place.name}</strong>
                          <small>{place.address}</small>
                        </span>
                      </button>
                    ))}

                  {!suggestionLoading &&
                    point.name.trim().length >= 2 &&
                    suggestions.length === 0 && (
                      <div className="route-suggestion-status">
                        No matching locations found.
                      </div>
                    )}
                </div>
              )}

              {!isLast && (
                <div className="route-add-stop-row">
                  <span className="route-connector" />

                  <button
                    type="button"
                    className="route-add-stop-button"
                    onClick={() => addStop(index)}
                    title="Add a stop after this location"
                  >
                    <span>
                      <Plus size={16} />
                    </span>
                    Add a stop
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="route-mode-section">
        <p className="route-section-label">Travel mode</p>

        <div className="route-mode-options">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`route-mode-button ${
                mode === id ? "selected" : ""
              }`}
              onClick={() => {
                setMode(id);
                setRoutes(null);
                setError("");
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="route-calculating">
          <LoaderCircle
            size={18}
            className="route-spinner"
          />
          Updating your route...
        </div>
      )}

      {error && (
        <p className="route-error" role="alert">
          {error}
        </p>
      )}

      {routes && (
        <div className="route-results">
          <h3>Route options</h3>

          {["fastest", "shortest"].map((type) => {
            const route = routes[type];

            if (!route) return null;

            return (
              <button
                type="button"
                key={type}
                className={`route-option ${
                  selectedType === type ? "selected" : ""
                }`}
                onClick={() => chooseRoute(type)}
              >
                <div className="route-option-icon">
                  {type === "fastest" ? (
                    <Clock size={20} />
                  ) : (
                    <MapPin size={20} />
                  )}
                </div>

                <div className="route-option-info">
                  <strong>
                    {type === "fastest"
                      ? "Fastest route"
                      : "Shortest route"}
                  </strong>

                  <span>
                    {formatDuration(route.time)}
                    {" · "}
                    {formatDistance(route.distance)}
                  </span>
                </div>

                {selectedType === type && (
                  <span className="route-selected-label">
                    Selected
                  </span>
                )}
              </button>
            );
          })}

          <p className="route-data-note">
            Estimates depend on the selected travel mode.
            Live traffic information is not available yet.
          </p>
        </div>
      )}
    </section>
  );
}
