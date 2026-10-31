
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Menu,
  Search,
  X,
  LogOut,
  UserCircle,
} from "lucide-react";

import { searchPlaces } from "../services/geoapify";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Header({
  search,
  setSearch,
  onMenuClick,
  onSelectPlace,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allowSuggestions, setAllowSuggestions] = useState(false);

  const searchAbortRef = useRef(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    searchAbortRef.current?.abort();

    const query = search.trim();

    if (!allowSuggestions || query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const results = await searchPlaces(
          query,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setSuggestions(results);
          setShowSuggestions(true);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Goku search error:", err);
          setSuggestions([]);
          setError("Search failed. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [search, allowSuggestions]);

  function handleSelect(place) {
    searchAbortRef.current?.abort();

    setAllowSuggestions(false);
    setSearch(place.name);
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(false);
    setError("");

    onSelectPlace?.(place);
  }

  function handleClear() {
    searchAbortRef.current?.abort();

    setSearch("");
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(false);
    setError("");
    setAllowSuggestions(false);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleProfile() {
    navigate("/profile");
  }

  return (
    <header className="header">
      <button
        className="menu-button"
        type="button"
        onClick={onMenuClick}
        aria-label="Toggle sidebar"
      >
        <Menu size={22} />
      </button>

      <button
        className="brand"
        type="button"
        onClick={handleClear}
        aria-label="Goku home"
      >
        <span className="brand-icon">
          <MapPin size={25} />
        </span>

        <span className="brand-name">Goku</span>
      </button>

      <div className="search-wrapper">
        <form
          className="search-box"
          onSubmit={(event) => {
            event.preventDefault();

            if (allowSuggestions && suggestions.length > 0) {
              handleSelect(suggestions[0]);
            }
          }}
        >
          <Search size={20} className="search-icon" />

          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setAllowSuggestions(true);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              if (allowSuggestions && search.trim().length >= 2) {
                setShowSuggestions(true);
              }
            }}
            placeholder="Search places, streets, and cities"
            aria-label="Search places"
            aria-autocomplete="list"
            autoComplete="off"
          />

          {loading && (
            <span className="search-status">
              Searching...
            </span>
          )}

          {search && (
            <button
              type="button"
              className="clear-search"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </form>

        {allowSuggestions &&
          showSuggestions &&
          search.trim().length >= 2 && (
            <div className="search-suggestions" role="listbox">
              {loading && suggestions.length === 0 && (
                <div className="search-message">
                  Finding places...
                </div>
              )}

              {!loading && error && (
                <div className="search-message search-error">
                  {error}
                </div>
              )}

              {!loading && !error && suggestions.length === 0 && (
                <div className="search-message">
                  No places found. Try another search.
                </div>
              )}

              {suggestions.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className="suggestion-item"
                  role="option"
                  aria-selected="false"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(place)}
                >
                  <span className="suggestion-icon">
                    <MapPin size={19} />
                  </span>

                  <span className="suggestion-text">
                    <span className="suggestion-name">
                      {place.name}
                    </span>

                    <span className="suggestion-address">
                      {[
                        place.city,
                        place.state,
                        place.address,
                      ]
                        .filter(Boolean)
                        .filter(
                          (value, index, array) =>
                            array.indexOf(value) === index
                        )
                        .join(", ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
      </div>

      <div className="user-account">
        <button
          type="button"
          className="profile-button"
          onClick={handleProfile}
          title="My Profile"
          aria-label="Open user profile"
        >
          <UserCircle size={25} />
          <span>Profile</span>
        </button>

        <span className="user-name">
          {user?.name || "Goku User"}
        </span>

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
