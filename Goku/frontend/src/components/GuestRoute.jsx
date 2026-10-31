import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function GuestRoute() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated
    ? <Navigate to="/" replace />
    : <Outlet />;
}