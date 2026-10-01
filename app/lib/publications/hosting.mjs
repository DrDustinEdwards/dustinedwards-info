// Which self-hosted PDFs carry no redistribution license, and why this site hosts them anyway.
//
// `licenseSource` has three states: tdm-only is terms that license redistribution to nobody, and collapsing
// it would hide that those were checked. Hosting a paper whose license does not permit it is Dustin's call
// to make and is recorded per DOI, so a NEW one is a new decision rather than a precedent: the validator
// refuses a self-hosted paper that is neither redistributable nor named here.

/** @type {ReadonlyMap<string, string>} DOI as deposited, to the reason. */
export const HOSTED_WITHOUT_LICENCE = new Map([
  // Bronze is free to read on the publisher's site with no license, which they can reverse.
  ["10.1128/jvi.00356-08", "ASM, green OA, crossref:tdm-only"],
  ["10.1128/jvi.01788-13", "ASM, bronze OA, crossref:tdm-only"],
  ["10.1128/jvi.03444-13", "ASM, bronze OA, crossref:tdm-only"],
  ["10.1128/jvi.02150-14", "ASM, bronze OA, crossref:tdm-only"],
  // Not open access at all.
  ["10.1002/9780470025079.chap06.pub2", "Wiley chapter, closed, crossref:tdm-only"],
  ["10.1080/07448481.2025.2472184", "Taylor and Francis, closed"],
  ["10.7589/2018-08-187", "Journal of Wildlife Diseases, closed"],
  ["10.7589/2019-04-088", "Journal of Wildlife Diseases, closed since July"],
  ["10.7589/JWD-D-22-00023", "Journal of Wildlife Diseases, closed"],
]);

/** @param {string | null | undefined} licence */
export function permitsRedistribution(licence) {
  return (
    typeof licence === "string" &&
    (licence.startsWith("cc-by") || licence === "cc0" || licence === "public-domain")
  );
}
