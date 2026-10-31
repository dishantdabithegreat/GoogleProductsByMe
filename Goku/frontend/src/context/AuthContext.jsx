import {
  createContext,
  useContext,
  useState,
} from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      return {
        token: sessionStorage.getItem("goku_token"),
        user: JSON.parse(
          sessionStorage.getItem("goku_user") || "null"
        ),
      };
    } catch {
      return { token: null, user: null };
    }
  });

  function saveSession(token, user) {
    sessionStorage.setItem("goku_token", token);
    sessionStorage.setItem("goku_user", JSON.stringify(user));
    setAuth({ token, user });
  }

  function logout() {
    sessionStorage.removeItem("goku_token");
    sessionStorage.removeItem("goku_user");
    setAuth({ token: null, user: null });
  }

  return (
    <AuthContext.Provider
      value={{
        token: auth.token,
        user: auth.user,
        isAuthenticated: Boolean(auth.token && auth.user),
        saveSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}