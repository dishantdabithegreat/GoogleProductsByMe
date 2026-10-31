# Goku - Route Mapping & Location Search Application

## Project Overview

Goku is a full-stack web application for location searching, route mapping, and place discovery. It provides users with the ability to search for places, view nearby locations (restaurants, hotels, tourist attractions), and calculate routes between locations. The application currently focuses on India and uses the Geoapify API for map services.

---

## Architecture Overview

The project follows a **modular monolith architecture** with clear separation between frontend and backend:

```
Goku/
├── backend/          # Node.js/Express API server
│   ├── src/
│   │   ├── config/       # Database configuration
│   │   ├── controllers/   # Request handlers (currently unused, logic in routes)
│   │   ├── middleware/   # Authentication and security
│   │   ├── models/       # MongoDB data models
│   │   ├── routes/       # API endpoint definitions
│   │   ├── services/     # Business logic
│   │   ├── integrations/ # External API integrations (maps)
│   │   ├── utils/        # Helper functions
│   │   ├── app.js        # Express app configuration
│   │   └── server.js     # Server entry point
│   ├── .env              # Environment variables (server port, database URI, secret keys)
│   └── package.json
└── frontend/         # React + Vite client
    ├── src/
    │   ├── components/   # Reusable UI components
    │   ├── context/      # React Context for state management
    │   ├── pages/        # Page-level components
    │   ├── services/     # API calls to backend and external services
    │   ├── App.jsx       # Main app with routing
    │   └── main.jsx      # React entry point
    ├── .env              # Environment variables (API keys, backend URL)
    └── package.json
```

### Why This Structure?

- **Modular Monolith**: One backend application with clearly separated modules. Easier to develop and deploy than premature microservices.
- **Controllers**: Would receive requests and send responses (currently logic resides in routes for simplicity).
- **Services**: Contain business logic (authentication, saved places).
- **Models**: Define MongoDB database structures (User, SavedPlace, Review).
- **Routes**: Define API endpoints (/api/v1/auth, /api/v1/saved-places).
- **Middleware**: Authentication (JWT verification), validation, and security.
- **Integrations/maps**: Would communicate with external map providers (currently unused as frontend calls Geoapify directly).
- **Config**: Application configuration (database connection).
- **Utils**: Reusable helper functions (currently minimal).

---

## Backend Architecture & Workflow

### Technology Stack
- **Runtime**: Node.js with ES modules
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens) with bcryptjs for password hashing
- **Security**: Helmet, CORS, rate limiting

### Key Backend Components

#### 1. Server Entry Point (`server.js`)
- Loads environment variables using `dotenv`
- Connects to MongoDB before accepting requests
- Starts Express server on configured port
- Implements graceful shutdown on SIGINT/SIGTERM

**Why this approach?** Database-first startup ensures no requests are processed until the database is ready. Graceful shutdown prevents data corruption.

#### 2. Express App Configuration (`app.js`)
- **Security middleware**:
  - `helmet()`: Adds important HTTP security headers (X-Frame-Options, CSP, etc.)
  - `cors()`: Controls which frontend origin can access the API (configurable via environment variable)
  - `express.json()`: Parses incoming JSON requests with size limit (10kb)
  - `pino-http()`: Logs incoming HTTP requests for debugging
  - `rateLimit()`: Limits repeated API requests (100 requests per 15 minutes)

**Why these security measures?** To prevent common attacks (XSS, clickjacking, DoS) and ensure only authorized frontend can access the API.

- **Route mounting**:
  - `/api/v1/auth` → Authentication routes (register, login, profile)
  - `/api/v1/saved-places` → Saved places CRUD operations
  - `/api/v1/health` → Health check endpoint

- **Error handling**: Centralized error handler returns consistent error responses

#### 3. Authentication Routes (`routes/authRoutes.js`)
**Endpoints**:
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user profile (protected)
- `PUT /api/v1/auth/me` - Update current user profile (protected)

**Workflow**:
1. **Register**: Validate input → Check existing user → Hash password (bcrypt, 12 rounds) → Create user → Generate JWT token → Return token and user data
2. **Login**: Validate input → Find user with password → Compare passwords → Generate JWT token → Return token and user data
3. **Profile**: Middleware verifies JWT → Attach user to request → Return user data

**Why bcrypt with 12 rounds?** Balance between security and performance. Higher rounds are more secure but slower; 12 is current best practice.

**Why JWT?** Stateless authentication, no session storage on server, works well for SPA applications.

#### 4. Saved Places Routes (`routes/savedPlaceRoutes.js`)
**Endpoints**:
- `GET /api/v1/saved-places` - Get user's saved places (protected)
- `POST /api/v1/saved-places` - Save a new place (protected)
- `DELETE /api/v1/saved-places/:id` - Remove saved place (protected)

**Workflow**:
1. All routes use `protect` middleware to verify JWT
2. Operations are scoped to the authenticated user (cannot access other users' data)
3. Validation ensures coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)

#### 5. Authentication Middleware (`middleware/authMiddleware.js`)
- Extracts JWT token from `Authorization: Bearer <token>` header
- Verifies token using secret key from environment
- Fetches user from database
- Attaches user to `req.user` for downstream use
- Returns 401 if token is invalid/expired

**Why middleware?** DRY principle - authentication logic is written once and reused across protected routes.

#### 6. Database Models

**User Model** (`models/User.js`):
- Fields: name, email (unique), password (hidden by default), avatar, isVerified
- Validation: name length (2-50), email format, password length (8-72)
- Timestamps: createdAt, updatedAt

**SavedPlace Model** (`models/SavedPlace.js`):
- Fields: user (reference to User), placeId, name, address, latitude, longitude, category, website, phone
- Timestamps: createdAt, updatedAt

**Review Model** (`models/Review.js`):
- Fields: placeId, placeName, userId (reference to User), rating (1-5), comment
- Unique index: One review per user per place
- Timestamps: createdAt, updatedAt

**Why Mongoose?** Provides schema validation, type casting, and built-in methods for MongoDB interactions.

