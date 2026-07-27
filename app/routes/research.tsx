import { Link } from "react-router";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { RESEARCH_DESCRIPTION, researchJsonLd, SITE } from "~/lib/seo";
import type { Route } from "./+types/research";

export function meta() {
  return [
    { title: `Research, ${SITE.name}` },
    { name: "description", content: RESEARCH_DESCRIPTION },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  return { origin: new URL(request.url).origin };
}

/**
 * Four research areas, each opened by the question it answers rather than by a
 * topic label. Prose is written to the papers: where a paper hedges, the text
 * hedges with it, and where a result is negative it is stated as one.
 */
export default function Research({ loaderData }: Route.ComponentProps) {
  const { origin } = loaderData;
  const jsonLd = researchJsonLd(origin);

  return (
    <>
      <SiteHeader />
      <main className="page">
        <div className="page-inner">
          <h1 className="page-title">Research</h1>
          <p className="page-intro">
            Four lines of work, in the order they happened. Two on retroviruses,
            one on bacteriophage genomes, one on how research is taught. Each
            section opens with the question the papers were built to answer, and
            says where the answer stops.
          </p>

          <h2 className="research-heading">
            How does a virus that infects millions of people stay invisible for
            decades?
          </h2>
          <p className="page-intro">
            Between 5 and 10 million people are living with human T-cell
            leukemia virus type 1, and the real number is probably higher,
            because that estimate covers only the regions anyone has surveyed.
            Most will never know they have it. In a few percent, after a latency
            that can run forty to sixty years, the virus causes adult T-cell
            leukemia. The aggressive forms of that disease kill within six to
            twelve months, and chemotherapy has not meaningfully changed that
            number in the four decades since the disease was described. There is
            no vaccine and no cure. What makes this virus worth understanding is
            not how fast it moves but how long it hides, and the work below is
            about the small viral genes that do the hiding.
          </p>
          <p className="page-intro">
            That work ran in two places, with a third collaboration for the
            simian paper. The transformation work was done in Susan Marriott's
            lab at Baylor College of Medicine. The accessory protein work was
            done in Genoveffa Franchini's section at the National Cancer
            Institute. The simian study was led from Renaud Mahieux's lab in
            Lyon.
          </p>
          <p className="page-intro">
            At Baylor we worked on Tax, the viral protein most clearly tied to
            cancer. Tax was already known to switch on a human gene called PCNA,
            which cells use to copy and repair their DNA, but nobody knew how,
            because the gene lacks the usual sequence where such switches are
            thrown. We found that the switch is not being pushed on. A protein
            complex sits on that gene holding it down, and Tax removes the
            complex. Mutating the site the complex binds raised the gene's
            activity by about 45 percent on its own, which is roughly what Tax
            achieves. Later we tested whether cells already transformed by the
            virus could be killed by blocking a chemical modification that
            anchors certain signalling proteins to the cell membrane. They
            could, and without needing to restore p53, the tumour suppressor
            these cells have switched off.
          </p>
          <p className="page-intro">
            At the National Cancer Institute the subject changed to the genes
            nobody could explain. This virus carries a set of small accessory
            genes that are entirely dispensable in a dish and absolutely
            required in a living animal, which is a strange combination and the
            reason they are interesting. One of them, orf-I, makes a protein
            called p12 that gets cut into a shorter form called p8, and the two
            behave almost oppositely: p12 activates T cells, p8 quiets them
            down. We found that a single conserved amino acid is both the point
            where two copies of the protein link together and the point where a
            fatty acid is attached, so a given molecule can do one or the other
            but not both. Then we mutated that amino acid and the protein
            carried on working. It still reached the cell surface, still tripled
            cell adhesion, still tripled viral transmission. That is a negative
            result and it is stated here as one.
          </p>
          <p className="page-intro">
            The larger result came from the work on the balance between the two
            forms. Sequencing orf-I from 160 infected people showed three
            natural patterns: mostly p12, mostly p8, or both in balance. Only
            the balanced pattern went with high virus levels in blood, which is
            the best available predictor of who gets sick. Engineered viruses
            matched it. In macaques, the balanced virus established infection in
            three of four animals, the p8-heavy virus in one of four, and the
            p12-heavy virus in none of eight. Only cells carrying the balanced
            virus resisted being killed by the immune cells sent to destroy
            them. Neither protein is sufficient. The virus needs both, in
            proportion.
          </p>
          <p className="page-intro">
            What is unresolved is most of it. We do not know where, when, or at
            what level these proteins are made inside an infected person, which
            was the closing line of our 2011 review and is still true. The
            evidence for their expression remains indirect, and much of this
            literature rests on tagged constructs because there are still no
            good antibodies for p12 or p8. The co-dependence result has an
            awkward edge that the paper itself raises: viruses making only p12
            could not infect macaques at all, yet people carrying p12-only virus
            exist, both healthy carriers and patients. Something is keeping
            those infections going that has not been identified.
          </p>
          <p className="page-intro muted">
            <Link to="/publications?topic=human-simian-retroviruses">
              Publications on human and simian retroviruses
            </Link>
          </p>

          <h2 className="research-heading">
            When a captive breeding program keeps losing birds to a virus, where
            is the virus coming from?
          </h2>
          <p className="page-intro">
            During 2016 and 2017, nearly half of all captive adult Attwater's
            prairie chicken mortality at the Fossil Rim Wildlife Center in Glen
            Rose, Texas was attributed to reticuloendotheliosis virus. The bird
            is highly endangered and the captive breeding population is a large
            share of what remains, so an adult death rate like that is a
            conservation problem before it is a research question.
            Reticuloendotheliosis virus is an avian retrovirus that suppresses
            the immune system, sometimes causes tumours, and establishes
            lifelong infection across a wide range of bird species. In wild
            birds its prevalence is usually low and disease is uncommon. The
            unusual rate in captivity is what prompted the work.
          </p>
          <p className="page-intro">
            This line ran from Tarleton State University with undergraduate
            students on every paper. The Brazil study was a collaboration led
            from the Instituto de Medicina Tropical at the Universidade de São
            Paulo, where we were one contributing group rather than the driving
            one.
          </p>
          <p className="page-intro">
            The first question was whether wild birds near the facility could be
            acting as a reservoir. We tested 393 blood samples collected during
            2016 and 2017 from two subspecies of wild turkey, amplifying the
            viral long terminal repeat and segments of the pol gene. In the
            affected counties, 5 percent of native Rio Grande wild turkeys were
            positive, five birds out of 98. We also found the virus in one of 62
            Eastern wild turkeys that had been imported during earlier
            conservation efforts. That last detection is what shaped the next
            study, because it put an infected bird in Texas that had come from a
            region where a second, similar virus is endemic.
          </p>
          <p className="page-intro">
            That second virus is lymphoproliferative disease virus, which causes
            overlapping disease and had been reported in the eastern United
            States and in states bordering Texas but never inside it. We tested
            373 dried blood spots from 20 counties over 2018 to 2020. Both
            viruses turned up at about 4 percent in affected counties, seven of
            197 for reticuloendotheliosis virus and ten of 273 for
            lymphoproliferative disease virus, and one bird carried both. The
            lymphoproliferative isolates grouped with variants from other
            southern and central states. This was the first molecular evidence
            of that virus in Texas. What it means for the birds is open, and the
            paper says so: effects on reproductive success, on coinfection, and
            on population health all need more surveillance before anyone can
            say whether subclinical infection matters.
          </p>
          <p className="page-intro">
            Two genomes were deposited from the same period. One is the outbreak
            isolate itself, sequenced from the prairie chicken. The other is a
            nearly intact 7,943 base pair proviral insertion, carrying partial
            long terminal repeats, sitting inside a field strain of fowlpox
            virus from a turkey in Gillespie County. That second one documents a
            route by which this retrovirus travels, packaged inside the genome
            of an unrelated and much larger virus.
          </p>
          <p className="page-intro">
            The Brazil study is the outlier in scope. The group surveyed birds
            in a northern state by real-time PCR and found the virus at 16.8
            percent, which is high next to the Texas numbers, in an area where
            nobody had looked. The strains grouped closely with variants from
            the United States. It is the first evidence of the virus in the
            Amazon biome and it was framed as a baseline for surveillance rather
            than an answer.
          </p>
          <p className="page-intro">
            What did not happen is worth stating plainly, because this section
            is built on a question. The 2019 paper named genetic comparison of
            wild and captive isolates as the next step, and no such paper
            followed. The source of the outbreak was not identified. The
            published record on both viruses ends in 2022.
          </p>
          <p className="page-intro muted">
            <Link to="/publications?topic=avian-retroviruses">
              Publications on avian retroviruses
            </Link>
          </p>

          <h2 className="research-heading">
            What can undergraduates contribute to a collection no single lab
            could build?
          </h2>
          <p className="page-intro">
            A single phage genome is a small result. Eleven of them, reported
            by successive student cohorts across nine years, are still eleven
            small results. The argument for doing this is not that any one
            genome matters. It is that the collection they join is something
            no individual lab could assemble, and that the properties worth
            knowing about a phage only exist once the collection is large enough
            to compare against.
          </p>
          <p className="page-intro">
            The count first, because it is easy to state wrongly. Eleven phages
            have been reported across ten genome announcements, since Tripl3t
            and Zeuska share a single paper. Of the eleven phages, seven were
            isolated by students at Tarleton. The other four were isolated
            elsewhere and annotated here: Joy99 in Saint Louis, Missouri,
            Tripl3t in Washington, DC, Zeuska in Providence, Rhode Island, and
            MrAaronian in Poughkeepsie, New York. The announcements say so
            themselves.
          </p>
          <p className="page-intro">
            The work sits inside the SEA-PHAGES program and every announcement
            carries a student cohort as its author list. Across the ten
            announcements there are 146 author slots, and at least 103 of those
            are held by people named on the Phage Hunters cohort roster. Two
            groups of high school students took part as well, annotating three
            archival genomes that were published as two of the ten
            announcements.
          </p>
          <p className="page-intro">
            What the phages themselves look like: the genomes run from 17,452 to
            72,658 base pairs, and gene counts from 24 to 132. The eleven phages
            fall into eight different clusters. They were isolated on three
            different bacterial hosts, which is the reason the set spans that
            much genomic range rather than being eleven variations on one theme.
            The sampling is as ordinary as the program intends. Announcements
            name soil from Stephenville, soil from an ant hill, soil from a
            flowerbed, soil from Bluff Dale and from New Braunfels, and a swab
            taken from the handle of a shopping cart.
          </p>
          <p className="page-intro">
            Novelty is where the honest calibration sits. Most of these genomes
            are close relatives of phages already in the database. Godfather
            shares more than 99 percent nucleotide identity with four named
            cluster EE phages, MrAaronian more than 99 percent with four cluster
            AW phages, and Loca more than 96 percent with two others. Fizzles,
            at more than 83.6 percent identity to its nearest two, is the most
            distant of the set, and its announcement draws no conclusion from
            that. Finding a near-identical relative is the common outcome in
            this program and it is not a failure of the work.
          </p>
          <p className="page-intro">
            The genre is a real limit and not a hedge. These are genome
            announcements, and the journal states that manuscripts providing an
            in-depth or comparative analysis of these resources will not be
            considered. So none of these papers contains a comparative claim,
            because the venue does not permit one. They are peer-reviewed
            data-deposition records with a student cohort attached, which is
            exactly what they are for.
          </p>
          <p className="page-intro">
            The payoff shows up in other people's work. Finny is one of 125
            cluster EA genomes analysed in a 2023 study predicting phage host
            ranges from codon usage bias, which is a claim Finny could not have
            supported by itself. That is the mechanism this section is arguing
            for, and it is worth knowing how thin the direct evidence still is.
            Across all ten announcements there are seven citations in total,
            four of them from this lab and three from outside it. The
            load-bearing artifact is the database record and the sequence
            accession rather than the paper. The announcement supplies
            citability, credit, and a student's name on something permanent.
          </p>
          <p className="page-intro">
            One record in this group is not an announcement. A survey of US
            healthcare providers, led by Subi Gandhi with us second of four
            authors, found that the constraint on phage therapy is awareness
            rather than resistance: 99 percent knew about antimicrobial
            resistance, 49 percent knew phage therapy as an option for resistant
            infections, and 56 percent were open to considering it. No phage in
            the announcements above was tested against anything, and none of
            that work is therapy research.
          </p>
          <p className="page-intro muted">
            <Link to="/publications?topic=bacteriophages">
              Publications on bacteriophages
            </Link>
          </p>

          <h2 className="research-heading">
            What does it take to change how science is taught at a hundred
            institutions at once?
          </h2>
          <p className="page-intro">
            Most of this work is participation in a community rather than
            authorship of a finding, and the author lists say so before any of
            the prose does. Five of these papers carry 81, 89, 99, 116 and 144
            authors. On lists that size the ordering is alphabetical, in tiers,
            so position carries no seniority information at all. Being author 42
            of 144 is not a rank. It is a record of having been in the room.
          </p>
          <p className="page-intro">
            The community is the Science Education Alliance run by the Howard
            Hughes Medical Institute, and the reform it pursues is course-based
            research: putting undergraduates on real, unfinished projects as the
            course itself rather than as a rehearsal.
          </p>
          <p className="page-intro">
            Three of the papers are attempts to write down what the community
            actually does, which sounds modest and is harder than it sounds,
            because the practice existed at scale before anyone had described
            it. One explicates three models of pedagogical practice underlying
            inquiry instruction. A second defines four aims of assessment,
            covering laboratory work and scientific thinking, mastery of
            concepts and quantitative skills, forms of scientific communication,
            and metacognition, then pairs each with the practices instructors
            use. A third turns part of that into two usable rubrics, one for
            posters and one for short-format manuscripts, built by roughly 100
            faculty who teach these courses.
          </p>
          <p className="page-intro">
            A fourth asks the structural question directly: what is it about
            this community that lets the pedagogy spread and stick. It uses
            pathway modelling to describe the mechanism, and the description was
            revised across several rounds of feedback from more than 100 faculty
            in the community. The finding is about faculty rather than students.
            Organised as a long-standing community of practice, instructors lean
            on each other, on outside expertise, and on data, to adopt and then
            keep improving their teaching.
          </p>
          <p className="page-intro">
            The paper where our own contribution is strongest is also the least
            comfortable. Ninety-seven instructors took part in a two-year
            qualitative study involving weekly reflective journaling,
            autoethnographic writing, small group evaluation, and community-wide
            checking. On that paper the author list has tiers and we sit in the
            first, credited with data curation and investigation that the next
            tier of 35 authors does not carry, which is the credit given to
            faculty who kept the journals. The resulting description of
            professional identity includes values like inclusivity and
            persistence and roles like mentor and advocate, and the community's
            agreed sense of self includes "overworked" sitting in the same list
            as "dedicated" and "valued". A reform movement describing itself
            that way, in its own words, in its own paper, is worth not smoothing
            over.
          </p>
          <p className="page-intro">
            Two teaching resources sit alongside the papers. One provides four
            active learning exercises for a step students reliably find opaque.
            The other gives a framework for students to write a genome
            announcement collaboratively, which is the same paper genre the
            phage cohorts publish in. Both are deposited with QUBES Educational
            Resources and typed as teaching materials rather than journal
            articles, and that distinction should be made rather than blurred.
          </p>
          <p className="page-intro">
            The honest limit on all of it is that these papers describe practice
            and do not measure student outcomes. They document what experienced
            instructors do, how they assess, and what the community structure
            provides. Whether the pedagogy produces better outcomes, and for
            which students, is a live and contested question in the wider
            literature, and it is not one this work answers.
          </p>
          <p className="page-intro">
            One further record belongs to a different line. A survey of 298
            students at a rural Texas university tested whether short video
            messages shifted vaccine perceptions. They did not. It is a negative
            result, reported as one, on work led by colleagues rather than by
            us.
          </p>
          <p className="page-intro muted">
            <Link to="/publications?topic=science-education">
              Publications on science education
            </Link>
          </p>
        </div>
        <script
          type="application/ld+json"
          // schema.org data for search and language models
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
