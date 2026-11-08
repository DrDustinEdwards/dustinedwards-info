// Tags and alt text a model suggests for a picture: site-api's mediaSuggester (Claude Haiku 5.5, straight at Anthropic
// with ANTHROPIC_API_KEY). Nothing here writes: a suggestion reaches the file only when a person accepts it,
// as an alt or a tags write. Only Dustin's own uploads are sent, never a visitor's data.

import { mediaSuggester } from "@dustinedwards/site-api";

/** What the model suggests for one stored picture. Throws when the site has no ANTHROPIC_API_KEY. */
export const suggestFor = mediaSuggester({
  app: "dustinedwards",
  describe: "on a scientist's personal website",
});