#### 7. Database Configuration (`config/db.js`)
- Connects to MongoDB using connection string from environment
- Logs success/failure
- Throws error if connection fails (stops server startup)

---

## Frontend Architecture & Workflow

### Technology Stack
- **Framework**: React 19 with Vite
- **Routing**: React Router DOM v7
- **Maps**: MapLibre GL JS (open-source map library)
- **Styling**: CSS (no framework)
- **Icons**: Lucide React
- **HTTP Client**: Fetch API (no axios in current implementation)

### Key Frontend Components

#### 1. Application Entry (`main.jsx`)
- Mounts React app to DOM
- Imports global CSS files
- Wraps app in React.StrictMode for development checks

#### 2. App Routing (`App.jsx`)
- Uses React Router for client-side routing
- **Route protection**:
  - `GuestRoute`: Allows access only to unauthenticated users (login, register)
  - `ProtectedRoute`: Allows access only to authenticated users (home, profile, saved-places)
- **Fallback route**: Redirects to home for unknown routes

**Why route protection?** Prevents unauthorized access to protected pages and improves UX by redirecting appropriately.

#### 3. Authentication Context (`context/AuthContext.jsx`)
- Provides global authentication state using React Context
- Stores token and user in sessionStorage
- Exposes: token, user, isAuthenticated, saveSession(), logout()
- Persists auth state across page refreshes

**Why Context instead of Redux?** For this scale, Context is sufficient and simpler. Redux would be overkill.

#### 4. Home Page (`pages/Home.jsx`)
**Main application layout with**:
- Header (search bar, user controls)
- Sidebar (category navigation)
- MapView (interactive map)
- RoutePlanner (directions panel, when active)

**State management**:
- Search query
- Active category (Explore, Restaurants, Cafes, etc.)
- Selected place
- Directions mode toggle
- Active route for display

**Why this layout?** Classic map application pattern: search + sidebar + map + details panel.

#### 5. Header Component (`components/Header.jsx`)
**Features**:
- Brand logo (click to reset search)
- Search bar with autocomplete
- User profile and logout buttons

**Search workflow**:
1. User types in search input (debounced 350ms)
2. Calls `searchPlaces()` from `services/geoapify.js`
3. Geoapify API returns location suggestions
4. Displays suggestions in dropdown
5. User selects → calls `onSelectPlace()` → updates map

**Why debouncing?** Prevents excessive API calls while typing, improves performance and reduces API quota usage.

#### 6. Sidebar Component (`components/Sidebar.jsx`)
**Categories**:
- Explore (default - no filter)
- Restaurants
- Cafes
- Hospitals
- Shopping

**Workflow**:
- Clicking category updates `activeCategory` state
- MapView listens to category change and loads nearby places
- "Saved places" and "Favourites" navigate to saved-places page

#### 7. MapView Component (`components/MapView.jsx`)
**Core map functionality**:
- Initializes MapLibre GL map with Geoapify tiles
- Default center: Jaipur, India (26.9124, 75.7873)
- Adds navigation controls (zoom, pan)

**Key features**:
1. **Place display**: Shows selected place with marker and popup
2. **Nearby places**: Loads places based on active category
3. **Map click**: Reverse geocodes clicked coordinates
4. **Route display**: Draws route line when route is calculated

**Nearby places workflow**:
1. User selects category from sidebar
2. MapView calls `getNearbyPlaces()` from `services/places.js`
3. Filters by category around map center (5km radius)
4. Adds red markers for each place
5. Clicking marker opens PlaceDetails panel

**Route display workflow**:
1. Home passes `activeRoute` to MapView
2. MapView extracts GeoJSON geometry from route
3. Adds line layer to map with blue color
4. Fits map bounds to show entire route

**Why MapLibre instead of Google Maps?** Open-source, free, no API key for tiles (uses Geoapify style), similar API to Google Maps.

#### 8. RoutePlanner Component (`components/RoutePlanner.jsx`)
**Features**:
- Multiple route points (origin, stops, destination)
- Drag-and-drop reordering of stops
- Travel mode selection (Car, Bike, Cycle, Walk)
- Current location detection
- Fastest vs shortest route comparison

**Workflow**:
1. User enters locations (with autocomplete)
2. Component validates all points have coordinates
3. Calls `getRoutes()` from `services/routing.js`
4. Geoapify calculates route (balanced and short variants)
5. Displays distance and time for each route
6. User selects route → callback to Home → updates MapView

**Route calculation**:
- Uses Geoapify Routing API
- Supports waypoints (stops between origin and destination)
- Returns fastest and shortest options
- Validates geometry (LineString or MultiLineString)

**Why separate RoutePlanner?** Complex UI with multiple states, better to isolate from main map view for maintainability.

#### 9. PlaceDetails Component (`components/PlaceDetails.jsx`)
**Tabs**:
- Overview: Basic info, address, phone, website, photos preview, reviews preview
- Photos: Full photo gallery and videos
- Reviews: All visitor reviews with ratings
- Nearby: Nearby hotels, restaurants, tourist attractions

**Features**:
- Save/place bookmark (requires authentication)
- Directions button (opens RoutePlanner)
- Rating display with stars
- Contact information

**Save workflow**:
1. User clicks "Save" button
2. Checks if user is authenticated
3. Calls `savePlace()` from `services/savedPlaces.js`
4. Backend saves to MongoDB
5. UI updates to show "Saved" status

**Why tabs?** Reduces visual clutter, organizes information logically.

#### 10. Services Layer

**Authentication Service** (`services/auth.js`):
- `registerUser()` - POST to /api/v1/auth/register
- `loginUser()` - POST to /api/v1/auth/login
- `getCurrentUser()` - GET to /api/v1/auth/me
- `updateCurrentUser()` - PUT to /api/v1/auth/me

**Geoapify Service** (`services/geoapify.js`):
- `searchPlaces()` - Autocomplete for location search
- Filtered to India (countrycode:in)
- Returns top 8 results
- Special handling for "Jaipur" to filter by Rajasthan

