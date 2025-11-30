const API_BASE = "/api";

// Logout callbacks registry
const logoutCallbacks: (() => void)[] = [];

export const onLogout = (callback: () => void): (() => void) => {
  logoutCallbacks.push(callback);
  // Return unsubscribe function
  return () => {
    const index = logoutCallbacks.indexOf(callback);
    if (index > -1) logoutCallbacks.splice(index, 1);
  };
};

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

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Store token in localStorage
const TOKEN_KEY = "moocuan_token";
const USER_KEY = "moocuan_user";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const getUser = (): User | null => {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

export const setAuth = (token: string, user: User): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = (): void => {
  if (typeof window === "undefined") return;
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

  const result: AuthResponse = await response.json();

  if (result.success && result.token && result.user) {
    setAuth(result.token, result.user);
  }

  return result;
};

export const logout = (): void => {
  // Call all logout callbacks (e.g., clear watchlist)
  logoutCallbacks.forEach((cb) => cb());
  clearAuth();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
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

  const result: AuthResponse = await response.json();

  // Optional: update user info lokal kalau masih valid
  if (result.success && result.user) {
    setAuth(token, result.user);
  } else if (!result.success) {
    // Kalau token invalid, auto logout
    logout();
  }

  return result;
};

// ===============
//  CHANGE PASSWORD
// ===============
export const changePassword = async (data: ChangePasswordData): Promise<AuthResponse> => {
  const token = getToken();
  if (!token) {
    return { success: false, message: "Anda belum login" };
  }

  const response = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const result: AuthResponse = await response.json();

  // Kalau backend bilang unauthorized, auto logout
  if (!result.success && result.message?.toLowerCase().includes("unauthorized")) {
    logout();
  }

  return result;
};

// ===============
//  ADMIN FUNCTIONS
// ===============
export const getPendingUsers = async (): Promise<{
  success: boolean;
  users?: User[];
}> => {
  const token = getToken();
  const response = await fetch(`${API_BASE}/auth/pending-users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};

export const getAllUsers = async (): Promise<{
  success: boolean;
  users?: User[];
}> => {
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
