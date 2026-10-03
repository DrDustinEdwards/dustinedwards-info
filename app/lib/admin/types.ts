// Type-only: imported by client components too, so nothing here may execute code or touch bindings.

export type SourceResult<T> =
  | { status: "live"; data: T; fetchedAt: string }
  | { status: "error"; data: null; message: string };