**Places Service** (`services/places.js`):
- `getNearbyPlaces()` - Discover places by category around a location
- Categories: Restaurants, Cafes, Hospitals, Shopping, Hotels, Tourism
- Radius: 5km (configurable)
- Limit: 30 places (configurable)
- `reverseGeocode()` - Convert coordinates to address
- `getNearbyRecommendations()` - Get multiple categories at once

**Routing Service** (`services/routing.js`):
- `getRoutes()` - Calculate routes between points
- Supports multiple stops (waypoints)
- Modes: drive, bicycle, walk
- Returns fastest and shortest options
- Validates coordinates and geometry
- Uses AbortController for cancellation

**Saved Places Service** (`services/savedPlaces.js`):
- `savePlace()` - POST to /api/v1/saved-places
- `getSavedPlaces()` - GET to /api/v1/saved-places
- `deleteSavedPlace()` - DELETE to /api/v1/saved-places/:id
- `isPlaceSaved()` - Check if place is already saved

**Why service layer?** Separates API calls from UI components, enables reuse, easier testing, centralized error handling.

---

## How to Run Locally

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local instance or MongoDB Atlas connection string)
- Geoapify API key (free tier available at https://www.geoapify.com/)

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd Goku/backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file** (copy from `.env.example`):
   ```env
   PORT=<server_port>
   NODE_ENV=development
   CLIENT_ORIGIN=<frontend_url>
   MONGO_URI=<mongodb_connection_string>
   JWT_SECRET=<your_secret_key>
   JWT_EXPIRES_IN=1d
   ```
   (See `.env.example` for required variable names)

4. **Start MongoDB** (if using local instance):
   ```bash
   # Windows
   mongod

   # macOS/Linux
   sudo systemctl start mongod
   ```

5. **Start backend server**:
   ```bash
   npm run dev
   ```
   (Uses nodemon for auto-reload during development)

   Backend will run on configured local port

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd Goku/frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file**:
   ```env
   VITE_GEOAPIFY_API_KEY=<your_geoapify_api_key>
   VITE_API_URL=<backend_api_url>
   ```
   (See `.env.example` for required variable names)

4. **Start frontend dev server**:
   ```bash
   npm run dev
   ```
   Frontend will run on configured local port

### Access the Application

1. Open browser to the frontend URL displayed in terminal
2. Register a new account
3. Login and start exploring

---

## Current Features

### Working Features

1. **User Authentication**
   - User registration with email validation
   - Secure login with JWT tokens
   - Profile management (update name)
   - Session persistence via sessionStorage

2. **Location Search**
   - Real-time autocomplete search
   - Searches cities, streets, landmarks, businesses
   - Filtered to India (can be removed by removing `filter: "countrycode:in"`)
   - Displays address, city, state for each result

3. **Interactive Map**
   - MapLibre GL with Geoapify tiles
   - Default view centered on Jaipur, India
   - Zoom and pan controls
   - Click anywhere to reverse geocode (get address)
   - Markers for selected places

4. **Nearby Places Discovery**
   - Categories: Restaurants, Cafes, Hospitals, Shopping, Hotels, Tourism
   - 5km radius search around map center
   - Markers on map for each place
   - Sidebar panel with list of results
   - Click to focus on place

5. **Route Planning**
   - Calculate routes between two or more locations
   - Travel modes: Car, Bike, Cycle, Walk
   - Fastest vs shortest route comparison
   - Drag-and-drop reordering of stops
   - Current location detection
   - Route visualization on map
   - Distance and time estimates

6. **Place Details**
   - Place information (address, phone, website)
   - Photos and videos gallery
   - Reviews with ratings
   - Nearby recommendations
   - Save/bookmark functionality

7. **Saved Places**
   - Save places to personal collection
   - View saved places list
   - Delete saved places
   - Prevents duplicate saves

### Known Limitations

1. **India-Only Configuration**
   - Location search is filtered to India via `countrycode:in`
   - Map is centered on Jaipur by default
   - **To fix**: Remove country filter and change default center coordinates

2. **Incomplete Location Search**
   - Does not support all locations globally
   - Some addresses may not be found
   - **Reason**: Geoapify API limitations or incomplete data
   - **Improvement**: Could use multiple geocoding providers or fallback to Google Maps API

3. **No Traffic Data**
   - Routes do not show current traffic conditions
   - Distance and time are estimates
   - **Reason**: Geoapify routing API does not provide real-time traffic
   - **To implement**: Would need Google Maps Routes API with traffic layer

4. **UI Overlapping Issues**
   - PlaceDetails panel may overlap with other elements
   - RoutePlanner panel sizing issues
   - Responsive design needs work on smaller screens
   - **Files affected**: PlaceDetails.jsx, RoutePlanner.jsx, Header.jsx, and their CSS files

5. **Two-Point Routes Only**
   - Current route planner supports origin + destination
   - Multi-stop (A → B → C) routing is partially implemented but not fully tested
   - **Code exists**: RoutePlanner.jsx has addStop() function, but UX needs refinement

6. **Empty Reviews/Photos**
   - Review and photo data is not populated
   - PlaceDetails shows empty states
   - **Reason**: No backend endpoints for reviews/photos, no integration with review APIs

---

## Future Improvements (Not Currently Implemented)

### High Priority (10-20 Days Timeline)

1. **Multi-Stop Route Planning (A → B → C)**
   - Fully implement multi-stop routing
   - Better UX for adding/removing stops
   - Route summary with leg-by-leg breakdown
   - Optimize stop order (traveling salesman problem)

2. **UI/UX Fixes**
   - Fix overlapping panels (PlaceDetails, RoutePlanner)
   - Improve responsive design for mobile/tablet
   - Better z-index management
   - Smooth transitions and animations

3. **Traffic Data Integration**
   - Show real-time traffic conditions on routes
   - Traffic-aware routing (avoid congestion)
   - Incident display (accidents, road closures)
   - **Implementation**: Requires Google Maps Routes API or similar

### Medium Priority

4. **Global Map Support**
   - Remove India-only filter
   - User can search any location worldwide
   - Auto-detect user's location on load
   - Remember last viewed location

5. **Review System**
   - Backend API for creating/retrieving reviews
   - User can submit reviews for places
   - Display aggregate ratings
   - Review moderation

6. **Photo Upload**
   - User can upload photos for places
   - Photo gallery per place
   - Image hosting integration (Cloudinary, AWS S3)

7. **Real-Time Updates**
   - WebSocket for live route updates
   - Share routes with other users
   - Collaborative trip planning

### Low Priority

8. **Advanced Features**
   - Offline map caching
   - Voice search
   - Accessibility improvements (ARIA labels, keyboard navigation)
   - Dark mode
   - Multi-language support

---

## API Integration Details

### Geoapify API

**Used for**:
- Geocoding (address → coordinates)
- Reverse geocoding (coordinates → address)
- Place search (autocomplete)
- Places discovery (nearby by category)
- Routing (path calculation)

**API Key Setup**:
1. Sign up at https://www.geoapify.com/
2. Create a project
3. Copy API key
4. Add API key to frontend `.env` file

**Rate Limits** (Free tier):
- 3,000 requests/day
- Suitable for development and small-scale use

**Why Geoapify?**
- Free tier available
- No credit card required
- OpenStreetMap-based
- Good coverage in India
- Simple API structure

### MongoDB

**Used for**:
- User data storage
- Saved places
- Reviews (when implemented)

**Connection String**:
```
mongodb://<host>:<port>/<database_name>
```
or MongoDB Atlas:
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database_name>
```

**Why MongoDB?**
- Flexible schema (easy to add fields)
- Good for geospatial queries (if needed later)
- Scalable
- Mongoose provides validation and type safety

---

## Development Workflow

### Adding a New Feature

1. **Backend (if needed)**:
   - Create model in `models/`
   - Create route in `routes/`
   - Add middleware if authentication required
   - Test with Postman/curl

2. **Frontend Service**:
   - Create API function in `services/`
   - Handle errors consistently
   - Use AbortController for cancellable requests

3. **Frontend Component**:
   - Create component in `components/` or `pages/`
   - Use React hooks for state management
   - Integrate with AuthContext if needed
   - Add routing in App.jsx if new page

4. **Styling**:
   - Add CSS to component-specific file or App.css
   - Follow existing naming conventions
   - Test responsive behavior

### Testing

**Backend tests** (in `tests/` directory):
- Run with: `npm test`
- Uses Vitest (already in package.json)

**Frontend testing**:
- Currently no test setup
- Could add React Testing Library in future

---

## Environment Variables Reference

### Backend (.env)
Required environment variables (see `.env.example`):
- Server port
- Environment mode (development/production)
- Frontend URL for CORS
- MongoDB connection string
- JWT secret key
- Token expiration time

### Frontend (.env)
Required environment variables (see `.env.example`):
- Geoapify API key
- Backend API base URL

---

## Security Features & Protection Against Hackers

### Authentication & Authorization

#### 1. Password Hashing with bcrypt
**Implementation**: User passwords are hashed using bcrypt with 12 salt rounds before storage.

**Code Location**: `backend/src/routes/authRoutes.js` line 73
```javascript
const hashedPassword = await bcrypt.hash(password, 12);
```

**Why 12 rounds?**
- bcrypt is a slow hashing algorithm by design
- 12 rounds provide a good balance between security and performance
- Each round exponentially increases the time required to hash
- Makes brute-force and rainbow table attacks impractical
- Current recommendation (2024) is 10-12 rounds

**Protection Against**:
- Brute-force password attacks
- Rainbow table attacks
- Password database leaks (even if database is compromised, passwords cannot be easily reversed)

#### 2. JWT (JSON Web Token) Authentication
**Implementation**: Stateless authentication using JWT tokens signed with a secret key.

**Code Location**: `backend/src/routes/authRoutes.js` lines 11-21
```javascript
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}
```
(Uses environment variables for secret key and expiration)
```

