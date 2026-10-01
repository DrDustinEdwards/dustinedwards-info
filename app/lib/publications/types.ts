// The shapes a publication takes once its file is compiled. Types only: the vocabulary lives in
// topics.mjs and validate.mjs, and the file format is docs/PUBLICATIONS.md.

export type TopicId =
  | "human-simian-retroviruses"
  | "avian-retroviruses"
  | "bacteriophages"
  | "science-education";

export type PublicationType = "article" | "review" | "chapter" | "abstract" | "teaching-resource";

type Access = "self-hosted" | "external";

/** `published` has a DOI and a registry record; `submitted` is a manuscript under review, with neither. */
type PublicationStage = "published" | "submitted";

export type Publication = {
  /** The file's name and the page's address. From the DOI, or written in the file when there is none. */
  slug: string;
  /** The curated id, which is also the BibTeX key. */
  id: string;
  stage: PublicationStage;
  title: string;
  authors: string[];
  journal: string | null;
  year: number;
  /** The deposited date at its own precision: YYYY-MM-DD, YYYY-MM or YYYY. */
  publishedDate: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  /** Set only where `pages` is genuinely a range or a first page. */
  firstPage: string | null;
  lastPage: string | null;
  /** Null only for a submitted manuscript. */
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  pmcUrl: string | null;
  type: PublicationType;
  topics: TopicId[];
  access: Access;
  /** Set when access is "self-hosted". */
  pdfPath: string | null;
  /** Set when access is "external". */
  externalUrl: string | null;
  /** Preprint of this record, where one exists. */
  preprintDoi: string | null;
  isOpenAccess: boolean;
  license: string | null;
  /** Which registry said so, and at what content version. Null means no terms were found at either. */
  licenseSource: string | null;
  /** One plain-language sentence under 200 characters, or null. */
  summary: string | null;
  /** A retraction, correction or expression of concern, or null. */
  updateNotice: {
    type: "retraction" | "correction" | "expression-of-concern";
    doi: string;
    date: string | null;
  } | null;
  /** Sequence accessions the paper's own data-availability statement names. */
  accessions: { kind: string; id: string }[];
  selected: boolean;
  abstract: string | null;
};
