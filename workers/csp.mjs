/**
 * The Content Security Policy, as a function both the Worker and its gate call.
 *
 * **IT LIVES HERE RATHER THAN IN `app.ts` BECAUSE THE POLICY IS NOW
 * CONDITIONAL, AND A CONDITIONAL POLICY CAN BE WRONG IN ONE BRANCH.**
 * A regex over the source can see that both branches exist. It cannot see
 * which one a given request gets, and asserting the branch by reading the
 * caller's `if` would be a mirror of the caller.
 *
 * So the gate IMPORTS this and CALLS it, once per branch, and asserts the
 * strings it actually returns. Same module the Worker runs, no second copy to
 * drift, and the discipline this repo already applies to `records.mjs` and
 * `ask-keys.mjs`: one derivation, imported by everything that needs it.
 *
 * `workers/` rather than `app/` because this is response policy, which is the
 * Worker's boundary and not the router's.
 */

/** Where violation reports are posted. Public and unauthenticated, by design. */
export const CSP_REPORT_PATH = "/api/csp-report";

/** The `Reporting-Endpoints` name `report-to` refers to. */
export const CSP_ENDPOINT_NAME = "csp-endpoint";

/**
 * Whether a path is on the admin plane, and therefore whether its policy
 * carries the style nonce.
 *
 * **THE BRANCH KEY IS THE PATH, AND IT IS EXACT-OR-SLASH RATHER THAN A BARE
 * PREFIX.** `startsWith("/admin")` alone would also match `/administrator`,
 * `/admin-tools` and anything else that merely begins with those six
 * characters. No such route exists today, which is precisely why the loose
 * form would be safe today and would stop being safe the moment one is added,
 * without anything failing. The exact-or-slash form cannot acquire that
 * problem.
 *
 * **WHAT DECIDES THE BRANCH IS THE PATH, NOT THE SESSION, AND THE FAILURE MODE
 * TO RULE OUT IS A REQUEST THAT GETS THE ADMIN POLICY WITHOUT BEING ADMIN.**
 * That request exists: an unauthenticated GET of an admin path is 302'd to
 * /login by the layout middleware, and the response policy is stamped in the
 * Worker's exit path, which runs on the redirect too. So yes, an anonymous
 * caller can obtain a policy carrying `'nonce-X'` in `style-src`. It buys
 * nothing:
 *
 *   - a 302 HAS NO BODY, so there is no element for the nonce to authorize
 *   - the nonce is single-use by construction, minted per request, and that
 *     response is `private, no-store` (it carries no `Vary`, so it reaches the
 *     uncached default), so it is never stored in a shared cache and never
 *     served to a second reader
 *   - a nonce in `style-src` does not weaken `'self'`; there is no
 *     `'strict-dynamic'` for styles, so the allowlist keeps applying
 *
 * The session cannot be the key even if it were preferable: the policy is built
 * in the Worker's exit path, which is deliberately downstream of the router and
 * knows nothing about Better Auth. Keying on the path is the honest choice
 * because the path is what that layer actually has.
 *
 * **`.data` REQUESTS SPLIT ACROSS THE TEST, and the first version of this note
 * got it wrong in a way `check:headers` caught in the same session it was
 * written.** It claimed both were outside. React Router serializes the layout's
 * own fetch as `/admin.data`, which matches neither arm and gets the public
 * policy; but a child route's is `/admin/posts.data`, which DOES match the
 * slash arm and gets the admin policy. So the split is real and it is not the
 * tidy one the note asserted.
 *
 * It does not matter either way, which is why the test is left alone: a `.data`
 * response is JSON, it contains no style element for a nonce to authorize, and
 * it is `private, no-store` on both arms. Recorded rather than smoothed over,
 * because the tidy version of this sentence is the one a later reader would
 * believe.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * @param {string} nonce the per-request nonce, already in the render context
 * @param {boolean} styleNonce whether `style-src` accepts that nonce too
 * @returns {string}
 */
export function contentSecurityPolicy(nonce, styleNonce) {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    /*
     * **THE STYLE NONCE IS ADMIN-ONLY, AND THE PUBLIC BRANCH IS THE POINT.**
     *
     * CodeMirror injects its StyleModule as an inline `<style>` element on
     * every editor mount. Under `style-src 'self'` that element is refused:
     * MEASURED on production, a 6,719-character style tag whose `.sheet` was
     * null, with `.cm-content` computing `white-space: normal` where the base
     * theme sets `pre-wrap`. The editor only looked right because
     * `admin-editor.css` hand-writes the appearance, which is what made the
     * defect latent rather than visible.
     *
     * **A NONCE ON THE ELEMENT ALONE DOES NOTHING, and that was measured
     * before this was written rather than assumed.** A `<style>` carrying the
     * page's real nonce was ALSO refused, because a nonce authorizes nothing
     * unless the directive lists a nonce source. So permitting the element
     * requires changing `style-src`, and the only question was how widely.
     *
     * Not site-wide. SEVEN public HTML routes are `public, s-maxage=600`, so
     * for cookieless readers the header and the body are cached together and
     * one nonce is valid for up to ten minutes. That exposure is accepted, in
     * writing and publicly on /colophon, for `script-src`. Extending it to
     * styles would widen an accepted exposure to buy something no public route
     * needs: nothing outside the admin plane injects an inline stylesheet.
     *
     * The admin plane is `private, no-store` on every response and is never
     * edge-cached, so its nonce is genuinely per-request. That asymmetry is the
     * whole reason the branch is worth its complexity.
     *
     * **The public branch is ASSERTED, not merely intended.** `check:headers`
     * calls this function on both arms and fails if the public string ever
     * gains a nonce source, because nothing else stops a later edit from
     * passing `true` everywhere and leaving this comment in place describing a
     * policy that no longer exists.
     *
     * Rejected alternative, and it was checked in the shipped library rather
     * than recalled: configuring CodeMirror not to inject at all. It cannot be
     * done. `@codemirror/view` 6.43.7 calls `StyleModule.mount` unconditionally
     * when the view mounts, and the only knob it exposes on that call is the
     * nonce, via the `EditorView.cspNonce` facet. Removing the exception would
     * have beaten scoping it; the option does not exist.
     */
    styleNonce ? `style-src 'self' 'nonce-${nonce}'` : "style-src 'self'",
    /*
     * `style-src-attr 'unsafe-inline'` is NOT laziness and must not be "fixed".
     * Measured: 117 inline `style="--shiki-light:…"` attributes on one live
     * post, emitted by the highlighting pipeline. Nonces do not apply to style
     * ATTRIBUTES, and hashing 117 per page is not a real option. CSP Level 3
     * splits `style-src-attr` from `style-src` precisely so scripts can stay
     * strict while attributes are permitted, which is the trade taken here.
     *
     * Declared unconditionally, so the style nonce above cannot change what
     * attributes are allowed on either plane.
     */
    "style-src-attr 'unsafe-inline'",
    /*
     * `'self'` ALONE: the fonts are self-hosted, so there is no third party
     * to allow.
     *
     * NOT the files in `assets/fonts/`, which are NOT unused: Satori loads
     * those to draw the social cards. The fonts served to readers are a
     * different pair, the variable latin woff2 subsets in `public/fonts/`.
     */
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_ENDPOINT_NAME}`,
  ].join("; ");
}