**How it works**:
1. User logs in → server generates JWT token
2. Token contains user ID (payload) and signature
3. Token is stored in sessionStorage on client
4. Client sends token in `Authorization: Bearer <token>` header
5. Server verifies signature using secret key
6. If valid, request proceeds; if invalid, returns 401

**Why JWT?**
- Stateless: No session storage needed on server
- Scalable: Easy to add more servers without session synchronization
- Cross-domain: Works well for SPAs and mobile apps
- Self-contained: Token contains all needed information

**Protection Against**:
- Session hijacking (tokens are signed, cannot be forged without secret)
- Session fixation (new token generated on each login)
- Server-side session storage attacks (no sessions to attack)

**Security Considerations**:
- Tokens are stored in sessionStorage (cleared on browser close)
- Token expiration set to 1 day (configurable)
- Secret key must be strong and kept secret
- Tokens are sent over HTTPS in production (prevents interception)

#### 3. Authentication Middleware
**Implementation**: Protects routes by verifying JWT tokens before allowing access.

**Code Location**: `backend/src/middleware/authMiddleware.js`

**Workflow**:
1. Extract token from Authorization header
2. Verify token signature using secret key
3. Decode token to get userId
4. Fetch user from database
5. Attach user to request object
6. If user doesn't exist or token invalid → return 401

**Protection Against**:
- Unauthorized access to protected endpoints
- Expired token usage
- Tampered tokens (signature verification)
- Access to deleted user accounts

### Network Security

#### 4. CORS (Cross-Origin Resource Sharing)
**Implementation**: Restricts which domains can access the API.

