/**
 * THE CV, as data. The one source for /cv, its markdown twin (/cv.md, written by build:content) and
 * the PDF (public/dustin-edwards-cv.pdf, written by build:cv-pdf). Structured content edited by
 * commit, like phage-hunters.ts. Transcribed from Dustin's Fall 2026 CV; app/lib/cv/entries.mjs
 * resolves it into the entries every surface renders.
 *
 * PAPERS ARE NOT COPIED HERE. A paper with a DOI is named by its DOI alone, and its title, authors,
 * venue, year, abstract and identifiers come from the publication files (content/publications/), which follow each
 * paper's Crossref record. Only a paper the site has no record for carries its own citation.
 *
 * PRIVACY (PROTECTED in Capsid core.md): no student is named anywhere in this file. Mentoring is a
 * count by cohort, year, level and program; students appear only inside the published author lists
 * of papers. No phone, room, email or home location, and no private community groups.
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

export const CV_EDITION = "Fall 2026";

/** The site's one name for him (Capsid core.md, search goal): the CV's middle name is left off. */
export const CV_PERSON = {
  name: "Dustin Edwards",
  degree: "Ph.D.",
  title: "Professor and Virologist",
  department: "Department of Biological Sciences",
  org: "Tarleton State University, Texas A&M University System",
} as const;

/** The CV's own totals for presentations; only invited talks where Dustin leads are entries. */
export const CV_PRESENTATIONS = { international: 26, national: 170, from: 2004, to: 2026 } as const;

const TSU = "Tarleton State University";
const STEP = "Stephenville, TX";
const TSU_DEPT = `Department of Biological Sciences, College of Science and Technology, ${TSU}, ${STEP}, Texas A&M University System`;
const TXASM = "Texas Branch of the American Society for Microbiology";
const IRA = "International Retrovirology Association";
const HHMI = "Howard Hughes Medical Institute";
const PDP = "Phage Discovery Program research courses (Discovery and Characterization of Novel Bacteriophages and Bacteriophage Genetics)";
const PDP_EARLY = "Phage Discovery Program research courses (Discovery and Characterization of Novel Bacteriophages)";

