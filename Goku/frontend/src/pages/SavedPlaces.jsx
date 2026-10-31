
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark,
  MapPin,
  Trash2,
  ArrowLeft,
  LoaderCircle,
  Map,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  getSavedPlaces,
  removeSavedPlace,
} from "../services/savedPlaces";

export default function SavedPlaces() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    async function loadPlaces() {
      try {
        setLoading(true);
        setError("");

        const savedPlaces = await getSavedPlaces(token);
        setPlaces(savedPlaces);
      } catch (err) {
        setError(err.message || "Unable to load saved places.");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadPlaces();
    } else {
      setLoading(false);
    }
  }, [token]);

  async function handleRemove(placeId) {
    const confirmed = window.confirm(
      "Are you sure you want to remove this saved place?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(placeId);
      setError("");

      await removeSavedPlace(token, placeId);

      setPlaces((currentPlaces) =>
        currentPlaces.filter((place) => place._id !== placeId)
      );
    } catch (err) {
      setError(err.message || "Unable to remove this place.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="saved-page">
      <div className="saved-container">
        <button
          className="saved-back-button"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={18} />
          Back to Goku
        </button>

        <header className="saved-header">
          <div className="saved-header-icon">
            <Bookmark size={27} />
          </div>

          <div>
            <h1>Saved Places</h1>
            <p>Your favourite places, all in one place.</p>
          </div>
        </header>

        {error && (
          <div className="saved-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="saved-loading">
            <LoaderCircle size={25} className="saved-spinner" />
            <span>Loading your saved places...</span>
          </div>
        ) : places.length === 0 ? (
          <div className="saved-empty">
            <Bookmark size={55} />
            <h2>No saved places yet</h2>
            <p>
              Explore Goku and bookmark places you want to visit.
            </p>

            <button onClick={() => navigate("/")}>
              <Map size={18} />
              Explore Places
            </button>
          </div>
        ) : (
          <>
            <div className="saved-count">
              {places.length} saved {places.length === 1 ? "place" : "places"}
            </div>

            <div className="saved-grid">
              {places.map((place) => (
                <article className="saved-card" key={place._id}>
                  <div className="saved-card-top">
                    <div className="saved-place-icon">
                      <MapPin size={22} />
                    </div>

                    <button
                      className="saved-remove-button"
                      onClick={() => handleRemove(place._id)}
                      disabled={deletingId === place._id}
                      title="Remove saved place"
                      aria-label={`Remove ${place.name}`}
                    >
                      {deletingId === place._id ? (
                        <LoaderCircle size={18} className="saved-spinner" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>

                  <h3>{place.name}</h3>

                  <p className="saved-place-address">
                    {place.address || "Address unavailable"}
                  </p>

                  <div className="saved-place-category">
                    {place.category || "Other"}
                  </div>

                  <div className="saved-coordinates">
                    {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