**Code Location**: `backend/src/app.js` lines 14-19
```javascript
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
```
(Uses environment variable for frontend URL, with fallback to local development URL)
  credentials: true,
}));
```

**How it works**:
- Only requests from configured origin are allowed
- Credentials (cookies, auth headers) can be included
- Prevents other websites from making requests to your API

**Protection Against**:
- CSRF (Cross-Site Request Forgery) attacks
- Unauthorized third-party API access
- Data theft from malicious websites

**Why credentials: true?**
- Allows JWT tokens to be sent in headers
- Required for authentication flow
- Safe when combined with origin restriction

#### 5. Rate Limiting
**Implementation**: Limits number of requests from a single IP.

**Code Location**: `backend/src/app.js` lines 28-35
```javascript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 100,                 // 100 requests per window
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
```

**How it works**:
- Tracks requests per IP address
- Allows 100 requests per 15 minutes
- Returns 429 (Too Many Requests) when limit exceeded
- Sliding window algorithm for accurate limiting

**Protection Against**:
- DDoS (Distributed Denial of Service) attacks
- Brute-force authentication attacks
- API abuse and scraping
- Resource exhaustion attacks

**Why these limits?**
- 100 requests per 15 minutes is reasonable for legitimate users
- Prevents automated attacks while allowing normal usage
- Can be adjusted based on traffic patterns

### HTTP Security Headers

#### 6. Helmet.js Security Headers
**Implementation**: Adds important HTTP security headers automatically.

**Code Location**: `backend/src/app.js` line 12
```javascript
app.use(helmet());
```

**Headers Added**:
- **X-Content-Type-Options: nosniff** - Prevents MIME type sniffing
- **X-Frame-Options: SAMEORIGIN** - Prevents clickjacking
- **X-XSS-Protection: 1; mode=block** - Enables XSS filtering
- **Referrer-Policy: strict-origin-when-cross-origin** - Controls referrer information
- **Content-Security-Policy** - Restricts resources browser can load
- **Strict-Transport-Security** - Enforces HTTPS (in production)

**Protection Against**:
- Clickjacking (iframe embedding)
- XSS (Cross-Site Scripting) attacks
- MIME type confusion attacks
- Information leakage via referrer headers
- Mixed content (HTTP on HTTPS pages)

#### 7. Request Size Limiting
**Implementation**: Limits size of incoming JSON requests.

**Code Location**: `backend/src/app.js` line 22
```javascript
app.use(express.json({ limit: "10kb" }));
```

**Protection Against**:
- DoS attacks via large payloads
- Memory exhaustion
- JSON parsing vulnerabilities
- Buffer overflow attacks

**Why 10kb?**
- Sufficient for typical API requests (login, place data)
- Prevents abuse with large payloads
- Can be increased if needed for specific endpoints

### Input Validation & Sanitization

#### 8. Backend Input Validation
**Implementation**: Validates all user inputs before processing.

**Code Locations**:
- `backend/src/routes/authRoutes.js` - Email format, password length, name length
- `backend/src/routes/savedPlaceRoutes.js` - Coordinate ranges, required fields

**Examples**:
```javascript
// Email validation
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
  return res.status(400).json({
    success: false,
    message: "Please enter a valid email address",
  });
}

