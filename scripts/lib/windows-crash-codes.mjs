/** NTSTATUS codes that reach a parent as an exit code on Windows: a crash, never a gate verdict. */
export const WINDOWS_CRASH_CODES = new Map([
  [0xc0000142, "STATUS_DLL_INIT_FAILED"],
  [0xc0000017, "STATUS_NO_MEMORY"],
  [0xc0000005, "STATUS_ACCESS_VIOLATION"],
  [0xc0000374, "STATUS_HEAP_CORRUPTION"],
]);
