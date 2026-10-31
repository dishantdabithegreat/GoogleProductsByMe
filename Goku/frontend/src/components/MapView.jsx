
import { useEffect, useRef, useState } from "react";

import * as maplibregl from "maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import "maplibre-gl/dist/maplibre-gl.css";

import PlaceDetails from "./PlaceDetails";

import {
  getNearbyPlaces,
  reverseGeocode,
} from "../services/places";

setWorkerUrl(workerUrl);

const ROUTE_SOURCE_ID = "goku-route";
const ROUTE_LAYER_ID = "goku-route-line";

export default function MapView({
  selectedPlace,
  activeCategory = "Explore",
  onClearCategory,
  activeRoute,
  routeFitRequest,
  onOpenDirections,
  onClosePlaceDetails,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const searchMarkerRef = useRef(null);
  const nearbyMarkersRef = useRef([]);

  const [mapError, setMapError] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);

  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");

  const [selectedNearbyPlace, setSelectedNearbyPlace] = useState(null);
  const [clickedPlace, setClickedPlace] = useState(null);

  // Remove nearby markers.
  function removeNearbyMarkers() {
    nearbyMarkersRef.current.forEach((marker) => marker.remove());
    nearbyMarkersRef.current = [];
  }

  // Initialize MapLibre.
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;

    if (!apiKey || apiKey === "your_actual_api_key_here") {
      setMapError("Geoapify API key missing. Check frontend/.env.");
      return;
    }

    if (!containerRef.current || mapRef.current) return;

    let map;
    let resizeObserver;
    let clickController = null;
    let active = true;

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=${encodeURIComponent(apiKey)}`,
        center: [75.7873, 26.9124],
        zoom: 12,
        attributionControl: true,
      });

      mapRef.current = map;

      map.addControl(
        new maplibregl.NavigationControl(),
        "top-right"
      );

      map.on("load", () => {
        if (!active) return;

        setMapLoaded(true);
        setMapError("");
        map.resize();
      });

      map.on("error", (event) => {
        console.error("Goku map error:", event.error || event);
      });

      // Clicking the map identifies the clicked location.
      async function handleMapClick(event) {
        clickController?.abort();
        clickController = new AbortController();

        try {
          const place = await reverseGeocode({
            longitude: event.lngLat.lng,
            latitude: event.lngLat.lat,
            signal: clickController.signal,
          });

          if (!active || !place) return;

          setClickedPlace(place);
          setSelectedNearbyPlace(null);

          searchMarkerRef.current?.remove();

          searchMarkerRef.current = new maplibregl.Marker({
            color: "#2563eb",
          })
            .setLngLat([
              place.longitude,
              place.latitude,
            ])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setText(
                place.name || "Selected location"
              )
            )
            .addTo(map);
        } catch (error) {
          if (error.name !== "AbortError") {
            console.error("Reverse geocoding error:", error);
          }
        }
      }

      map.on("click", handleMapClick);

      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });

      resizeObserver.observe(containerRef.current);

      map._gokuClickHandler = handleMapClick;
    } catch (error) {
      console.error("Goku map initialization error:", error);
      setMapError("Unable to initialize the map.");
    }

    return () => {
      active = false;
      clickController?.abort();

      resizeObserver?.disconnect();

      if (map?._gokuClickHandler) {
        map.off("click", map._gokuClickHandler);
      }

      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;

      removeNearbyMarkers();

      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Display a selected search result.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoaded || !selectedPlace) return;

    const longitude = Number(selectedPlace.longitude);
    const latitude = Number(selectedPlace.latitude);

    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude)
    ) {
      console.error("Invalid selected place coordinates:", selectedPlace);
      return;
    }

    setClickedPlace(null);
    setSelectedNearbyPlace(null);

    map.flyTo({
      center: [longitude, latitude],
      zoom: 15,
      essential: true,
    });

    searchMarkerRef.current?.remove();

    searchMarkerRef.current = new maplibregl.Marker({
      color: "#2563eb",
    })
      .setLngLat([longitude, latitude])
      .setPopup(
        new maplibregl.Popup({ offset: 25 }).setText(
          selectedPlace.name || "Selected place"
        )
      )
      .addTo(map);
  }, [selectedPlace, mapLoaded]);

  // Discover nearby places.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoaded) return;

    let isActive = true;
    let controller = null;

    async function loadNearbyPlaces() {
      if (activeCategory === "Explore") {
        setNearbyPlaces([]);
        setNearbyError("");
        setNearbyLoading(false);
        setSelectedNearbyPlace(null);

        removeNearbyMarkers();
        return;
      }

      controller?.abort();
      controller = new AbortController();

      setNearbyLoading(true);
      setNearbyError("");

      const center = map.getCenter();

      try {
        const results = await getNearbyPlaces({
          longitude: center.lng,
          latitude: center.lat,
          category: activeCategory,
          signal: controller.signal,
        });

        if (!isActive) return;

        setNearbyPlaces(results);
        removeNearbyMarkers();

        results.forEach((place) => {
          if (
            !Number.isFinite(Number(place.longitude)) ||
            !Number.isFinite(Number(place.latitude))
          ) {
            return;
          }

          const marker = new maplibregl.Marker({
            color: "#e05252",
          })
            .setLngLat([
              Number(place.longitude),
              Number(place.latitude),
            ])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setText(
                place.name || "Unnamed place"
              )
            )
            .addTo(map);

          marker.getElement().addEventListener("click", () => {
            setSelectedNearbyPlace(place);
            setClickedPlace(null);
          });

          nearbyMarkersRef.current.push(marker);
        });
      } catch (error) {
        if (error.name !== "AbortError" && isActive) {
          console.error("Goku nearby search error:", error);

          setNearbyError(
            error.message || "Could not load nearby places."
          );

          setNearbyPlaces([]);
          removeNearbyMarkers();
        }
      } finally {
        if (isActive && !controller.signal.aborted) {
          setNearbyLoading(false);
        }
      }
    }

    loadNearbyPlaces();

    map.on("moveend", loadNearbyPlaces);

    return () => {
      isActive = false;
      controller?.abort();
      map.off("moveend", loadNearbyPlaces);
    };
  }, [activeCategory, mapLoaded]);

  // Focus a nearby place.
  function focusPlace(place) {
    const map = mapRef.current;

    if (!map) return;

    setSelectedNearbyPlace(place);
    setClickedPlace(null);

    map.flyTo({
      center: [
        Number(place.longitude),
        Number(place.latitude),
      ],
      zoom: 16,
      essential: true,
    });
  }

  // Clear nearby results.
  function clearNearbyResults() {
    setNearbyPlaces([]);
    setNearbyError("");
    setNearbyLoading(false);
    setSelectedNearbyPlace(null);

    removeNearbyMarkers();

    onClearCategory?.();
  }

  // Extract valid GeoJSON geometry.
  function getRouteGeometry(route) {
    const geometry =
      route?.geometry?.type === "Feature"
        ? route.geometry.geometry
        : route?.geometry;

    if (
      !geometry ||
      !["LineString", "MultiLineString"].includes(geometry.type)
    ) {
      return null;
    }

    return geometry;
  }

  // Draw the selected route. This does not move the camera.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoaded) return;

    const source = map.getSource(ROUTE_SOURCE_ID);

    if (!activeRoute) {
      source?.setData({
        type: "FeatureCollection",
        features: [],
      });

      return;
    }

    const geometry = getRouteGeometry(activeRoute);

    if (!geometry) {
      console.error("Unsupported route geometry:", activeRoute);
      return;
    }

    const routeData = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry,
        },
      ],
    };

    if (source) {
      source.setData(routeData);
      return;
    }

    map.addSource(ROUTE_SOURCE_ID, {
      type: "geojson",
      data: routeData,
    });

    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: "line",
      source: ROUTE_SOURCE_ID,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#2563eb",
        "line-width": 6,
        "line-opacity": 0.9,
      },
    });
  }, [activeRoute, mapLoaded]);

  // Fit the camera only when Home sends a new route-fit request.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoaded || !routeFitRequest) return;

    const route = routeFitRequest.route || routeFitRequest;
    const geometry = getRouteGeometry(route);

    if (!geometry) return;

    const bounds = new maplibregl.LngLatBounds();

    function extendBounds(coordinates) {
      if (
        Array.isArray(coordinates) &&
        typeof coordinates[0] === "number" &&
        typeof coordinates[1] === "number"
      ) {
        bounds.extend(coordinates);
        return;
      }

      if (Array.isArray(coordinates)) {
        coordinates.forEach(extendBounds);
      }
    }

    extendBounds(geometry.coordinates);

    if (bounds.isEmpty()) return;

    map.fitBounds(bounds, {
      padding: {
        top: 110,
        bottom: 100,
        left: 100,
        right: 100,
      },
      maxZoom: 15,
      duration: 800,
    });
  }, [routeFitRequest, mapLoaded]);

  // Directions is now controlled by Home/Header.
  // This callback only opens directions for the selected place.
  function handleOpenDirections(place) {
    if (!place) return;
    onOpenDirections?.(place);
  }

  // Close place details.
  function handlePlaceClose() {
    setSelectedNearbyPlace(null);
    setClickedPlace(null);
    onClosePlaceDetails?.();
  }

  const displayedPlace =
    selectedNearbyPlace ||
    clickedPlace ||
    selectedPlace ||
    null;

  return (
    <main className="map-view">
      <div
        ref={containerRef}
        className="map-container"
        aria-label="Interactive map"
      />

      {!mapLoaded && !mapError && (
        <div className="map-loading">
          Loading Goku map...
        </div>
      )}

      {mapError && (
        <div className="map-error">
          {mapError}
        </div>
      )}

      {activeCategory !== "Explore" && (
        <div className="nearby-panel">
          <div className="nearby-panel-header">
            <h3>{activeCategory} nearby</h3>

            <button
              type="button"
              onClick={clearNearbyResults}
              aria-label="Close nearby results"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {nearbyLoading && (
            <p className="nearby-status">
              Finding nearby places...
            </p>
          )}

          {nearbyError && (
            <p className="nearby-error">
              {nearbyError}
            </p>
          )}

          {!nearbyLoading &&
            !nearbyError &&
            nearbyPlaces.length === 0 && (
              <p className="nearby-status">
                No nearby places found.
              </p>
            )}

          <div className="nearby-results">
            {nearbyPlaces.map((place) => (
              <button
                type="button"
                className="nearby-result-item"
                key={place.id || `${place.longitude}-${place.latitude}`}
                onClick={() => focusPlace(place)}
              >
                <strong>{place.name}</strong>
                <span>{place.address}</span>

                {place.distance != null && (
                  <small>
                    {formatNearbyDistance(place.distance)} away
                  </small>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <PlaceDetails
        place={displayedPlace}
        onClose={handlePlaceClose}
        onDirections={handleOpenDirections}
      />
    </main>
  );
}

function formatNearbyDistance(meters) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}
