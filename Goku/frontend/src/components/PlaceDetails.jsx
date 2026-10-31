
import { useEffect, useState } from "react";

import {
  X,
  MapPin,
  Phone,
  Globe,
  Bookmark,
  Check,
  LoaderCircle,
  Star,
  Camera,
  Compass,
  Image as ImageIcon,
  Navigation,
  ArrowLeft,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { savePlace, isPlaceSaved } from "../services/savedPlaces";
import RoutePlanner from "./RoutePlanner";

const TABS = ["Overview", "Photos", "Reviews", "Nearby"];

export default function PlaceDetails({
  place,
  onClose,
  onDirections,
  onRoutesFound,
  onSelectRoute,
}) {
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState("Overview");
  const [showDirections, setShowDirections] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    setShowDirections(false);
    setActiveTab("Overview");

    async function checkSavedStatus() {
      setSaved(false);

      if (!place?.id || !token) return;

      try {
        setChecking(true);
        setError("");

        const existingPlace = await isPlaceSaved(token, place.id);

        if (active) setSaved(Boolean(existingPlace));
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to check bookmark status.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    checkSavedStatus();

    return () => {
      active = false;
    };
  }, [place?.id, token]);

  if (!place) return null;

  const photos = Array.isArray(place.photos) ? place.photos : [];
  const videos = Array.isArray(place.videos) ? place.videos : [];
  const reviews = Array.isArray(place.reviews) ? place.reviews : [];
  const nearby = Array.isArray(place.nearby) ? place.nearby : [];

  const rating = Number(place.rating);

  async function handleSave() {
    if (!token) {
      setError("Please log in to save places.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await savePlace(token, place);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Unable to save this place.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenDirections() {
    setShowDirections(true);
    onDirections?.(place);
  }

  function handleCloseDirections() {
    setShowDirections(false);
  }

  function renderOverview() {
    return (
      <>
        <section className="place-section">
          <h3>About this place</h3>

          <p className="place-description">
            {place.description ||
              `Explore ${place.name}. Detailed information about this location will be available when verified place information is provided.`}
          </p>

          {place.category && (
            <span className="place-category">{place.category}</span>
          )}
        </section>

        <section className="place-section">
          <h3>Information</h3>

          <div className="place-information-list">
            <div className="place-info-item">
              <MapPin size={19} />
              <div>
                <strong>Address</strong>
                <span>{place.address || "Address unavailable"}</span>
              </div>
            </div>

            {place.phone && (
              <div className="place-info-item">
                <Phone size={19} />
                <div>
                  <strong>Phone</strong>
                  <a href={`tel:${place.phone}`}>{place.phone}</a>
                </div>
              </div>
            )}

            {place.website && (
              <div className="place-info-item">
                <Globe size={19} />
                <div>
                  <strong>Website</strong>
                  <a href={place.website} target="_blank" rel="noreferrer">
                    Visit website
                  </a>
                </div>
              </div>
            )}

            {place.distance != null && (
              <div className="place-info-item">
                <Navigation size={19} />
                <div>
                  <strong>Distance</strong>
                  <span>{(place.distance / 1000).toFixed(2)} km away</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="place-section">
          <h3>Photos and videos</h3>

          <div className="place-preview-grid">
            {photos.slice(0, 3).map((photo, index) => (
              <img
                key={photo.id || index}
                src={typeof photo === "string" ? photo : photo.url}
                alt={`${place.name} ${index + 1}`}
              />
            ))}

            {photos.length === 0 && (
              <div className="place-empty-media">
                <ImageIcon size={25} />
                <span>No photos available yet</span>
              </div>
            )}
          </div>

          <button
            className="place-text-button"
            onClick={() => setActiveTab("Photos")}
          >
            Explore all photos and videos
          </button>
        </section>

        <section className="place-section">
          <h3>Reviews</h3>

          {Number.isFinite(rating) && (
            <div className="place-rating-summary">
              <strong>{rating.toFixed(1)}</strong>
              <div>
                <div className="place-stars">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      size={17}
                      fill={
                        index < Math.round(rating) ? "currentColor" : "none"
                      }
                    />
                  ))}
                </div>
                <span>{place.reviewCount ?? reviews.length} reviews</span>
              </div>
            </div>
          )}

          {reviews.length > 0 ? (
            reviews.slice(0, 2).map((review, index) => (
              <div className="place-review-preview" key={review.id || index}>
                <strong>
                  {review.user?.name || review.name || "Visitor"}
                </strong>
                <p>{review.comment || review.text}</p>
              </div>
            ))
          ) : (
            <p className="place-muted">Reviews will appear here when available.</p>
          )}

          <button
            className="place-text-button"
            onClick={() => setActiveTab("Reviews")}
          >
            See all reviews
          </button>
        </section>
      </>
    );
  }

  function renderPhotos() {
    return (
      <section className="place-section">
        <h3>Photos</h3>

        <div className="place-media-grid">
          {photos.map((photo, index) => {
            const url = typeof photo === "string" ? photo : photo.url;

            return (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                key={photo.id || index}
              >
                <img src={url} alt={`${place.name} ${index + 1}`} />
              </a>
            );
          })}
        </div>

        {photos.length === 0 && (
          <div className="place-empty-state">
            <Camera size={35} />
            <h3>No photos yet</h3>
            <p>Photos shared by visitors will appear here.</p>
          </div>
        )}

        <h3 className="place-subheading">Videos</h3>

        {videos.length > 0 ? (
          videos.map((video, index) => (
            <video
              key={video.id || index}
              src={typeof video === "string" ? video : video.url}
              controls
              className="place-video"
            />
          ))
        ) : (
          <p className="place-muted">No videos available yet.</p>
        )}
      </section>
    );
  }

  function renderReviews() {
    return (
      <section className="place-section">
        <h3>Visitor reviews</h3>

        {Number.isFinite(rating) && (
          <div className="place-rating-summary">
            <strong>{rating.toFixed(1)}</strong>
            <div className="place-stars">
              {Array.from({ length: 5 }, (_, index) => (
                <Star
                  key={index}
                  size={18}
                  fill={
                    index < Math.round(rating) ? "currentColor" : "none"
                  }
                />
              ))}
            </div>
          </div>
        )}

        {reviews.length > 0 ? (
          reviews.map((review, index) => (
            <article className="place-review-card" key={review.id || index}>
              <div className="place-review-header">
                <div className="place-review-avatar">
                  {review.user?.avatar || review.avatar ? (
                    <img
                      src={review.user?.avatar || review.avatar}
                      alt=""
                    />
                  ) : (
                    <Star size={18} />
                  )}
                </div>

                <div>
                  <strong>
                    {review.user?.name || review.name || "Visitor"}
                  </strong>
                  <span>
                    {review.createdAt
                      ? new Date(review.createdAt).toLocaleDateString()
                      : ""}
                  </span>
                </div>
              </div>

              <p>{review.comment || review.text}</p>
            </article>
          ))
        ) : (
          <div className="place-empty-state">
            <Star size={35} />
            <h3>No reviews yet</h3>
            <p>Be among the first visitors to review this place.</p>
          </div>
        )}
      </section>
    );
  }

  function renderNearby() {
    return (
      <section className="place-section">
        <h3>Explore nearby</h3>

        {nearby.length > 0 ? (
          nearby.map((item, index) => (
            <article className="place-nearby-card" key={item.id || index}>
              <div className="place-nearby-icon">
                <MapPin size={21} />
              </div>

              <div>
                <strong>{item.name}</strong>
                <span>{item.category || item.address || "Nearby place"}</span>
                {item.distance != null && (
                  <small>{(item.distance / 1000).toFixed(2)} km away</small>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="place-empty-state">
            <Compass size={35} />
            <h3>Discover nearby places</h3>
            <p>
              Hotels, cafes, restaurants and tourist attractions will appear
              here once nearby-place discovery is connected.
            </p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className={`place-details ${showDirections ? "place-details-directions" : ""}`}
    >
      <button
        className="place-details-close"
        onClick={onClose}
        aria-label="Close place details"
      >
        <X size={20} />
      </button>

      {showDirections ? (
        <div className="place-directions-view">
          <div className="place-directions-heading">
            <button
              type="button"
              className="place-directions-back"
              onClick={handleCloseDirections}
              aria-label="Back to place details"
            >
              <ArrowLeft size={19} />
            </button>

            <div>
              <span className="place-page-eyebrow">GOKU JOURNEY</span>
              <h2>Plan your journey</h2>
            </div>
          </div>

          <RoutePlanner
            initialDestination={place}
            onRoutesFound={onRoutesFound}
            onSelectRoute={onSelectRoute}
            onClose={handleCloseDirections}
          />
        </div>
      ) : (
        <div className="place-details-content">
          <div className="place-page-heading">
            <span className="place-page-eyebrow">GOKU EXPLORE</span>

            <h2>{place.name}</h2>

            <p className="place-address-heading">
              <MapPin size={15} />
              {place.address || "Address unavailable"}
            </p>

            {Number.isFinite(rating) && (
              <div className="place-heading-rating">
                <Star size={16} fill="currentColor" />
                <strong>{rating.toFixed(1)}</strong>
                <span>
                  ({place.reviewCount ?? reviews.length} reviews)
                </span>
              </div>
            )}
          </div>

          <div className="place-action-buttons">
            <button
              type="button"
              className="place-directions-button"
              onClick={handleOpenDirections}
              title="Get directions"
              aria-label={`Get directions to ${place.name}`}
            >
              <Navigation size={20} />
            </button>

            <button
              className={`place-save-button ${saved ? "saved" : ""}`}
              onClick={handleSave}
              disabled={saving || saved || checking}
            >
              {saving || checking ? (
                <LoaderCircle size={18} className="place-save-spinner" />
              ) : saved ? (
                <Check size={18} />
              ) : (
                <Bookmark size={18} />
              )}

              {checking
                ? "Checking..."
                : saving
                  ? "Saving..."
                  : saved
                    ? "Saved"
                    : "Save"}
            </button>
          </div>

          {error && <p className="place-save-error">{error}</p>}

          <nav className="place-tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "Photos" && <Camera size={15} />}
                {tab === "Reviews" && <Star size={15} />}
                {tab === "Nearby" && <Compass size={15} />}
                {tab}
              </button>
            ))}
          </nav>

          <div className="place-tab-content">
            {activeTab === "Overview" && renderOverview()}
            {activeTab === "Photos" && renderPhotos()}
            {activeTab === "Reviews" && renderReviews()}
            {activeTab === "Nearby" && renderNearby()}
          </div>
        </div>
      )}
    </section>
  );
}
