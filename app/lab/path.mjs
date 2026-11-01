// The members' workspace (the Lab bench) lives at one path, and Capsomer owns it: the footer's Lab bench link is
// Capsomer's (capsomer/behavior/family-footer), so the route, the links inside the workspace, the robots and prefetch
// exclusions, the admin-idle prefix and the admin CSP all import the same constant and cannot disagree with the footer.
// Not /lab, which is kept free, and not /research/lab, which is the public registry (LAB_PATH in kb/registry/catalog.mjs).
export { LAB_BENCH_PATH } from "capsomer/behavior/family-footer";
