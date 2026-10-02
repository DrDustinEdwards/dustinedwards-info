/**
 * The shapes of the CV's source entries: what a file in content/cv/ states (docs/CV.md), before
 * app/lib/cv/entries.mjs resolves it into the entries every surface renders. Types only. The checks that hold
 * a file to them are in app/lib/cv/validate.mjs.
 *
 * PRIVACY (PROTECTED in Capsid core.md): no student is named anywhere in the CV files. Mentoring is a count by
 * cohort, year, level and program; students appear only inside the published author lists of papers. No phone,
 * room, email or home location, and no private community groups.
 *
 * AREAS are the site's four research areas, and each tag must be defensible from the entry itself.
 * Where it is not, the list is empty rather than guessed.
 */

export type CvArea = "retroviruses" | "bacteriophages" | "science-education" | "ai";

export type CvType =
  | "appointment"
  | "education"
  | "publication"
  | "grant"
  | "award"
  | "talk"
  | "course"
  | "mentoring"
  | "service"
  | "development";

export type CvRole =
  | "first-author"
  | "senior-author"
  | "co-author"
  | "recipient"
  | "speaker"
  | "instructor"
  | "mentor"
  | "chair"
  | "organizer"
  | "member"
  | "editor"
  | "reviewer"
  | "judge"
  | "advisor"
  | "volunteer"
  | "consultant"
  | "participant";

export type CvLink = { label: string; href: string };

/**
 * `year` is when it started; `endYear` is when it ended, "present" while it continues, or absent for
 * a single year. A null year is an undated line (a membership, a canceled meeting): it matches no year
 * range and sorts last.
 */
type Dated = { year: number | null; endYear?: number | "present" };

type Tagged = { areas: CvArea[]; role: CvRole | null; links?: CvLink[] };

/** A paper the site has a record for: everything but the DOI comes from its file in content/publications/. */
export type CvPaperRef = { type: "publication"; doi: string };

/** A paper with no site record, cited as the CV cites it. */
export type CvPaperInline = Dated &
  Tagged & {
    type: "publication";
    title: string;
    authors: string[];
    journal: string;
    volume?: string;
    issue?: string;
    pages?: string;
  };

export type CvAppointment = Dated &
  Tagged & {
    type: "appointment";
    section: "Positions" | "Administrative and leadership";
    title: string;
    org: string;
    detail?: string;
    /** Duties, grouped as the CV groups them. */
    duties?: { heading: string; items: string[] }[];
  };

export type CvEducation = Dated &
  Tagged & { type: "education"; title: string; org: string; detail?: string };

export type CvGrant = Dated &
  Tagged & {
    type: "grant";
    /** US dollars, as the CV states them. */
    amount: number;
    title: string;
    funder?: string;
    /** "with a student researcher" and the like; never a name. */
    note?: string;
  };

export type CvAward = Dated & Tagged & { type: "award"; title: string; org?: string; place?: string };

export type CvTalk = Dated &
  Tagged & {
    type: "talk";
    title: string;
    /** As the CV lists them; the co-presenters are faculty colleagues. */
    presenters: string[];
    venue: string;
  };

export type CvCourse = Dated &
  Tagged & { type: "course"; code: string; title: string; org: string; term: string };

export type CvMentoring = Dated &
  Tagged & {
    type: "mentoring";
    section: string;
    count: number;
    /** Students, or awards the mentored students won. Only students add to the students total. */
    unit: "students" | "awards";
    level: string;
    program: string;
    org: string;
    detail?: string;
    /** One cohort or academic year, so the count belongs to `year` alone and can be charted by year. */
    cohort: boolean;
  };

export type CvService = Dated &
  Tagged & {
    type: "service";
    section:
      | "Department"
      | "College"
      | "University"
      | "Professional"
      | "Community"
      | "Compensated professional consulting"
      | "Professional memberships";
    title: string;
    org?: string;
    place?: string;
  };

export type CvDevelopment = Dated & Tagged & { type: "development"; title: string; org?: string; place?: string };

export type CvSourceEntry =
  | CvPaperRef
  | CvPaperInline
  | CvAppointment
  | CvEducation
  | CvGrant
  | CvAward
  | CvTalk
  | CvCourse
  | CvMentoring
  | CvService
  | CvDevelopment;

/** The people the CV is about, as content/cv/profile.md states them. */
export type CvPerson = {
  name: string;
  degree: string;
  title: string;
  department: string;
  org: string;
};

/** The CV's own totals for presentations; only invited talks where Dustin leads are entries. */
export type CvPresentations = { international: number; national: number; from: number; to: number };

/** What the files hold, assembled in the order of CV_FILES (app/lib/cv/parse.mjs): one flat entry list. */
export type CvSource = {
  edition: string;
  person: CvPerson;
  presentations: CvPresentations;
  entries: CvSourceEntry[];
};

/**
 * What one file becomes, as D1's `cv.record` holds it and as the save, the sync and the build write it:
 * the profile's facts, or a section's entries with their type stated.
 */
export type CvFileRecord =
  | { slug: "profile"; type: "profile"; edition: string; person: CvPerson; presentations: CvPresentations }
  | { slug: string; type: CvType; entries: CvSourceEntry[] };
