
import {
  Home,
  Utensils,
  Coffee,
  Hospital,
  ShoppingBag,
  Star,
  Bookmark,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

const categories = [
  { name: "Explore", icon: Home },
  { name: "Restaurants", icon: Utensils },
  { name: "Cafes", icon: Coffee },
  { name: "Hospitals", icon: Hospital },
  { name: "Shopping", icon: ShoppingBag },
];

export default function Sidebar({
  activeCategory,
  setActiveCategory,
}) {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <h2>Discover</h2>

      <p className="sidebar-description">
        Explore the world around you.
      </p>

      <nav>
        {categories.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={`category-item ${
              activeCategory === name ? "active" : ""
            }`}
            onClick={() => {
              setActiveCategory(name);
              navigate("/");
            }}
          >
            <Icon size={19} />
            <span>{name}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-divider" />

      <button
        className="category-item"
        onClick={() => navigate("/saved-places")}
      >
        <Bookmark size={19} />
        <span>Saved places</span>
      </button>

      <button
        className="category-item"
        onClick={() => navigate("/saved-places")}
      >
        <Star size={19} />
        <span>Favourites</span>
      </button>
    </aside>
  );
}