export const CV_ENTRIES: CvSourceEntry[] = [
  // Appointments: positions
  { type: "appointment", section: "Positions", year: 2025, endYear: "present", title: "Professor", org: `Department of Biological Sciences, ${TSU}`, areas: [], role: null },
  { type: "appointment", section: "Positions", year: 2020, endYear: 2025, title: "Associate Professor", org: `Department of Biological Sciences, ${TSU}`, areas: [], role: null },
  {
    type: "appointment", section: "Positions", year: 2014, endYear: 2020, title: "Assistant Professor", org: TSU_DEPT,
    detail: "Heads: P. Sudman, Ph.D., A. Nelson, Ph.D., M. Sanderford, Ph.D., and K. Herrmann, Ph.D.", areas: [], role: null,
  },
  {
    type: "appointment", section: "Positions", year: 2013, endYear: 2014, title: "Adjunct Faculty",
    org: "Undergraduate Biology Program, College of Science, George Mason University, Fairfax, VA", detail: "Director: L. Rockwood, Ph.D.", areas: [], role: null,
  },
  {
    type: "appointment", section: "Positions", year: 2009, endYear: 2014, title: "Postdoctoral Fellow",
    org: "Animal Models and Retroviral Vaccines Section, Center for Cancer Research, National Cancer Institute (NCI), National Institutes of Health (NIH), Bethesda, MD",
    detail: "Function of HTLV-1 Orf-I-Encoded Proteins. Advisor: G. Franchini, M.D.", areas: ["retroviruses"], role: null,
  },
  {
    type: "appointment", section: "Positions", year: 2008, endYear: 2009, title: "Postdoctoral Fellow",
    org: "Virus Tumor Biology Section, Laboratory of Cellular Oncology, Center for Cancer Research, National Cancer Institute (NCI), National Institutes of Health (NIH), Bethesda, MD",
    detail: "Inhibition of Small GTPases in HTLV-1-Transformed Cells. Advisor: J. Brady, Ph.D. (deceased 2009)", areas: ["retroviruses"], role: null,
  },
  {
    type: "appointment", section: "Positions", year: 2002, endYear: 2008, title: "Graduate Research Associate",
    org: "Department of Molecular Virology and Microbiology, Baylor College of Medicine, Houston, TX",
    detail: "Regulation of the PCNA Promoter by HTLV-I Tax. Advisor: S. Marriott, Ph.D.", areas: ["retroviruses"], role: null,
  },
  {
    type: "appointment", section: "Positions", year: 1999, endYear: 2002, title: "Microbiology Technician / Research Assistant",
    org: "Iso-Tex Diagnostics, Inc., Friendswood, TX",
    detail: "FDA-approved injectable radiopharmaceutical developer of cancer therapeutics. Supervisor: L. Starke, Ph.D.", areas: [], role: null,
  },

  // Appointments: administrative and leadership, all at Tarleton
  {
    type: "appointment", section: "Administrative and leadership", year: 2025, endYear: "present", title: "Department Head",
    org: `Department of Biological Sciences, ${TSU}`, areas: [], role: null,
    duties: [
      {
        heading: "Leadership and personnel management",
        items: [
          "Oversee and mentor 11 tenure-track/tenured faculty, 12 instructional faculty, 3 adjunct faculty, 2 staff members, and 19 graduate assistants",
          "Supervise recruiting, hiring, evaluation, and professional development of faculty and staff",
        ],
      },
      {
        heading: "Administrative and financial oversight",
        items: [
          "Manage departmental budget, accounts, and expenditures",
          "Handle day-to-day departmental operations, including advising, orientation, tours, registration issues, and general decision-making",
          "Oversee program and strategic planning",
        ],
      },
      {
        heading: "Academic and program leadership",
        items: [
          "Lead curriculum development, program changes, and new program initiatives",
          "Oversee assessment and accreditation processes",
          "Serve on Academic Council, Department Heads Council, and other university committees",
        ],
      },
      { heading: "Communication", items: ["Serve as primary liaison with faculty, staff, administrators, and external stakeholders"] },
    ],
  },
  { type: "appointment", section: "Administrative and leadership", year: 2025, title: "Assistant Department Head", org: `Department of Biological Sciences, ${TSU}`, areas: [], role: null },
  {
    type: "appointment", section: "Administrative and leadership", year: 2020, endYear: 2024,
    title: "Senior Faculty Fellow/Asst Director of Scholar Development", org: `Center for Educational Excellence, ${TSU}`, areas: [], role: null,
    duties: [
      {
        heading: "Program leadership and faculty mentoring",
        items: [
          "Co-directed year-long Faculty Scholar Cohorts and served as primary mentor and contact for fellows",
          "Designed and facilitated monthly cohort meetings, peer-feedback sessions, workshops, and annual showcase",
          "Provided individualized coaching on IRB, research design, data analysis, abstracts, presentations, manuscripts, and tenure/promotion portfolios",
        ],
      },
      {
        heading: "Administrative and financial oversight",
        items: [
          "Reviewed applications and chaired review committees",
          "Managed onboarding, budget, scheduling, logistics, milestone tracking, and deliverables",
          "Collected program-evaluation data for annual reports for CEE, Provost, and SACSCOC",
        ],
      },
      {
        heading: "Institutional collaboration",
        items: [
          "Represented program on university committees and collaborated with CEE initiatives",
          "Contributed to long-term planning, resource advocacy, leadership meetings, and strategic direction",
        ],
      },
    ],
  },
  {
    type: "appointment", section: "Administrative and leadership", year: 2019, endYear: "present", title: "Chair of Institutional Biosafety Committee", org: TSU, areas: [], role: null,
    duties: [
      { heading: "Leadership and governance", items: ["Chair IBC meetings and ensure quorum/conflict management", "Mentor members and appoint subcommittees", "Serve as primary liaison to Division of Research and NIH OSP"] },
      { heading: "Compliance and reporting", items: ["Ensure full NIH Guidelines compliance", "Oversee incident/violation reporting to NIH OSP", "Approve charter, policy, roster, and manual updates"] },
      { heading: "Research oversight and laboratory inspections", items: ["Lead review/approval of research protocols", "Assign containment levels and mitigations and sign approvals", "Direct regular lab inspections and enforce corrective actions"] },
      { heading: "Training and collaboration", items: ["Direct IBC member training", "Coordinate with IRB, IACUC, and Risk Management"] },
    ],
  },

  // Education
  {
    type: "education", year: 2008, title: "Doctor of Philosophy (Ph.D.), Biomedical Sciences",
    org: "Baylor College of Medicine, Houston, TX, Department of Molecular Virology and Microbiology",
    detail: "Thesis: Regulation of the PCNA Promoter by HTLV-1 Tax. Advisor: S. Marriott, Ph.D.", areas: ["retroviruses"], role: null,
  },
  {
    type: "education", year: 2001, title: "Bachelor of Science (B.S.), Biological Sciences",
    org: "University of Houston, Clear Lake, Houston, TX, School of Science and Computer Engineering", detail: "Advisor: L. Rohde, Ph.D.", areas: [], role: null,
  },

  // Publications, newest first as the CV lists them
  { type: "publication", doi: "10.1128/jmbe.00313-25" },
  { type: "publication", doi: "10.3390/ijerph22071139" },
  { type: "publication", doi: "10.1080/07448481.2025.2472184" },
  { type: "publication", doi: "10.1128/mra.00888-24" },
  { type: "publication", doi: "10.3389/feduc.2024.1442306" },
  { type: "publication", doi: "10.3389/feduc.2024.1442318" },
  { type: "publication", doi: "10.25334/B5BS-F125" },
  {
    type: "publication", year: 2023, title: "A Virtual Cohort Model for Developing Faculty Scholarship in Early-Career Faculty",
    authors: ["C. Pennington", "E. Lang", "D. Edwards", "B. Hammack-Brown", "A. Kawakami", "A. Harris Bozer"],
    journal: "NCURA Magazine", volume: "55", issue: "6", pages: "12-13", areas: [], role: "co-author",
  },
  { type: "publication", doi: "10.1128/MRA.00778-23" },
  { type: "publication", doi: "10.3389/feduc.2023.1279921" },
  { type: "publication", doi: "10.7589/JWD-D-22-00023" },
  { type: "publication", doi: "10.1128/mra.00783-22" },
  { type: "publication", doi: "10.1128/mra.00174-22" },
  { type: "publication", doi: "10.1128/mra.00173-22" },
  { type: "publication", doi: "10.1128/MRA.01077-21" },
  { type: "publication", doi: "10.1187/cbe.21-03-0057" },
  { type: "publication", doi: "10.1128/MRA.01079-21" },
  { type: "publication", doi: "10.25334/8CXE-6883" },
  { type: "publication", doi: "10.1128/mra.00558-21" },
  { type: "publication", doi: "10.1128/mra.00556-21" },
  { type: "publication", doi: "10.7589/2019-04-088" },
  { type: "publication", doi: "10.1128/mra.01039-19" },
  { type: "publication", doi: "10.1128/mra.01594-18" },
  { type: "publication", doi: "10.7589/2018-08-187" },
  { type: "publication", doi: "10.1128/mra.01242-18" },
  { type: "publication", doi: "10.1128/jvi.02150-14" },
  { type: "publication", doi: "10.1371/journal.ppat.1004454" },
  { type: "publication", doi: "10.1128/jvi.03444-13" },
  { type: "publication", doi: "10.1128/jvi.01788-13" },
  { type: "publication", doi: "10.1371/journal.pone.0042123" },
  { type: "publication", doi: "10.3390/v3060861" },
  { type: "publication", doi: "10.3390/v3101815" },
  { type: "publication", doi: "10.1128/jvi.00356-08" },
  { type: "publication", doi: "10.1002/9780470025079.chap06.pub2" },

  // Grants: research funds awarded as faculty. A student co-recipient is "a student researcher".
  { type: "grant", year: 2026, amount: 3000, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2025, amount: 1000, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2024, amount: 2000, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2024, amount: 12000, title: "Lignium Energy", areas: [], role: "recipient" },
  { type: "grant", year: 2024, amount: 1314, title: "Provost's Student Research and Creative Activities Travel Grant", funder: TSU, areas: [], role: "recipient" },
  { type: "grant", year: 2023, amount: 100000, title: "Hatch Multistate Equipment Grant", areas: [], role: "recipient" },
  { type: "grant", year: 2023, amount: 2125, title: "Texas Parks and Wildlife Department", areas: [], role: "recipient" },
  { type: "grant", year: 2023, amount: 100522, title: "National Wild Turkey Federation", areas: [], role: "recipient" },
  { type: "grant", year: 2023, amount: 1000, title: "Provost's Student Research and Creative Activities Travel Grant", funder: TSU, areas: [], role: "recipient" },
  { type: "grant", year: 2022, amount: 2000, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2022, amount: 115000, title: "National Wild Turkey Federation", areas: [], role: "recipient" },
  { type: "grant", year: 2022, amount: 57419.74, title: "Presidential Excellence in Research Scholars Grant", funder: TSU, areas: [], role: "recipient" },
  { type: "grant", year: 2022, amount: 2500, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2021, amount: 2000, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2021, amount: 24380, title: "Presidential Excellence in Research Scholars Grant", funder: TSU, areas: [], role: "recipient" },
  { type: "grant", year: 2021, amount: 16936, title: "FIERCE Award", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2021, amount: 2000, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2020, amount: 3000, title: "Student Research Grant", funder: TSU, note: "with student researchers", areas: [], role: "recipient" },
  { type: "grant", year: 2020, amount: 4000, title: "FYRE Award", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2020, amount: 1025, title: "Student Travel Grant", funder: TSU, note: "with Phage Discovery Program", areas: ["bacteriophages"], role: "recipient" },
  { type: "grant", year: 2020, amount: 612, title: "Student Travel Grant", funder: TSU, note: "with student researchers", areas: [], role: "recipient" },
  { type: "grant", year: 2020, amount: 8500, title: "SEA-GENES", funder: HHMI, areas: [], role: "recipient" },
  { type: "grant", year: 2019, amount: 1500, title: "SEA-PHAGES", funder: HHMI, areas: ["bacteriophages", "science-education"], role: "recipient" },
  { type: "grant", year: 2019, amount: 87205, title: "Barton Springs Salamander Conservation Fund", funder: "City of Austin/U.S. Fish and Wildlife", areas: [], role: "recipient" },
  { type: "grant", year: 2019, amount: 2000, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2019, amount: 516.63, title: "Student Travel Grant", funder: TSU, note: "with Phage Discovery Program", areas: ["bacteriophages"], role: "recipient" },
  { type: "grant", year: 2019, amount: 340, title: "Student Travel Grant", funder: TSU, note: "with student researchers", areas: [], role: "recipient" },
  { type: "grant", year: 2019, amount: 6000, title: "Office of Academic Affairs", funder: TSU, areas: [], role: "recipient" },
  { type: "grant", year: 2018, amount: 4975, title: "Faculty-Student Research and Creative Activity Internal Grant", areas: [], role: "recipient" },
  { type: "grant", year: 2018, amount: 3383.5, title: "Office of Academic Affairs", funder: TSU, areas: [], role: "recipient" },
  { type: "grant", year: 2018, amount: 2000, title: "Office of Academic Affairs", funder: TSU, areas: [], role: "recipient" },
  { type: "grant", year: 2018, amount: 5000, title: "SEA-PHAGES", funder: HHMI, areas: ["bacteriophages", "science-education"], role: "recipient" },
  { type: "grant", year: 2018, amount: 4000, title: "FYRE Award", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2018, amount: 748.5, title: "Student Travel Grant", funder: TSU, note: "with student researchers", areas: [], role: "recipient" },
  { type: "grant", year: 2017, amount: 1467.63, title: "Student Research Grant", funder: TSU, note: "with student researchers", areas: [], role: "recipient" },
  { type: "grant", year: 2017, amount: 2500, title: "Horizons Award", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2017, amount: 10000, title: "SEA-PHAGES", funder: HHMI, areas: ["bacteriophages", "science-education"], role: "recipient" },
  { type: "grant", year: 2016, amount: 3000, title: "Student Research Grants", funder: TSU, note: "with student researchers", areas: [], role: "recipient" },
  { type: "grant", year: 2016, amount: 270, title: "Student Travel Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2016, amount: 1000, title: "Student Research Grant", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2016, amount: 1000, title: "Undergraduate Research Assistantship", funder: TSU, note: "with a student researcher", areas: [], role: "recipient" },
  { type: "grant", year: 2015, amount: 16500, title: "Office of Academic Affairs", funder: TSU, areas: [], role: "recipient" },
  { type: "grant", year: 2015, amount: 20824, title: "Organized Research Grant", funder: TSU, areas: [], role: "recipient" },

  // Fellowships and awards
  { type: "award", year: 2023, title: "Invited Speaker/Convener, ASM Microbe", org: "American Society for Microbiology", place: "Houston, TX", areas: [], role: "recipient" },
  { type: "award", year: 2020, endYear: 2021, title: "Millicent and Eugene Goldschmidt Faculty Education Award", org: TXASM, areas: ["science-education"], role: "recipient" },
  { type: "award", year: 2019, title: "Outstanding Junior Faculty Award", org: TSU, place: STEP, areas: [], role: "recipient" },
  { type: "award", year: 2019, title: "Outstanding Junior Faculty Award", org: "College of Science and Technology", place: STEP, areas: [], role: "recipient" },
  { type: "award", year: 2018, title: "Student Success Award", org: TSU, place: STEP, areas: [], role: "recipient" },
  { type: "award", year: 2018, title: "Student Success Award", org: "College of Science and Technology", place: STEP, areas: [], role: "recipient" },
  { type: "award", year: 2015, title: "Summer Grantsmanship School Award (OFR)", place: STEP, areas: [], role: "recipient" },
  { type: "award", year: 2010, title: "Viruses, Genes and Cancer International Travel Fellowship (CNR)", place: "Venice, Italy", areas: [], role: "recipient" },
  { type: "award", year: 2009, title: "Fellows Award for Research Excellence (FARE) 2010 (NIH)", place: "Bethesda, MD", areas: [], role: "recipient" },
  { type: "award", year: 2008, endYear: 2013, title: "Cancer Research Training Award (NIH), C5DP035809", place: "Bethesda, MD", areas: [], role: "recipient" },
  { type: "award", year: 2005, endYear: 2007, title: "Molecular Virology Training Grant (NIH) Trainee, T32 AI-07471", place: "Houston, TX", areas: [], role: "recipient" },

  // Invited talks, seminars and roundtables where Dustin is the lead or only author
  { type: "talk", year: 2021, title: "Developing a Scholarship Agenda & The Three Pillars of Academia", presenters: ["D. Edwards"], venue: "Tarleton State University CEE Faculty Scholarship Cohort. Virtual", areas: [], role: "speaker" },
  { type: "talk", year: 2021, title: "(REV)ised: a New Search for Reticuloendotheliosis Virus", presenters: ["D. Edwards"], venue: "Seminar. Texas A&M University - San Antonio. San Antonio, TX", areas: ["retroviruses"], role: "speaker" },
  {
    type: "talk", year: 2020, title: "Faculty Roundtable: The Great Teaching Debate: To Lecture or Not to Lecture ~ What does an innovative learning experience look like?",
    presenters: ["D. Edwards", "T. Holley", "N. Petroff", "J. Heller"], venue: "Center for Instructional Innovation, Stephenville, TX", areas: ["science-education"], role: "speaker",
  },
  { type: "talk", year: 2019, title: "Course-based Undergraduate Research Experiences", presenters: ["D. Edwards"], venue: "Deans and Program Directors for University of Texas Medical Branch. Galveston, TX", areas: ["science-education"], role: "speaker" },
  { type: "talk", year: 2019, title: "Faculty Roundtable: Teaching Live: Students Connecting their Learning Experiences in the Moment?", presenters: ["D. Edwards"], venue: "Center for Instructional Innovation, Stephenville, TX", areas: ["science-education"], role: "speaker" },
  { type: "talk", year: 2019, title: "Course-based Undergraduate Research Experiences: HHMI SEA-PHAGES", presenters: ["D. Edwards"], venue: "Dean's Circle for College of Science and Technology. Stephenville, TX", areas: ["bacteriophages", "science-education"], role: "speaker" },
  { type: "talk", year: 2019, title: "(REV)ised: a New Search for Reticuloendotheliosis Virus", presenters: ["D. Edwards"], venue: "Rio Brazos Master Naturalists. Acton, TX", areas: ["retroviruses"], role: "speaker" },
  { type: "talk", year: 2018, title: "Roundtable: Undergraduate Research and External Funding Mechanisms", presenters: ["D. Edwards"], venue: "Tarleton Student Research and Creative Activities, Stephenville, TX", areas: [], role: "speaker" },
  {
    type: "talk", year: 2018, title: "Roundtable: Undergraduate Research and Recruitment and Retention",
    presenters: ["D. Edwards", "F. Morgan", "K. Guay", "K. Herrmann", "E. Hall", "L. Albert"], venue: "Tarleton Student Research and Creative Activities, Stephenville, TX", areas: [], role: "speaker",
  },
  { type: "talk", year: 2018, title: "Faculty Roundtable: Ways to Engage Undergraduate Research", presenters: ["D. Edwards"], venue: "Center for Instructional Innovation, Stephenville, TX", areas: [], role: "speaker" },
  { type: "talk", year: 2017, title: "(REV)ised: a New Search for Reticuloendotheliosis Virus", presenters: ["D. Edwards"], venue: "Baylor University Lecture Series, Waco, TX", areas: ["retroviruses"], role: "speaker" },
  { type: "talk", year: 2013, title: "Retroviruses", presenters: ["D. Edwards"], venue: "Infectious Disease and Society. George Mason University, Fairfax, VA", areas: ["retroviruses"], role: "speaker" },
  { type: "talk", year: 2012, title: "Retroviruses", presenters: ["D. Edwards"], venue: "Infectious Disease and Society. George Mason University, Fairfax, VA", areas: ["retroviruses"], role: "speaker" },
  { type: "talk", year: 2009, title: "Antimicrobial Drugs", presenters: ["D. Edwards"], venue: "Microbial Physiology and Metabolism. George Mason University, Fairfax, VA", areas: [], role: "speaker" },

  // Lecture and lab courses taught
  { type: "course", year: 2021, endYear: "present", code: "BIOL 4378", title: "Biochemistry Lab (team-taught)", org: TSU, term: "Spring 2021 to present", areas: [], role: "instructor" },
  { type: "course", year: 2020, endYear: "present", code: "BIOL 3413", title: "Molecular Biology Lab (team-taught)", org: TSU, term: "Fall 2020 to present", areas: [], role: "instructor" },
  { type: "course", year: 2019, code: "BIOL 4090-050/060", title: "Science in Society", org: TSU, term: "Fall 2019", areas: [], role: "instructor" },
  { type: "course", year: 2018, endYear: "present", code: "BIOL 4090-030", title: "Bioinformatics", org: TSU, term: "Spring 2018 to present", areas: [], role: "instructor" },
  { type: "course", year: 2017, endYear: "present", code: "BIOL 4090-010", title: "Virus Isolation", org: TSU, term: "Fall 2017 to present", areas: [], role: "instructor" },
  { type: "course", year: 2016, endYear: 2026, code: "BIOL 4350 | BIOL 5086", title: "Vaccines", org: TSU, term: "Spring 2016 to Spring 2026", areas: [], role: "instructor" },
  { type: "course", year: 2016, endYear: 2021, code: "BIOL 5185", title: "Graduate Seminar in Contemporary Research Topics", org: TSU, term: "Spring 2016 to Fall 2021", areas: [], role: "instructor" },
  { type: "course", year: 2015, endYear: 2025, code: "BIOL 3380 | BIOL 5086", title: "Introduction to Virology", org: TSU, term: "Fall 2015 to Spring 2025", areas: [], role: "instructor" },
  { type: "course", year: 2015, endYear: 2021, code: "BIOL 3103", title: "Genetic Techniques", org: TSU, term: "Fall 2015 to Fall 2021", areas: [], role: "instructor" },
  { type: "course", year: 2015, endYear: 2025, code: "BIOL 3403/3303", title: "Genetics", org: TSU, term: "Spring 2015 to 2025", areas: [], role: "instructor" },
  { type: "course", year: 2014, endYear: 2024, code: "BIOL 2300", title: "Cell Biology", org: TSU, term: "Fall 2014 to Fall 2024", areas: [], role: "instructor" },
  { type: "course", year: 2014, endYear: 2016, code: "BIOL 1406", title: "Biology for Science Majors", org: TSU, term: "Fall 2014 to Fall 2016", areas: [], role: "instructor" },
  { type: "course", year: 2014, endYear: 2016, code: "BIOL 1100", title: "Transitioning to University Studies in Biomedical Sciences", org: TSU, term: "Fall 2014 to Fall 2016", areas: [], role: "instructor" },
  { type: "course", year: 2014, code: "BIOL 420", title: "Vaccines", org: "George Mason University", term: "Spring 2014", areas: [], role: "instructor" },
  { type: "course", year: 2013, code: "BIOL 382", title: "Introduction to Virology", org: "George Mason University", term: "Fall 2013", areas: [], role: "instructor" },

  // Mentoring, as counts. The CV names each student; this page never does.
  {
    type: "mentoring", section: "BSL-2 laboratory research mentoring", year: 2015, endYear: 2026, count: 19, unit: "students", level: "Research students and trainees", program: "BSL-2 laboratory research", org: TSU, cohort: false,
    detail: "Projects across all 23 laboratory students (Tarleton, NIH and Baylor) include the discovery of novel bacteriophages for nontuberculous mycobacteria, bacteriophage-delivering hydrogels, pathogen testing in biosolids, protein-protein interactions of cytotoxic phage proteins, bacteriophage anti-CRISPR systems, microbiomes of endangered salamanders, reticuloendotheliosis virus (REV) and lymphoproliferative disease virus (LPDV) in wild galliformes in Texas, avian retrovirus qPCR assays, HTLV-1 HBZ, HTLV-1 Orf-I and HTLV-1 Tax. The CV records these students going on to M.D., D.O., M.D./Ph.D. and Ph.D. programs, postdoctoral and research positions, and teaching.",
    areas: ["bacteriophages", "retroviruses"], role: "mentor",
  },
  { type: "mentoring", section: "BSL-2 laboratory research mentoring", year: 2010, endYear: 2012, count: 2, unit: "students", level: "Research students and trainees", program: "BSL-2 laboratory research", org: "National Institutes of Health", cohort: false, areas: [], role: "mentor" },
  { type: "mentoring", section: "BSL-2 laboratory research mentoring", year: 2004, endYear: 2006, count: 2, unit: "students", level: "Research students and trainees", program: "BSL-2 laboratory research", org: "Baylor College of Medicine", cohort: false, areas: [], role: "mentor" },
  { type: "mentoring", section: "Presidential Honors Program research mentoring", year: 2017, endYear: 2023, count: 14, unit: "students", level: "Honors undergraduates, six cohorts", program: "Presidential Honors Program: Discovery and Characterization of Novel Bacteriophages", org: TSU, cohort: false, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2026, endYear: 2027, count: 36, unit: "students", level: "Undergraduates", program: PDP, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2025, endYear: 2026, count: 36, unit: "students", level: "Undergraduates", program: PDP, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2024, endYear: 2025, count: 36, unit: "students", level: "Undergraduates", program: PDP, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2023, endYear: 2024, count: 25, unit: "students", level: "Undergraduates", program: PDP, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2022, endYear: 2023, count: 39, unit: "students", level: "Undergraduates", program: PDP, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2021, endYear: 2022, count: 42, unit: "students", level: "Undergraduates", program: PDP, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2020, endYear: 2021, count: 37, unit: "students", level: "Undergraduates", program: PDP, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2019, endYear: 2020, count: 19, unit: "students", level: "Undergraduates", program: PDP_EARLY, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2018, endYear: 2019, count: 11, unit: "students", level: "Undergraduates", program: "Molecular Biology and Biochemistry lab courses (Cloning and Expression of Bacteriophage Genes)", org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2018, endYear: 2019, count: 17, unit: "students", level: "Undergraduates", program: PDP_EARLY, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2018, count: 2, unit: "students", level: "Undergraduates", program: "Biomedical Sciences lecture courses, ALE (Study of Vaccines Aversion in Rural Populations)", org: TSU, cohort: true, areas: [], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2017, endYear: 2018, count: 21, unit: "students", level: "Undergraduates", program: PDP_EARLY, org: TSU, cohort: true, areas: ["bacteriophages"], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2017, endYear: 2018, count: 2, unit: "students", level: "Interns", program: "Virus Discovery, Genetic Techniques and Phage Discovery Program courses", org: TSU, cohort: false, areas: [], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2016, count: 3, unit: "students", level: "Undergraduate honors-credit students", program: "Honors credit", org: TSU, cohort: true, areas: [], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2016, count: 1, unit: "students", level: "Undergraduate", program: "Problems course", org: TSU, cohort: true, areas: [], role: "mentor" },
  { type: "mentoring", section: "Additional research mentoring", year: 2015, endYear: 2016, count: 1, unit: "students", level: "Graduate thesis research assistant", program: "Graduate thesis research", org: TSU, cohort: true, areas: [], role: "mentor" },
  {
    type: "mentoring", section: "Graduate thesis and non-thesis committees", year: 2019, endYear: "present", count: 8, unit: "students", level: "Graduate students", program: "7 thesis and non-thesis committees, Department of Biological Sciences", org: TSU, cohort: false,
    detail: "Including chair of one non-thesis committee (2022-2025).", areas: [], role: "member",
  },
  {
    type: "mentoring", section: "Mentored student awards", year: 2016, endYear: 2025, count: 36, unit: "awards", level: "Mentored students", program: "Awards won at research meetings", org: TSU, cohort: false,
    detail: "Among them Orville Wyss, Sarah McIntire, Samuel Kaplan and Joan Abramowitz awards at Texas Branch of the American Society for Microbiology meetings, and awards at Tarleton State University research symposia, the Gulf Coast Undergraduate Research Symposium, the Texas A&M University System Pathways Symposium, the Texas Academy of Science, the Texas Section of the Mathematical Association of America, and the World Congress on Virology and Infectious Disease.",
    areas: [], role: "mentor",
  },

  // Service: department
  { type: "service", section: "Department", year: 2025, title: "Committee Chair, Search Committee for Chair of Biological Science", place: STEP, areas: [], role: "chair" },
  { type: "service", section: "Department", year: 2024, endYear: 2025, title: "Faculty Mentor, Biological Sciences", place: STEP, areas: [], role: "mentor" },
  { type: "service", section: "Department", year: 2022, title: "Committee Member, Search Committee for Assistant Professor of Biological Science", place: STEP, areas: [], role: "member" },
  { type: "service", section: "Department", year: 2022, title: "Faculty Advisor, Biotechnology Laboratory Renovations", place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "Department", year: 2022, title: "Faculty Advisor, Campus Preview Day", org: TSU, place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "Department", year: 2021, title: "Committee Member, Search Committee for Lecturer of Biological Science", place: STEP, areas: [], role: "member" },
  { type: "service", section: "Department", year: 2019, title: "Student Recruitment", org: TSU, place: STEP, areas: [], role: "volunteer" },
  { type: "service", section: "Department", year: 2015, endYear: "present", title: "Advisor for Pre-Physical Therapy Students", org: TSU, place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "Department", year: 2015, endYear: "present", title: "Biomedical Sciences Student Orientation Advisor", org: TSU, place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "Department", year: 2015, title: "Student Recruitment", org: TSU, place: STEP, areas: [], role: "volunteer" },
  { type: "service", section: "Department", year: 2015, endYear: 2019, title: "Faculty Volunteer, Texan Transition Week", org: TSU, place: STEP, areas: [], role: "volunteer" },

  // Service: college
  { type: "service", section: "College", year: 2023, endYear: 2024, title: "Committee Member, Tenure and Promotion Criteria Review Committee", org: "COSM", place: STEP, areas: [], role: "member" },
  { type: "service", section: "College", year: 2023, endYear: "present", title: "Committee Member, Faculty Research Committee", org: "COSM", place: STEP, areas: [], role: "member" },
  { type: "service", section: "College", year: 2021, endYear: 2022, title: "Faculty Advisor, STEM Basecamp", org: "COST", place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "College", year: 2020, endYear: 2022, title: "Faculty Advisor, STEM Scholars Program", org: "COST", place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "College", year: 2019, endYear: 2021, title: "Presentation Judge for Math Day", place: STEP, areas: [], role: "judge" },
  { type: "service", section: "College", year: 2019, title: "Poster Judge for College of Science and Technology Research Symposium", place: STEP, areas: [], role: "judge" },
  { type: "service", section: "College", year: 2018, title: "COST Faculty Awards Deliberation", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "College", year: 2017, title: "Advisor for Science Olympiad", org: TSU, place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "College", year: 2015, endYear: 2016, title: "Tarleton Joint Admissions Medical Program (JAMP)", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "College", year: 2015, endYear: "present", title: "Tarleton Health Professions Advisory Committee (THPAC)", org: TSU, place: STEP, areas: [], role: "member" },

  // Service: university
  { type: "service", section: "University", year: 2025, endYear: "present", title: "Committee Member, University Curriculum Committee", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2025, title: "Committee Chair, Search Committee for Senior Research Compliance Administrator", place: STEP, areas: [], role: "chair" },
  { type: "service", section: "University", year: 2025, title: "Committee Member, Search Committee for Director of Instructional Development and Course Design", place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2025, title: "University Online Task Force", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2024, endYear: 2025, title: "Committee Member, Search Committee for Executive Director for Research Regulatory Compliance", place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2023, endYear: 2024, title: "Faculty Mentor, Center for Educational Excellence", place: STEP, areas: [], role: "mentor" },
  { type: "service", section: "University", year: 2020, title: "Committee Member, Faculty Search Committee for Dean of Libraries", place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2020, title: "Committee Member, McKenzie Family Endowed Research Professorship Selection", place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2020, title: "Committee Member, University Level Faculty Awards Selection Committee", place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2019, title: "Committee Member, Faculty Search Committee for Education Technology", place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2019, endYear: "present", title: "Chair, Institutional Biosafety Committee", org: TSU, place: STEP, areas: [], role: "chair" },
  { type: "service", section: "University", year: 2018, endYear: "present", title: "Lead Investigator, Biosafety Investigations", org: TSU, place: STEP, areas: [], role: null },
  { type: "service", section: "University", year: 2018, endYear: 2021, title: "Faculty-Student Research Advisory Board", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2018, title: "Student Evaluation of Instruction Task Force", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2018, title: "Ad Hoc Committee to revise Faculty Senate Constitution", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2018, title: "Undergraduate Student Presentation Judge, TSU Research Symposium", place: STEP, areas: [], role: "judge" },
  { type: "service", section: "University", year: 2017, endYear: 2018, title: "Committee Member, Institutional Review Board", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2017, endYear: "present", title: "Honors College Faculty Member", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2016, endYear: "present", title: "Committee Member, Institutional Biosafety Committee", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2016, title: "Committee Member, Piper Professor Awards Committee", areas: [], role: "member" },
  { type: "service", section: "University", year: 2016, title: "Graduate Student Presentation Judge, TSU Research Symposium", place: STEP, areas: [], role: "judge" },
  { type: "service", section: "University", year: 2016, title: "Research and Scholarship Appreciation Week Planning Workgroup", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2016, endYear: 2019, title: "Department Representative, Biological Sciences, Faculty Senate", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2016, endYear: 2019, title: "Faculty Advisor, TSU Service Day", org: TSU, place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "University", year: 2015, endYear: "present", title: "Faculty Advisor, Alpha Epsilon Delta", org: TSU, place: STEP, areas: [], role: "advisor" },
  { type: "service", section: "University", year: 2015, title: "Commencement Marshal", org: TSU, place: STEP, areas: [], role: null },
  { type: "service", section: "University", year: 2015, title: "Graduate Faculty Member", org: TSU, place: STEP, areas: [], role: "member" },
  { type: "service", section: "University", year: 2014, title: "Graduate Student Oral Presentation Judge, TSU Research Symposium", place: STEP, areas: [], role: "judge" },

  // Service: professional
  { type: "service", section: "Professional", year: 2025, title: `Organizer for ${TXASM} Fall Meeting`, place: "Tyler, TX", areas: [], role: "organizer" },
  { type: "service", section: "Professional", year: 2025, endYear: "present", title: `Reviewer, ${HHMI} SEA SM*ART`, place: "Chevy Chase, MD", areas: [], role: "reviewer" },
  { type: "service", section: "Professional", year: 2025, title: `Organizer for ${TXASM} Spring Meeting`, place: "Cedar Hill, TX", areas: [], role: "organizer" },
  { type: "service", section: "Professional", year: 2025, title: `Archivist, ${TXASM}`, areas: [], role: null },
  { type: "service", section: "Professional", year: 2024, title: `Organizer for ${TXASM} Fall Meeting`, place: "Galveston, TX", areas: [], role: "organizer" },
  { type: "service", section: "Professional", year: 2024, title: `Organizer for ${TXASM} Spring Meeting`, place: "Cedar Hill, TX", areas: [], role: "organizer" },
  { type: "service", section: "Professional", year: 2023, title: `Organizer for ${TXASM} Fall Meeting`, place: STEP, areas: [], role: "organizer" },
  { type: "service", section: "Professional", year: 2023, title: `Organizer for ${TXASM} Spring Meeting`, place: "Abilene, TX", areas: [], role: "organizer" },
  { type: "service", section: "Professional", year: 2023, title: `Facilitator, Bioinformatics Training, ${HHMI}`, place: "Chevy Chase, MD", areas: [], role: null },
  { type: "service", section: "Professional", year: 2022, title: `Organizer for ${TXASM} Spring Meeting`, place: "virtual", areas: [], role: "organizer" },
  { type: "service", section: "Professional", year: 2021, endYear: "present", title: `Sub-committees, ${TXASM}`, areas: [], role: "member" },
  { type: "service", section: "Professional", year: 2021, title: `Oral Presentation Judge for ${TXASM} Spring Meeting`, place: "virtual", areas: [], role: "judge" },
  { type: "service", section: "Professional", year: null, title: "Organizer, Fourth Annual South Central SEA-PHAGES Symposium (canceled)", place: STEP, areas: ["bacteriophages", "science-education"], role: "organizer" },
  { type: "service", section: "Professional", year: 2019, title: `Poster Judge for ${TXASM} Spring Meeting`, place: "New Braunfels, TX", areas: [], role: "judge" },
  { type: "service", section: "Professional", year: 2018, title: `Poster Judge for ${TXASM} Spring Meeting`, place: "New Braunfels, TX", areas: [], role: "judge" },
  { type: "service", section: "Professional", year: 2017, endYear: "present", title: `Science Education Alliance Faculty Member, ${HHMI}`, place: "Chevy Chase, MD", areas: ["science-education"], role: "member" },
  { type: "service", section: "Professional", year: 2016, endYear: "present", title: "Editorial Board for the journal Intervirology", areas: [], role: "editor" },
  { type: "service", section: "Professional", year: 2016, title: `Poster Judge for ${TXASM} Spring Meeting`, place: "New Braunfels, TX", areas: [], role: "judge" },
  { type: "service", section: "Professional", year: 2016, endYear: "present", title: "Peer Reviewer for the journal AIDS Research and Human Retroviruses", areas: ["retroviruses"], role: "reviewer" },
  { type: "service", section: "Professional", year: 2014, endYear: 2015, title: `Award Committee, ${IRA}`, place: "Les Trois-Îlets, Martinique", areas: ["retroviruses"], role: "member" },
  { type: "service", section: "Professional", year: 2013, title: "Poster Judge for the 16th International Conference on Human Retrovirology", place: "Montreal, Canada", areas: ["retroviruses"], role: "judge" },
  { type: "service", section: "Professional", year: 2013, endYear: "present", title: "Peer Reviewer for the journal Frontiers in Microbiology", areas: [], role: "reviewer" },
  { type: "service", section: "Professional", year: 2012, endYear: 2013, title: `Award Committee, ${IRA}`, place: "Leuven, Belgium", areas: ["retroviruses"], role: "member" },
  { type: "service", section: "Professional", year: 2009, endYear: 2015, title: `Executive Committee, ${IRA}`, place: "Washington, DC", areas: ["retroviruses"], role: "member" },
  { type: "service", section: "Professional", year: 2010, title: "Reviewer for the Fellows Award for Research Excellence (FARE) 2011 (NIH)", place: "Bethesda, MD", areas: [], role: "reviewer" },
  {
    type: "service", section: "Professional", year: 2007, title: "Abstract Manager, 13th International Conference on Human Retrovirology. Published in AIDS Res Hum Retroviruses 23:581-666, 2007",
    place: "Hakone, Japan", areas: ["retroviruses"], role: "organizer",
  },
  { type: "service", section: "Professional", year: 2006, endYear: 2015, title: `Website Administrator for the ${IRA}`, areas: ["retroviruses"], role: null },

  // Service: community. Town names are left off the two lines that would place a home.
  { type: "service", section: "Community", year: 2025, title: "Coach, Community Sports and Activities", areas: [], role: "volunteer" },
  { type: "service", section: "Community", year: 2018, endYear: 2019, title: "STEM+C Science Outreach, Morgan Mill School District", areas: [], role: "volunteer" },
  { type: "service", section: "Community", year: 2018, title: "STEM+C Science Outreach, Tolar School District", areas: [], role: "volunteer" },
  { type: "service", section: "Community", year: 2016, endYear: 2019, title: "STEM+C Science Outreach, Bluff Dale School District", areas: [], role: "volunteer" },
  { type: "service", section: "Community", year: 2015, endYear: 2019, title: "Adopt-A-Highway Community Roadside Clean-up", areas: [], role: "volunteer" },
  {
    type: "service", section: "Community", year: 2013, endYear: 2014, title: "Animal Exhibit Education Interpreter, Smithsonian's National Zoological Garden / Friends of the National Zoo (FONZ)",
    place: "Washington, DC", areas: [], role: "volunteer",
  },

  // Service: compensated professional consulting
  { type: "service", section: "Compensated professional consulting", year: 2025, title: `Work Group, ${HHMI}`, areas: [], role: "consultant" },
  { type: "service", section: "Compensated professional consulting", year: 2021, title: "Editor, BioScience Writers", place: "Houston, TX", areas: [], role: "consultant" },
  { type: "service", section: "Compensated professional consulting", year: 2020, title: "Focus Group, Virus Discovery CURE, Yale University", place: "New Haven, CT", areas: ["science-education"], role: "consultant" },
  { type: "service", section: "Compensated professional consulting", year: 2020, endYear: 2023, title: "External Reviewer, Faculty Grant Program, University of Central Oklahoma", place: "Edmond, OK", areas: [], role: "reviewer" },

  // Service: professional memberships, undated in the CV
  { type: "service", section: "Professional memberships", year: null, title: IRA, areas: ["retroviruses"], role: "member" },
  { type: "service", section: "Professional memberships", year: null, title: "American Society for Microbiology", areas: [], role: "member" },
  { type: "service", section: "Professional memberships", year: null, title: "American Society for Microbiology Texas Branch", areas: [], role: "member" },
  { type: "service", section: "Professional memberships", year: null, title: "Alpha Epsilon Delta Honor Society", areas: [], role: "member" },
  { type: "service", section: "Professional memberships", year: null, title: `${HHMI} Science Education Alliance`, areas: ["science-education"], role: "member" },

  // Faculty professional development
  { type: "development", year: 2025, title: "SEA Faculty Meeting", org: "HHMI", place: "Chevy Chase, MD", areas: ["science-education"], role: "participant" },
  { type: "development", year: 2024, title: "SEA Faculty Meeting", org: "HHMI", place: "Chevy Chase, MD", areas: ["science-education"], role: "participant" },
  { type: "development", year: 2023, title: "SEA Faculty Meeting", org: "HHMI", place: "Chevy Chase, MD", areas: ["science-education"], role: "participant" },
  { type: "development", year: 2022, title: "Review2Improve Gene Annotation Workshop", org: "HHMI", place: "Virtual", areas: [], role: "participant" },
  { type: "development", year: 2021, title: "Rubrics: Communicating High Expectations", org: TSU, place: STEP, areas: [], role: "participant" },
  { type: "development", year: 2021, title: "Bacteriophage Genetics Workshop", org: "HHMI", place: "Virtual", areas: ["bacteriophages"], role: "participant" },
  { type: "development", year: 2020, title: "PECAAN Bioinformatics Workshop", org: "HHMI and Western Kentucky University", place: "Bowling Green, KY", areas: [], role: "participant" },
  { type: "development", year: 2020, title: "HyFlex Training, CII/CEE", org: TSU, place: STEP, areas: [], role: "participant" },
  { type: "development", year: 2020, title: "Bacteriophage Genetics Workshop", org: "HHMI", place: "Virtual", areas: ["bacteriophages"], role: "participant" },
  { type: "development", year: 2019, title: "Best Practices for Teaching an Online Course, CII", org: TSU, place: STEP, areas: [], role: "participant" },
  { type: "development", year: 2019, title: "Institutional Biosafety Committee Training (IBC)", org: TSU, place: STEP, areas: [], role: "participant" },
  { type: "development", year: 2018, title: "Genome Annotation Workshop", org: "HHMI and University of Kansas", place: "Lawrence, KS", areas: [], role: "participant" },
  { type: "development", year: 2018, title: "Applied Learning Experience Training", org: TSU, place: STEP, areas: [], role: "participant" },
  { type: "development", year: 2018, title: "Genome Announcements Workshop", org: "HHMI", place: "Chevy Chase, VA", areas: [], role: "participant" },
  { type: "development", year: 2018, title: "Institutional Biosafety Committee Training (IBC)", org: TSU, place: STEP, areas: [], role: "participant" },
  { type: "development", year: 2018, title: "Institutional Review Board Training (IRB)", org: TSU, place: STEP, areas: [], role: "participant" },
  { type: "development", year: 2017, title: "Bioinformatics Workshop", org: "HHMI", place: "Chevy Chase, VA", areas: [], role: "participant" },
  { type: "development", year: 2017, title: "Virus Isolation Workshop", org: "HHMI", place: "Baltimore, MD", areas: [], role: "participant" },
  { type: "development", year: 2017, title: "Transmission Electron Microscopy Training", org: "UT Southwestern Medical Center", place: "Dallas, TX", areas: [], role: "participant" },
  { type: "development", year: 2017, title: "Entering Mentoring: Training the Next Generation of Scientists", place: "Chevy Chase, VA", areas: [], role: "participant" },
  { type: "development", year: 2017, title: "Site Visit for Virus Isolation", org: "Baylor University", place: "Waco, TX", areas: [], role: "participant" },
  { type: "development", year: 2017, title: "Conference of Texas Association of Advisors for the Health Professions", place: "Houston, TX", areas: [], role: "participant" },
  { type: "development", year: 2015, title: "Institutional Animal Care and Use Training (IACUC)", org: TSU, place: STEP, areas: [], role: "participant" },
  { type: "development", year: 2015, title: "Collaborative Institutional Training Initiative (CITI)", org: TSU, place: STEP, areas: [], role: "participant" },
];

