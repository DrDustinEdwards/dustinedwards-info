import { enhance } from "capsomer/behaviour/catalog";

/*
 * The protocol library's search, facets and sort (Capsomer's catalog). The server rendered the whole form with
 * the result for the address, so with script off every control still works: it is a GET form, and the chips, the
 * sort headers and the pages are links. This attaches to each catalog on the page, hides Apply, and swaps the
 * results in place as a person types or chooses. If an update fails the browser goes to the address, which is
 * what the link would have done.
 */
enhance();
