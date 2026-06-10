import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  adminLogin,
  adminLogout,
  getMe,
} from "../services/auth.service";
import type { AuthState, AuthUser, LoginPayload } from "../types";

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

/** Logs in via /auth/admin/login. */
export const login = createAsyncThunk<
  AuthUser,
  LoginPayload,
  { rejectValue: string }
>("auth/login", async (payload, { rejectWithValue }) => {
  try { 
    return  await adminLogin(payload);
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : "Login failed"
    );
  }
});

/** Restores the session on app load (persistent login). */
export const fetchMe = createAsyncThunk<
  AuthUser,
  void,
  { rejectValue: string }
>("auth/fetchMe", async (_, { rejectWithValue }) => {
  try {
    return await getMe();
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : "Not authenticated"
    );
  }
});

/** Logs out and clears cookies; local state is cleared regardless. */
export const logout = createAsyncThunk("auth/logout", async () => {
  await adminLogout();
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** Triggered by the axios interceptor when refresh fails. */
    sessionExpired(state) {
      state.user = null;
      state.status = "unauthenticated";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.user = null;
        state.status = "unauthenticated";
        state.error = action.payload ?? "Login failed";
      })
      .addCase(fetchMe.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
        state.error = null;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.status = "unauthenticated";
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = "unauthenticated";
        state.error = null;
      })
      .addCase(logout.rejected, (state) => {
        // Logout failed server-side, but clear the client session anyway.
        state.user = null;
        state.status = "unauthenticated";
      });
  },
});

export const { sessionExpired } = authSlice.actions;
export const authReducer = authSlice.reducer;