// Coordinate validation
if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
  return res.status(400).json({
    success: false,
    message: "Valid latitude and longitude are required.",
  });
}
```

**Protection Against**:
- SQL injection (using MongoDB prevents this, but validation adds layer)
- NoSQL injection (MongoDB query injection)
- Buffer overflow
- Invalid data corruption
- Business logic bypass

#### 9. MongoDB NoSQL Injection Prevention
**Implementation**: Using Mongoose ODM prevents NoSQL injection.

**How Mongoose protects**:
- Schema validation enforces data types
- Query builder escapes special characters
- No raw MongoDB queries from user input
- Parameterized queries internally

**Protection Against**:
- NoSQL injection attacks
- Authentication bypass via query manipulation
- Data exfiltration

**Why MongoDB + Mongoose?**
- NoSQL databases are inherently less vulnerable to SQL injection
- Mongoose adds schema validation and type casting
- Query builder prevents direct user input in queries

### Data Protection

#### 10. Password Field Exclusion
**Implementation**: Password field is excluded from query results by default.

**Code Location**: `backend/src/models/User.js` line 26
```javascript
password: {
  type: String,
  required: true,
  select: false,  // Excluded by default
  minlength: 8,
}
```

**How it works**:
- Password is never returned in normal queries
- Must explicitly use `.select('+password')` to include
- Prevents accidental password exposure in API responses

**Protection Against**:
- Password leakage in API responses
- Logs containing passwords
- Accidental password display

#### 11. Environment Variable Protection
**Implementation**: Sensitive data stored in environment variables, not in code.

**Files**: `.env` files (in .gitignore)

**Protected Data**:
- JWT secret key
- MongoDB connection string
- API keys
- Database credentials

**Protection Against**:
- Credential exposure in version control
- Hardcoded secrets in deployed code
- Accidental commits of sensitive data

**Best Practices**:
- `.env` files in .gitignore
- `.env.example` for documentation
- Different secrets for dev/staging/production
- Rotate secrets periodically

### Frontend Security

#### 12. Session Storage Usage
**Implementation**: JWT tokens stored in sessionStorage, not localStorage.

**Code Location**: `frontend/src/context/AuthContext.jsx` lines 13-16
```javascript
token: sessionStorage.getItem("goku_token"),
user: JSON.parse(sessionStorage.getItem("goku_user") || "null"),
```

**Why sessionStorage over localStorage?**
- Cleared when browser/tab closes
- Better security than localStorage (persists across sessions)
- Prevents long-term token persistence on shared devices

**Trade-off**:
- User must log in again after closing browser
- Better security for shared/public computers

#### 13. Client-Side Validation
**Implementation**: Form validation before API calls.

**Examples**:
- Required field checks
- Email format validation
- Password strength requirements

**Protection Against**:
- Unnecessary API calls
- User error
- Basic input validation (frontend validation is not a substitute for backend validation)

### Error Handling

#### 14. Centralized Error Handling
**Implementation**: Consistent error responses without exposing sensitive information.

**Code Location**: `backend/src/app.js` lines 62-72
```javascript
app.use((err, req, res, next) => {
  req.log?.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Something went wrong",
  });
});
```
(Uses environment variable to determine error message detail level)

**Protection Against**:
- Information leakage (stack traces, file paths)
- Attack reconnaissance via error messages
- Sensitive data exposure in errors

**Why environment-specific messages?**
- Development: Full error messages for debugging
- Production: Generic messages to prevent information leakage

### Additional Security Recommendations

#### Not Yet Implemented (Future Enhancements):

1. **HTTPS Enforcement**
   - Redirect HTTP to HTTPS
   - HSTS header for strict HTTPS
   - SSL/TLS certificate management

2. **CSRF Protection**
   - CSRF tokens for state-changing operations
   - SameSite cookie attributes
   - Double-submit cookie pattern

3. **Input Sanitization**
   - Sanitize HTML in user-generated content
   - Prevent XSS in reviews/comments
   - DOMPurify library for HTML sanitization

4. **Password Strength Requirements**
   - Enforce complexity rules (uppercase, numbers, special chars)
   - Password strength meter on frontend
   - Prevent common passwords

5. **Account Lockout**
   - Lock account after failed login attempts
   - Time-based lockout (exponential backoff)
   - Email verification for unlock

6. **Email Verification**
   - Verify email addresses during registration
   - Send verification token via email
   - Prevent temporary email services

7. **Two-Factor Authentication (2FA)**
   - TOTP (Time-based One-Time Password)
   - SMS verification
   - Backup codes

8. **API Key Rotation**
   - Regular rotation of JWT secret key
   - Key versioning for graceful rotation
   - Automated key management

9. **Security Headers Enhancement**
   - Content Security Policy (CSP) with strict rules
   - Subresource Integrity (SRI) for external scripts
   - Permission Policy header

10. **Security Logging & Monitoring**
    - Log authentication attempts
    - Monitor for suspicious patterns
    - Alert on rate limit violations
    - Audit trail for sensitive operations

---

## System Design & Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   React SPA  │  │  MapLibre GL │  │   Geoapify   │       │
│  │   (Frontend) │  │   (Maps)     │  │   (Direct)   │       │
│  └──────┬───────┘  └──────────────┘  └──────────────┘       │
│         │                                                        │
└─────────┼──────────────────────────────────────────────────────┘
          │ HTTP/HTTPS
          │ JSON
┌─────────▼──────────────────────────────────────────────────────┐
│                    Express.js Backend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Auth       │  │  Saved       │  │   Health     │       │
│  │   Routes     │  │  Places      │  │   Check      │       │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘       │
│         │                  │                                  │
│  ┌──────▼──────────────────▼──────┐                           │
│  │     Authentication Middleware   │                           │
│  │          (JWT Verification)     │                           │
│  └──────┬───────────────────────────┘                           │
│         │                                                        │
│  ┌──────▼───────────────────────────┐                         │
│  │         Business Logic           │                         │
│  │    (Controllers/Services)        │                         │
│  └──────┬───────────────────────────┘                         │
│         │                                                        │
│  ┌──────▼───────────────────────────┐                         │
│  │        Data Access Layer          │                         │
│  │         (Mongoose ODM)            │                         │
│  └──────┬───────────────────────────┘                         │
└─────────┼──────────────────────────────────────────────────────┘
          │ Mongoose Driver
          │ MongoDB Protocol
┌─────────▼──────────────────────────────────────────────────────┐
│                    MongoDB Database                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Users      │  │  Saved       │  │   Reviews    │       │
│  │   Collection │  │  Places      │  │   Collection │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Architectural Patterns

#### 1. Client-Server Architecture
**Pattern**: Separation of frontend (client) and backend (server)

**Frontend (Client)**:
- React Single Page Application (SPA)
- Runs entirely in user's browser
- Communicates with backend via HTTP/HTTPS
- Handles all UI logic and user interactions
- Directly calls Geoapify API for map services

**Backend (Server)**:
- Express.js REST API
- Handles business logic and data persistence
- Manages authentication and authorization
- Provides protected endpoints for sensitive operations

**Why this pattern?**
- Clear separation of concerns
- Independent scaling (frontend and backend can scale separately)
- Multiple client support (web, mobile can use same backend)
- Simplified deployment and maintenance

#### 2. RESTful API Design
**Pattern**: Resource-based API with standard HTTP methods

**API Endpoints**:
```
POST   /api/v1/auth/register       - Create user
POST   /api/v1/auth/login          - Authenticate user
GET    /api/v1/auth/me             - Get current user
PUT    /api/v1/auth/me             - Update current user
GET    /api/v1/saved-places        - Get saved places
POST   /api/v1/saved-places        - Save place
DELETE /api/v1/saved-places/:id    - Delete saved place
GET    /api/v1/health              - Health check
```

**REST Principles**:
- **Resource-based**: URLs represent resources (users, saved-places)
- **HTTP methods**: GET (read), POST (create), PUT (update), DELETE (remove)
- **Stateless**: Each request contains all needed information
- **Uniform interface**: Consistent API structure
- **JSON format**: Standard request/response format

**Why REST?**
- Industry standard
- Easy to understand and use
- Good tooling support (Postman, curl)
- Cacheable responses
- Stateless scaling

#### 3. Modular Monolith
**Pattern**: Single deployable unit with modular internal structure

**Modules**:
- Authentication module (routes, middleware, models)
- Saved places module (routes, models)
- Health check module
- Future: Reviews module, Places module

**Why not microservices?**
- Microservices add complexity (network calls, service discovery, distributed tracing)
- For current scale, monolith is simpler and faster to develop
- Easier deployment (single artifact)
- Lower operational overhead
- Can split into microservices later if needed

**Why modular?**
- Clear boundaries between features
- Easier to understand and maintain
- Can extract modules to microservices later
- Team can work on modules independently

#### 4. Repository Pattern (via Mongoose)
**Pattern**: Mongoose ODM acts as repository for data access

**Implementation**:
```javascript
// Model defines schema and acts as repository
const user = await User.findOne({ email });
await user.save();
await SavedPlace.create({ ... });
```

**Benefits**:
- Abstraction over MongoDB
- Schema validation
- Type safety
- Built-in methods (find, create, update, delete)
- Middleware hooks (pre-save, post-save)

#### 5. Middleware Pattern
**Pattern**: Chain of functions that process requests sequentially

**Express Middleware Chain**:
```
Request → Helmet → CORS → JSON Parser → Rate Limiter → Auth Middleware → Route Handler → Response
```

**Benefits**:
- Reusable components
- Separation of concerns
- Easy to add/remove functionality
- Request/response transformation

### Data Flow Diagrams

#### Authentication Flow
```
User              Frontend              Backend              MongoDB
 │                   │                    │                    │
 │─Submit Login─────>│                    │                    │
 │                   │─POST /auth/login──>│                    │
 │                   │                    │─Find user────────>│
 │                   │                    │<──User data────────│
 │                   │                    │                    │
 │                   │                    │─Compare password───│
 │                   │                    │                    │
 │                   │<──Token + user─────│                    │
 │<──Dashboard───────│                    │                    │
 │                   │                    │                    │
 │─API Request──────>│                    │                    │
 │                   │─GET /api/me (token)│                    │
 │                   │                    │─Verify token────────│
 │                   │                    │                    │
 │                   │<──User data────────│                    │
 │<──Response────────│                    │                    │
