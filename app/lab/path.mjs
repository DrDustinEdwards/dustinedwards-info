// The members' workspace (the Lab bench) lives at one path. Everything that names it imports it from here: the route,
// the links inside it, the robots and prefetch exclusions, the admin-idle prefix and the admin CSP. The footer's Lab
// bench link is Capsomer's (capsomer/behavior/family-footer), so test/nav.test.mjs pins that the two agree.
// Not /lab, which is kept free, and not /research/lab, which is the public registry (LAB_PATH in kb/registry/catalog.mjs).
export const LAB_BENCH_PATH = "/lab-bench";
