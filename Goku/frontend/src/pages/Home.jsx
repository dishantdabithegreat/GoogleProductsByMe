
import { useRef, useState } from "react";

import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import MapView from "../components/MapView";
import RoutePlanner from "../components/RoutePlanner";

export default function Home() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Explore");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [selectedPlace, setSelectedPlace] = useState(null);

  const [directionsMode, setDirectionsMode] = useState(false);
  const [directionsDestination, setDirectionsDestination] =
    useState(null);

  const [activeRoute, setActiveRoute] = useState(null);
  const [routeFitRequest, setRouteFitRequest] = useState(null);

  const routeFitIdRef = useRef(0);

  function handleSelectPlace(place) {
    setSelectedPlace(place);
    setDirectionsMode(false);
    setDirectionsDestination(null);
    setActiveRoute(null);
    setRouteFitRequest(null);
  }

  function handleOpenDirections(place) {
    if (!place) return;

    setSelectedPlace(place);
    setDirectionsDestination(place);
    setDirectionsMode(true);
    setActiveRoute(null);
    setRouteFitRequest(null);
  }

  function handleCloseDirections() {
    setDirectionsMode(false);
    setDirectionsDestination(null);
    setActiveRoute(null);
    setRouteFitRequest(null);
  }

  function handleRoutesFound(result, options = {}) {
    const route = result?.fastest || result?.shortest;

    if (!route) return;

    setActiveRoute(route);

    if (options.fitBounds) {
      routeFitIdRef.current += 1;

      setRouteFitRequest({
        id: routeFitIdRef.current,
        route,
      });
    }
  }

  function handleSelectRoute(route) {
    if (!route) return;
    setActiveRoute(route);
  }

  function handleClosePlaceDetails() {
    setSelectedPlace(null);
  }

  return (
    <div className="app-layout">
      {/* Main navbar: remains independent and unchanged in size */}
      <Header
        search={search}
        setSearch={setSearch}
        onMenuClick={() => setSidebarOpen((previous) => !previous)}
        onSelectPlace={handleSelectPlace}
      />

      {/* Directions is a separate row below the navbar */}
      {directionsMode && (
        <div className="directions-row">
          <RoutePlanner
            initialDestination={directionsDestination}
            onRoutesFound={handleRoutesFound}
            onSelectRoute={handleSelectRoute}
            onClose={handleCloseDirections}
          />
        </div>
      )}

      <div className="main-content">
        <Sidebar
          isOpen={sidebarOpen}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        <MapView
          selectedPlace={selectedPlace}
          activeCategory={activeCategory}
          onClearCategory={() => setActiveCategory("Explore")}
          activeRoute={activeRoute}
          routeFitRequest={routeFitRequest}
          onOpenDirections={handleOpenDirections}
          onClosePlaceDetails={handleClosePlaceDetails}
        />
      </div>
    </div>
  );
}
