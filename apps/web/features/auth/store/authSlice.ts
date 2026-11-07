import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getMe, webLogin, webLogout } from "../services/auth.service";
import type { AuthState, AuthUser, LoginPayload } from "../types";

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
  refreshing: false,
};

/** Logs in via /auth/login, then hydrates permissions via /auth/me. */
export const login = createAsyncThunk<
  AuthUser,
  LoginPayload,
  { rejectValue: string }
>("auth/login", async (payload, { rejectWithValue }) => {
  try {
    await webLogin(payload);
    return await getMe();
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : "Login failed");
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
      err instanceof Error ? err.message : "Not authenticated",
    );
  }
});

/**
 * Silent re-read of the session, for when our `permissions` list may be stale:
 * the window regained focus, or the server just refused something the UI
 * offered. Unlike `fetchMe` it never moves `status` to `loading`, so nothing
 * on screen flickers, and a failure is ignored — the existing session stands
 * until a real 401 tears it down.
 */
export const refreshMe = createAsyncThunk<AuthUser, void>(
  "auth/refreshMe",
  () => getMe(),
  {
    // One at a time, so a burst of 403s doesn't trigger a burst of requests.
    condition: (_, { getState }) =>
      !(getState() as { auth: AuthState }).auth.refreshing,
  },
);

/** Logs out and clears cookies; local state is cleared regardless. */
export const logout = createAsyncThunk("auth/logout", async () => {
  await webLogout();
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
      .addCase(refreshMe.pending, (state) => {
        state.refreshing = true;
      })
      .addCase(refreshMe.fulfilled, (state, action) => {
        state.refreshing = false;
        // Only refresh a live session — never resurrect one that's been torn
        // down while this request was in flight.
        if (state.status !== "authenticated") return;
        state.user = action.payload;
      })
      .addCase(refreshMe.rejected, (state) => {
        state.refreshing = false;
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
