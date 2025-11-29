const API_BASE = "/api";

export interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// Store token in localStorage
const TOKEN_KEY = "moocuan_token";
const USER_KEY = "moocuan_user";

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getUser = (): User | null => {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

export const setAuth = (token: string, user: User): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = (): boolean => {
  const token = getToken();
  const user = getUser();
  return !!token && !!user && user.status === "approved";
};

export const isAdmin = (): boolean => {
  const user = getUser();
  return !!user && user.role === "admin";
};

export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (result.success && result.token && result.user) {
    setAuth(result.token, result.user);
  }

  return result;
};

export const logout = (): void => {
  clearAuth();
  window.location.href = "/login";
};

export const verifyToken = async (): Promise<AuthResponse> => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "No token found" };
  }

  const response = await fetch(`${API_BASE}/auth/verify`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
};

// Admin functions
export const getPendingUsers = async (): Promise<{ success: boolean; users?: User[] }> => {
  const token = getToken();
  const response = await fetch(`${API_BASE}/auth/pending-users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};

export const getAllUsers = async (): Promise<{ success: boolean; users?: User[] }> => {
  const token = getToken();
  const response = await fetch(`${API_BASE}/auth/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};

export const approveUser = async (userId: number): Promise<AuthResponse> => {
  const token = getToken();
  const response = await fetch(`${API_BASE}/auth/approve/${userId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};

export const rejectUser = async (userId: number): Promise<AuthResponse> => {
  const token = getToken();
  const response = await fetch(`${API_BASE}/auth/reject/${userId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};
