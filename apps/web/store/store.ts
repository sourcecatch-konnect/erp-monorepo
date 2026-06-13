import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "@/features/auth/store/authSlice";

/**
 * Root store. Each feature owns its slice; the store only composes them.
 * Import feature reducers from the feature's store file directly (not its
 * barrel) to keep store bootstrapping free of circular imports.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