```

#### Save Place Flow
```
User              Frontend              Backend              MongoDB
 │                   │                    │                    │
 │─Click Save───────>│                    │                    │
 │                   │─Check auth─────────│                    │
 │                   │─POST /saved-places>│                    │
 │                   │                    │─Verify token────────│
 │                   │                    │                    │
 │                   │                    │─Validate data──────>│
 │                   │                    │<──Validation OK─────│
 │                   │                    │                    │
 │                   │                    │─Create place────────>│
 │                   │                    │<──Created place─────│
 │                   │<──Success──────────│                    │
 │<──UI Updated──────│                    │                    │
```

#### Search Place Flow
```
User              Frontend           Geoapify API         MapLibre
 │                   │                    │                    │
 │─Type search──────>│                    │                    │
 │                   │─Debounce 350ms─────│                    │
 │                   │                    │                    │
 │                   │─GET /geocode/autocomplete──────────────>│
 │                   │<──Suggestions──────│                    │
 │<──Dropdown────────│                    │                    │
 │                   │                    │                    │
 │─Select place─────>│                    │                    │
 │                   │                    │                    │
 │                   │                    │                    │
 │                   │                    │                    │
 │                   │─Update map────────────────────────────>│
 │<──Map update──────│                    │                    │
```

#### Route Calculation Flow
```
User              Frontend           Geoapify API         MapLibre
 │                   │                    │                    │
 │─Enter A & B─────>│                    │                    │
 │                   │                    │                    │
 │                   │─GET /routing──────>│                    │
 │                   │<──Route data───────│                    │
 │                   │                    │                    │
 │                   │─Draw route────────────────────────────>│
 │<──Route display───│                    │                    │
