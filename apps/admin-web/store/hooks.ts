import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from "react-redux";
import type { AppDispatch, RootState } from "./store";

/** Typed dispatch — use instead of plain useDispatch. */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/** Typed selector — use instead of plain useSelector. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
