// The topics a publication may carry. The chips on the index come from here, and the validator refuses
// a topic that is not declared, so a typo cannot create a chip nobody asked for.

/**
 * @typedef {"human-simian-retroviruses" | "avian-retroviruses" | "bacteriophages" | "science-education"} TopicId
 */

/** @type {ReadonlyArray<{ id: TopicId, label: string, description: string }>} */
export const TOPICS = [
  {
    id: "human-simian-retroviruses",
    label: "Human and simian retroviruses",
    description: "HTLV-1 accessory proteins and how related retroviruses establish infection and persistence",
  },
  {
    id: "avian-retroviruses",
    label: "Avian retroviruses",
    description: "Reticuloendotheliosis virus and related retroviruses in wild bird populations",
  },
  {
    id: "bacteriophages",
    label: "Bacteriophages",
    description: "Phage genomics with undergraduate researchers",
  },
  {
    id: "science-education",
    label: "Science education",
    description: "Turning coursework into real research, and public attitudes toward science",
  },
];

export const TOPIC_IDS = new Set(TOPICS.map((t) => /** @type {string} */ (t.id)));
