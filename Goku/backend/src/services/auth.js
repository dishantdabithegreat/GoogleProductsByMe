const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

async function authRequest(endpoint, userData) {
  const response = await fetch(`${API_URL}/auth/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Authentication failed");
  }

  return data;
}

export function registerUser(userData) {
  return authRequest("register", userData);
}

export function loginUser(userData) {
  return authRequest("login", userData);
}

export async function updateCurrentUser(token, userData) {
  const response = await fetch(`${API_URL}/auth/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to update profile");
  }

  return data.user;
}