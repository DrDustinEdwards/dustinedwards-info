// All editable site content lives here. Change copy, courses, publications,
// and links in this one file. Components read from it.
//
// House rules (see CLAUDE.md): no em dashes, no cheesy copy. Avoid
// "explore", "discover", "dive into", "journey", "compelling", "must-read".

export const profile = {
  name: "Dustin Edwards",
  fullName: "Dr. Dustin Edwards",
  role: "Professor of Virology, Tarleton State University",
  // headline renders an italic <em> accent in the middle
  headlineLead: "I hunt viruses, and build the courses where ",
  headlineAccent: "students find new ones",
  headlineTrail: ".",
  lede:
    "Dr. Dustin Edwards, virologist and educator in Stephenville, Texas. My lab works across molecular retrovirology, wildlife pathogen surveillance, and bacteriophage genomics, much of it driven by undergraduates doing real, publishable research.",
  email: "dcedwards@tarleton.edu", // TODO: confirm address or swap for the contact form
};

export const navLinks = [
  { label: "Research", href: "#research" },
  { label: "Teaching", href: "#teaching" },
  { label: "Publications", href: "#publications" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export const research = [
  {
    num: "/ 01",
    title: "Retroviruses",
    body:
      "Molecular retrovirology and surveillance of REV and LPDV in Rio Grande wild turkeys and other wildlife. How these viruses spread, integrate, and cause disease.",
  },
  {
    num: "/ 02",
    title: "Bacteriophages",
    body:
      "Isolating and sequencing novel phages through HHMI's SEA-PHAGES program: genome annotation, archives, and comparative phage genomics.",
  },
  {
    num: "/ 03",
    title: "Microbiomes",
    body:
      "[ Editable: a sentence on the microbiome work, the systems you study, and the questions you are asking. ]",
  },
];

// TODO: update these numbers. The originals are from a 2019 award writeup.
export const program = {
  eyebrow: "Flagship Program",
  title: "The Phage Discovery Program",
  body:
    "An HHMI SEA-PHAGES course-based research experience where first- and second-year students isolate, sequence, and annotate brand-new bacteriophages, then present and publish the results.",
  stats: [
    { n: "60+", l: "Students mentored" },
    { n: "[##]", l: "Phages found" },
    { n: "30+", l: "Presentations" },
    { n: "2016", l: "Running since" },
  ],
};

export const courses = {
  lecture: [
    { name: "Cell Biology", meta: "BIOL" },
    { name: "Genetics", meta: "BIOL" },
    { name: "Virology", meta: "BIOL" },
    { name: "Vaccines", meta: "BIOL" },
  ],
  research: [
    { name: "Phage Discovery (SEA-PHAGES)", meta: "CURE" },
    { name: "Virus Isolation", meta: "CURE" },
    { name: "Phage Bioinformatics", meta: "CURE" },
    { name: "Genetic Techniques (Wolbachia)", meta: "CURE" },
  ],
  note:
    "I build course-based undergraduate research experiences (CUREs): classes where students do not simulate science, they do it. Real specimens, real sequencing, real results, often leading to conference presentations and authorship.",
};

export const publications = [
  {
    year: "2022",
    title:
      "Molecular Surveillance for Lymphoproliferative Disease Virus and Reticuloendotheliosis Virus in Rio Grande Wild Turkeys in Texas, USA",
    venue: "Journal of Wildlife Diseases",
    url: "#",
  },
  {
    year: "2022",
    title:
      "Genome Sequence of Fowlpox Virus-integrated Reticuloendotheliosis Virus from a Rio Grande Wild Turkey",
    venue: "Microbiology Resource Announcements",
    url: "#",
  },
  {
    year: "2022",
    title:
      "Complete Genome Sequence of Bacteriophage Loca, Isolated on a Microbacterium foliorum Culture",
    venue: "Microbiology Resource Announcements",
    url: "#",
  },
  {
    year: "2021",
    title: "Complete Genome Sequence of Mycobacterium phage Joy99",
    venue: "Microbiology Resource Announcements",
    url: "#",
  },
  {
    year: "2020",
    title:
      "Detection of Reticuloendotheliosis Virus in Muscovy Ducks, Wild Turkeys, and Chickens in Brazil",
    venue: "Journal of Wildlife Diseases",
    url: "#",
  },
];

export const about = {
  paragraphs: [
    "I'm a <strong>Professor of Virology and Head of the Department of Biological Sciences</strong> at Tarleton State University in Stephenville, Texas.",
    "My work lives where research meets teaching: molecular retrovirology and wildlife pathogen surveillance on one side, bacteriophage genomics and course-based undergraduate research on the other. I've been recognized with Tarleton's Outstanding Junior Faculty Award, but what I'm proudest of is the student research it has produced: dozens of mentees, conference presentations, published genomes, and student awards.",
    "[ Add a personal line: what you're like outside the lab, the Germomics story, the podcast, anything you want people to know. ]",
  ],
  glance: [
    { text: "Department Head, Biological Sciences", tag: "TSU" },
    { text: "HHMI SEA-PHAGES faculty", tag: "Phage" },
    { text: "Host, the Germomics podcast", tag: "Audio" },
    { text: "Cited 290+", tag: "Scholar" },
  ],
};

export const socials = [
  { label: "X / @Germomics", href: "https://twitter.com/Germomics" },
  { label: "Instagram", href: "https://www.instagram.com/germomics/" },
  { label: "Facebook", href: "https://www.facebook.com/Germomics" },
  { label: "Google Scholar", href: "#" },
  { label: "CV (PDF)", href: "#" },
];