```

### Database Schema Design

#### User Collection
```javascript
{
  _id: ObjectId,
  name: String (required, 2-50 chars),
  email: String (required, unique, lowercase),
  password: String (required, hashed, hidden),
  avatar: String (optional),
  isVerified: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `email` (unique) - Fast login queries
- `name` (text) - User search (future feature)

**Why this schema?**
- Minimal fields for MVP
- Email uniqueness prevents duplicate accounts
- Password hidden by default for security
- Timestamps for auditing

#### SavedPlace Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User, required),
  placeId: String (required),
  name: String (required),
  address: String,
  latitude: Number (required, -90 to 90),
  longitude: Number (required, -180 to 180),
  category: String,
  website: String,
  phone: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `user` - Fast user-specific queries
- `user + placeId` (unique, compound) - Prevent duplicates
- `latitude + longitude` (2dsphere) - Geospatial queries (future)

**Why this schema?**
- Denormalized place data (not referencing places collection)
- Faster reads (no joins)
- User-scoped (cannot access other users' saves)
- Coordinates for map display

#### Review Collection
```javascript
{
  _id: ObjectId,
  placeId: String (required, indexed),
  placeName: String (required),
  userId: ObjectId (ref: User, required),
  rating: Number (required, 1-5),
  comment: String (required, max 1000 chars),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
- `placeId` - Fast place-specific queries
- `userId` - Fast user-specific queries
- `placeId + userId` (unique) - One review per user per place

**Why this schema?**
- Prevents duplicate reviews from same user
- Rating range enforced
- Comment length limited
- PlaceId indexed for aggregation (average rating)

### Scalability Considerations

#### Current Design (Small Scale)
- Single MongoDB instance
- Single backend server
- Frontend served from same domain or CDN
- Suitable for: < 10,000 users, < 100 req/sec

#### Scaling Strategies (When Needed)

**Backend Scaling**:
1. **Horizontal Scaling**: Add more backend servers behind load balancer
2. **Stateless Design**: JWT authentication enables easy scaling
3. **Caching**: Redis for frequently accessed data (user sessions, place details)
4. **Database Sharding**: Split data across multiple MongoDB instances
5. **Read Replicas**: Multiple read-only MongoDB copies

**Frontend Scaling**:
1. **CDN Distribution**: Serve static assets from CloudFlare, AWS CloudFront
2. **Lazy Loading**: Code splitting for faster initial load
3. **Service Workers**: Offline caching, PWA capabilities
4. **Image Optimization**: WebP format, responsive images

**Database Scaling**:
1. **MongoDB Atlas**: Managed MongoDB service with auto-scaling
2. **Connection Pooling**: Reuse database connections
3. **Query Optimization**: Add indexes for slow queries
4. **Data Archiving**: Move old data to cold storage

### Performance Optimization

#### Backend Optimizations
1. **Connection Pooling**: Mongoose maintains connection pool
2. **Query Optimization**: Use indexes, avoid N+1 queries
3. **Response Compression**: gzip/deflate middleware
4. **Caching Headers**: Set cache-control for static resources
5. **Rate Limiting**: Prevent abuse that impacts performance

#### Frontend Optimizations
1. **Code Splitting**: Lazy load routes with React.lazy()
2. **Bundle Size**: Tree shaking, remove unused dependencies
3. **Image Optimization**: Compress images, use WebP
4. **Debouncing**: Search input debounced to 350ms
5. **Abort Controller**: Cancel pending requests on new input

#### Map Optimizations
1. **Tile Caching**: MapLibre caches map tiles
2. **Marker Clustering**: Group nearby markers (future)
3. **Lazy Loading**: Load map data on demand
4. **Vector Tiles**: Use vector tiles instead of raster (future)

### Failure Scenarios & Resilience

#### Backend Failures
1. **Database Connection Loss**:
   - Retry logic with exponential backoff
   - Circuit breaker pattern
   - Graceful degradation (cached responses)

2. **External API Failure (Geoapify)**:
   - Fallback to cached data
   - Display error message to user
   - Retry with exponential backoff

3. **Server Crash**:
   - Process manager (PM2) auto-restart
   - Health check endpoint for monitoring
   - Graceful shutdown on SIGTERM

#### Frontend Failures
1. **Network Error**:
   - Display user-friendly error message
   - Retry button for failed requests
   - Offline support (service workers)

2. **API Timeout**:
   - Abort long-running requests
   - Show loading indicator
   - Allow user to cancel

### Monitoring & Observability

#### Current Implementation
- HTTP request logging via pino-http
- Error logging in centralized handler
- Health check endpoint

#### Recommended Additions
1. **Application Performance Monitoring (APM)**:
   - New Relic, Datadog, or Sentry
   - Track response times, error rates
   - User performance metrics

2. **Logging**:
   - Structured logging (JSON format)
   - Log aggregation (ELK stack, Loki)
   - Log levels (error, warn, info, debug)

3. **Metrics**:
   - Request count, response time
   - Database query performance
   - Error rate by endpoint
   - User engagement metrics

4. **Alerting**:
   - High error rate alerts
   - Database connection failures
   - API rate limit breaches
   - Server downtime

### Design Decisions & Trade-offs

#### Decision 1: JWT vs Session-based Auth
**Chosen**: JWT tokens
**Trade-offs**:
- ✅ Stateless, scalable
- ✅ Works well for SPAs
- ❌ Cannot easily revoke tokens
- ❌ Token size larger than session ID

**Mitigation**: Short expiration (1 day), refresh tokens (future)

#### Decision 2: MongoDB vs PostgreSQL
**Chosen**: MongoDB
**Trade-offs**:
- ✅ Flexible schema (easy to add fields)
- ✅ Good for geospatial data
- ✅ JSON-native
- ❌ No ACID transactions (until recently)
- ❌ Less mature than SQL

**Mitigation**: Use Mongoose for schema validation, consider PostgreSQL if relational features needed

#### Decision 3: Geoapify vs Google Maps
**Chosen**: Geoapify
**Trade-offs**:
- ✅ Free tier available
- ✅ No credit card required
- ✅ Open-source friendly
- ❌ Less global coverage
- ❌ Fewer features (no traffic, street view)

**Mitigation**: Can switch to Google Maps API if needed

#### Decision 4: Direct Geoapify Calls vs Backend Proxy
**Chosen**: Frontend calls Geoapify directly
**Trade-offs**:
- ✅ Reduces backend load
- ✅ Faster (no proxy overhead)
- ❌ API key exposed in frontend
- ❌ Cannot add server-side logic

**Mitigation**: Rate limiting, Geoapify allows frontend keys, consider proxy for sensitive operations

#### Decision 5: sessionStorage vs localStorage
**Chosen**: sessionStorage
**Trade-offs**:
- ✅ More secure (cleared on close)
- ✅ Better for shared devices
- ❌ User must re-login often
- ❌ Cannot persist across browser restarts

**Mitigation**: Remember me feature with localStorage (future)

### Future Architecture Evolution

#### Phase 1: Microservices (When team grows)
- Split into: Auth Service, Places Service, Routing Service, Reviews Service
- API Gateway for routing
- Service discovery (Consul, etcd)
- Inter-service communication (REST, gRPC)

#### Phase 2: Event-Driven Architecture
- Message queue (RabbitMQ, Kafka)
- Event sourcing for audit trail
- CQRS (Command Query Responsibility Segregation)
- Real-time updates via WebSockets

#### Phase 3: Serverless
- AWS Lambda for backend functions
- API Gateway for routing
- DynamoDB for data (or keep MongoDB Atlas)
- Cost-effective for variable traffic

#### Phase 4: Edge Computing
- Cloudflare Workers for edge logic
- CDN with edge functions
- Reduced latency worldwide
- Better global performance

---

## Troubleshooting

### Common Issues

1. **MongoDB connection failed**
   - Ensure MongoDB is running
   - Check MongoDB connection string in .env
   - Verify network connectivity

2. **API key errors**
   - Verify Geoapify API key is set in frontend .env
   - Check API key is valid and active
   - Ensure not exceeded rate limits

3. **CORS errors**
   - Check frontend origin URL in backend .env matches actual frontend URL
   - Ensure backend is running
   - Check firewall settings

4. **Map not loading**
   - Verify Geoapify API key
   - Check browser console for errors
   - Ensure internet connectivity

5. **Route calculation fails**
   - Verify coordinates are valid
   - Check if locations are too far apart
   - Geoapify may not have routing data for all areas

---

## Deployment Notes

### Backend Deployment
- Use Node.js hosting (Heroku, Railway, Render, AWS)
- Set environment variables in hosting platform
- Use production MongoDB instance (MongoDB Atlas)
- Set NODE_ENV=production
- Use process manager (PM2) for production

### Frontend Deployment
- Build with `npm run build`
- Deploy static files to Vercel, Netlify, or AWS S3
- Set backend API URL in frontend .env to production backend URL
- Enable HTTPS
- Configure CORS in backend to allow production domain

---

## Summary

Goku is a location-based web application with the following key characteristics:

**Strengths**:
- Clean modular architecture
- Separation of concerns (frontend/backend)
- Authentication system with JWT
- Map integration with open-source libraries
- Route planning capabilities
- Place discovery and search

**Current Limitations**:
- India-focused configuration
- No traffic data
- UI overlapping issues
- Limited to two-point routing (partially implemented multi-stop)
- Empty review/photo data

**Development Status**:
- Core features are functional
- Authentication and user management complete
- Map and routing working
- Backend API structure ready for expansion
- Frontend components well-organized

**Next Steps** (10-20 days):
1. Fix UI overlapping issues
2. Implement multi-stop routing (A → B → C)
3. Consider traffic data integration
4. Improve location search coverage
5. Add review/photo backend APIs

This application provides a solid foundation for a location services platform and can be extended with additional features as needed.