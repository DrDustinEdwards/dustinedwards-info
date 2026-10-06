---
profile: protocol
path: /research/protocols/phage-dna-extraction
title: "Phage DNA Extraction Protocol"
seo_title: "Phage DNA Extraction Protocol: column-free ZnCl2/TES method"
description: "Phage DNA extraction from a high-titer lysate by zinc chloride (ZnCl2) precipitation and TES, with no kit or column, plus DNA quantity and quality checks."
method: [extraction]
course: [phage-discovery, virus-isolation]
start_here: 2
version: "MISSING: No version has been assigned (protocols.md: printed sheets carry a version id and date)."
updated: 2026-09-30
first_used: fall 2018
status: "MISSING: No source in the repo states a status for this protocol."
last_run: "MISSING: protocols.md: nothing is marked as run in the lab until someone has worked from the rendered page and dated it."
host_strain: "MISSING: The page names no host strain; the notebooks show the method used mostly for Microbacterium foliorum phages."
biosafety: "MISSING: Waiting on Dustin: the biosafety officer check (core.md). protocols.md: list the agent only (organism and strain, with its ATCC number); the agent for this protocol is his to name."
biosafety_level: "MISSING: Waiting on Dustin: he sets BSL-1 or BSL-2 for each protocol himself."
scale: { count: 5, unit: tube }
primers: not applicable
based_on:
  - citation: "Santos MA (1991), Nucleic Acids Research 19:5442"
    doi: 10.1093/nar/19.19.5442
    for: the zinc chloride method
  - citation: "SEA-PHAGES Phage Discovery Guide, July 2025 edition"
    url: https://discoveryguide.seaphages.org/
    for: nuclease-free water for DNA sent for sequencing, the nuclease mix recipe, and the PEG protocol (9.2a)
  - citation: "QIAGEN bench guide, Isopropanol precipitation of DNA"
    for: room-temperature isopropanol, the two ethanol washes and their spin, and drying
  - citation: "Promega, Proteinase K product information"
    for: the proteinase K working concentration
  - citation: "Brauer et al. (2024), Environmental Microbiology 26:e16671"
    doi: 10.1111/1462-2920.16671
    for: the 60 °C proteinase K digestion in a zinc chloride phage DNA method
  - citation: "Thermo Scientific, Assessment of nucleic acid purity, Technical Note 52646"
    for: the expected A260/230 and what lowers it
  - citation: "Green MR, Sambrook J (2020), Cold Spring Harbor Protocols"
    doi: 10.1101/pdb.prot101717
    for: the insolubility of potassium dodecyl sulfate
  - citation: "QIAGEN bench guide, Lysis of bacterial cells for plasmid purification"
    for: potassium dodecyl sulfate precipitating with denatured protein
  - citation: "the lab's notebooks"
    for: "the lab's protocol as copied into them from 2018, troubleshooting, yields and the Qubit and NanoDrop readings"
materials:
  - name: high-titer lysate
    amount: 5 ml
    note: "Filter-sterilized and titered first. How to make one is on the [phage isolation protocol](/research/protocols/phage-isolation) page."
  - name: nuclease mix
    reagent: nuclease-mix
    display: nuclease mix (DNase I plus RNase A)
    amount: 20 µl
    per: 5 ml
    note: "20 µl per 5 ml of lysate. The Phage Discovery Guide gives a recipe in its [reagent recipes](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf#page=231)."
  - name: zinc chloride
    reagent: zinc-chloride
    display: ZnCl2
    stock: [2 M]
    final: 40 mM
    amount: 20 µl
    per: tube
    note: "2 M ZnCl2, 20 µl per 1 ml of lysate. That is 40 mM final, the concentration Santos (1991) gives."
  - name: TES buffer
    reagent: tes-buffer
    amount: 500 µl
    per: tube
    solution: tes-buffer
    note: "0.1 M Tris-HCl, pH 8; 0.1 M EDTA; 0.5% SDS."
  - name: proteinase K
    reagent: proteinase-k
    stock: [10 mg/ml, 20 mg/ml]
    final: 50 to 100 µg/ml
    amount: 1.25 to 5 µl
    per: tube
    note: "50 to 100 µg/ml final, from either a 10 mg/ml or a 20 mg/ml stock; the Phage Discovery Guide lists 20 mg/ml. Check the label on your tube, and use the volume for that stock in step 6."
  - name: potassium acetate
    reagent: potassium-acetate
    display: potassium acetate (pH 5.2)
    stock: [3 M]
    amount: 60 µl
    per: tube
    note: "3 M, pH 5.2."
  - name: isopropanol
    reagent: isopropanol
    stock: [100%, 80%]
    amount: 500 µl
    per: tube
    note: "500 µl per tube, at room temperature. Either 100% or 80% isopropanol works."
  - name: ethanol
    reagent: ethanol
    stock: [70%]
    amount: 250 µl
    per: wash
    note: "70%, at room temperature, 250 µl per wash, two washes."
  - name: nuclease-free water
    reagent: nuclease-free-water
    amount: 50 µl
    note: "Not Tris or TE: the Phage Discovery Guide specifies nuclease-free water for DNA sent for sequencing."
  - name: sodium acetate
    reagent: sodium-acetate
    group: Rescue
    stock: [3 M]
    amount: 0.1 volume
  - name: sodium chloride
    reagent: sodium-chloride
    group: Rescue
    final: 0.2 M
    note: "In place of sodium acetate if SDS may remain."
  - name: ice-cold ethanol
    reagent: ethanol
    group: Rescue
    stock: [100%]
    amount: 2.5 to 3 volumes
  - name: ice-cold ethanol wash
    reagent: ethanol
    display: ice-cold 75% ethanol
    group: Rescue
    stock: [75%]
    amount: 0.5 ml
  - name: glycogen
    reagent: glycogen
    display: glycogen carrier (optional)
    group: Rescue
    stock: [20 mg/ml]
    amount: 1 µl
solutions:
  - id: tes-buffer
    name: TES buffer
    components:
      - { name: Tris-HCl (pH 8), final: 0.1 M }
      - { name: EDTA, final: 0.1 M }
      - { name: SDS, final: 0.5% }
    storage: "MISSING: No record in the repo states how the lab stores its TES buffer."
    shelf_life: "MISSING: No record in the repo states how long the lab keeps its TES buffer."
equipment:
  - microcentrifuge tubes
  - microcentrifuge
  - heat block
  - NanoDrop
  - Qubit 3.0
troubleshooting:
  - id: mix-set-solid
    step: "7"
    problem: "The mix sets solid on adding potassium acetate, and the preps come out salty."
    reason: "The acetate precipitate was not mixed to a fluffy consistency before the ice."
    solution: "Shake it until the precipitate is gel-like and very white, then 15 minutes on ice."
  - id: precipitate-carryover
    step: "8"
    problem: "Salt in the final DNA: a large A230 peak and a low A260/230."
    reason: "Potassium acetate precipitate carried into the isopropanol."
    solution: "Spin the potassium acetate step twice, as in step 8, so no precipitate is carried into the isopropanol."
  - id: no-ethanol-wash
    step: "9 to 12"
    problem: "Very low yield and A260/230, with pellets too salty to dissolve."
    reason: "The ethanol washes were skipped, leaving salt in the pellet."
    solution: "Room-temperature isopropanol and two room-temperature 70% ethanol washes, as in steps 9 to 12."
  - id: phage-buffer
    step: "5"
    problem: "The zinc chloride pellet does not give DNA."
    reason: "It was resuspended in phage buffer instead of TES."
    solution: "Use TES, not phage buffer."
  - id: salt-pellet
    step: "13 to 14"
    problem: "A white, viscous \"pellet\" that soaks up the 50 µl of water and reads high on the NanoDrop."
    reason: "It is salt, not DNA."
    solution: "Clean it up with the [rescue](#rescuing-salty-or-dilute-dna), or seed fresh webbed plates from the ~100 µl of lysate kept in reserve and make another prep."
expected_results: "Good preps gave 616 to 1,803 ng/µl with A260/280 of 1.88 to 2.10 and A260/230 of 1.07 to 1.71, and the method recovered usable DNA from a 7.1 x 10^6 pfu/ml lysate that had given too little by the Guide's resin column. The lab's threshold for restriction digests is 100 ng/µl by Qubit."
limitations: "Yield depends on the lysate's titer: with lysates of about 10^7 pfu/ml, more tubes do not raise the yield, and a higher-titer lysate does. The method is written for 5 ml in 5 tubes; larger single batches can gel at the potassium acetate step. The NanoDrop overreads these preps when salt is present, so the concentration is read on the Qubit."
references:
  - "Santos MA (1991). An improved method for the small scale preparation of bacteriophage DNA based on phage precipitation by zinc chloride. *Nucleic Acids Research* 19(19):5442. [doi:10.1093/nar/19.19.5442](https://doi.org/10.1093/nar/19.19.5442)"
  - "SEA-PHAGES. [Phage Discovery Guide](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf), July 2025 edition: Protocol 9.2a (PEG precipitation), Protocol 9.2b (zinc chloride precipitation) and the reagent recipes. Online at [discoveryguide.seaphages.org](https://discoveryguide.seaphages.org/)."
  - "QIAGEN. [Isopropanol precipitation of DNA](https://www.qiagen.com/us/knowledge-and-support/knowledge-hub/bench-guide/dna/handling-dna/isopropanol-precipitation-of-dna), DNA bench guide."
  - "Bitesize Bio. [DNA precipitation: ethanol vs. isopropanol](https://bitesizebio.com/2839/dna-precipitation-ethanol-vs-isopropanol/)."
  - "Oswald N. [Ethanol precipitation of DNA and RNA: how it works](https://bitesizebio.com/253/the-basics-how-ethanol-precipitation-of-dna-and-rna-works/). Bitesize Bio."
  - "Promega. [Proteinase K product information](https://www.promega.com/resources/protocols/product-information-sheets/n/proteinase-k-protocol/)."
  - "Brauer A, Rosendahl S, Kängsep A, Lewańczyk AC, Rikberg R, Hõrak R, Tamman H (2024). Isolation and characterization of a phage collection against *Pseudomonas putida*. *Environmental Microbiology* 26(6), e16671. [doi:10.1111/1462-2920.16671](https://doi.org/10.1111/1462-2920.16671)"
  - "Thermo Scientific. [Assessment of nucleic acid purity](https://documents.thermofisher.com/TFS-Assets/CAD/Product-Bulletins/TN52646-E-0215M-NucleicAcid.pdf), Technical Note 52646."
  - "Green MR, Sambrook J (2020). Precipitation of RNA with ethanol. *Cold Spring Harbor Protocols* 2020(3). [doi:10.1101/pdb.prot101717](https://doi.org/10.1101/pdb.prot101717)"
  - "QIAGEN. [Lysis of bacterial cells for plasmid purification](https://www.qiagen.com/us/knowledge-and-support/knowledge-hub/bench-guide/plasmid/working-with-plasmids/lysis-of-bacterial-cells-for-plasmid-purification), plasmid bench guide."
---

This is the lab's phage DNA extraction (also called phage DNA isolation, purification or preparation) from a high-titer bacteriophage lysate, as run in the Tarleton SEA-PHAGES lab. It is a column-free method: zinc chloride collects the phage, SDS and proteinase K open the capsids, potassium acetate takes out the protein and SDS, and isopropanol brings down the DNA. It needs no kit or column, and the lab has used it since 2018, in place of the resin column in the [SEA-PHAGES Phage Discovery Guide](https://discoveryguide.seaphages.org/). After the method come the checks for DNA quantity and quality before sequencing, and a rescue for salty or dilute DNA. It is written for students and instructors running phage DNA preparation in a teaching lab.

The method is Santos's zinc chloride precipitation ([Santos 1991](#references)), which the lab has run since the fall of 2018. The lab's published genome announcements describe it as "a modified zinc chloride precipitation method," citing Santos and the Phage Discovery Guide. Examples are the announcements for [Finny](/research/publications/10-1128-mra-01039-19/), [IndyLu](/research/publications/10-1128-mra-01079-21/), [Fizzles](/research/publications/10-1128-mra-01077-21/), [Loca](/research/publications/10-1128-mra-00783-22/) and [Godfather](/research/publications/10-1128-mra-00888-24/).

## Why zinc chloride instead of PEG

The Phage Discovery Guide's own extraction precipitates phage with PEG and binds the DNA to a resin column: see [Protocol 9.2a, Phage DNA Extraction Following Precipitation with PEG](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf#page=139) in the July 2025 edition.

PEG pelleting needs a high-speed spin (the Guide gives 10,000 x g for 20 minutes at 4 °C). A zinc chloride pellet comes down in a microcentrifuge in 1 minute, so the method runs on the equipment of any teaching lab.

## Before you start: the lysate

The method starts from a filter-sterilized, high-titer phage lysate. How to make one (webbed plates, flooding, filtering and titering) is on the [phage isolation protocol](/research/protocols/phage-isolation) page.

- Titer the lysate first. Low-titer lysates (around 10^7 pfu/ml) give low DNA yields, and a higher titer is the first fix.
- Keep about 100 µl of the lysate aside before any extraction. It is enough to re-seed up to ten plates if the extraction fails. Repeated extractions can use up or degrade a lysate, so make fresh webbed plates and lysate before the stock runs low.
- Nucleases are handled by one designated person. In this lab, a teaching assistant or staff member adds the nuclease mix to each group's lysate, which keeps nucleases in one pair of hands and off the shared benches.
- To get more DNA, run more 1 ml tubes, not bigger batches. See [scaling up for low yield](#scaling-up-for-low-yield).

## Part A: collect the phage and open the capsids

The first spins below are given in rpm for a microcentrifuge.

1. Add @nuclease mix{20%µl} to @high-titer lysate{5%ml}. Incubate at 37 °C for ~{10%minutes}.
2. Split the lysate into 5 #microcentrifuge tubes{} of 1 ml each.
3. Add @zinc chloride|2 M ZnCl2{20%µl} to each tube. Incubate at 37 °C for ~{5%minutes}.
   > WHY: **Why zinc chloride and not PEG?** Both collect phage particles out of a large volume of lysate so the DNA can be extracted from a small pellet. Zinc chloride does it in minutes at 37 °C, and the phage pellet comes down in a 1 minute microcentrifuge spin. PEG needs a longer precipitation and a 10,000 x g spin for 20 minutes (see [why zinc chloride instead of PEG](#why-zinc-chloride-instead-of-peg)).
4. Spin at 10,000 rpm for ~{1%minute}. Remove the supernatant quickly and keep the pellet.
   > SPIN: MISSING: Waiting on Dustin: the ZnCl2 rotor (core.md). The lab's protocol gives rpm, and the notebooks do not name the rotor, so no g-force is given.
5. Resuspend each pellet in @TES buffer|TES{500%µl}. Incubate at 60 °C for ~{15%minutes}.
   > TROUBLESHOOTING: phage-buffer
6. Add @proteinase K{} to 50 to 100 µg/ml. Check the tube's label for the stock: 2.5 to 5 µl per tube of a 10 mg/ml stock, or 1.25 to 2.5 µl of a 20 mg/ml stock. Incubate at 55 to 60 °C for ~{30 to 60%minutes}.
   > PAUSE POINT: In this lab, the prep has been paused overnight at 4 °C after this step.
   > WHY: **Why this much proteinase K, this warm, for this long?** Proteinase K digests the capsid proteins and the nucleases added in step 1, and the SDS in the TES buffer stimulates it (the Phage Discovery Guide says the same of its own proteinase K step). A typical working concentration is 50 to 100 µg/ml ([Promega](#references)), and a published zinc chloride phage DNA method digests for 1 hour at 60 °C ([Brauer et al. 2024](#references)).

## Part B: remove the protein

7. Add @potassium acetate|3 M potassium acetate (pH 5.2){60%µl}. Mix hard, until the precipitate is fluffy and very white, then put the tube on ice for ~{15%minutes}.
   > CRITICAL: Mix until the precipitate is fluffy and very white before the ice. A mix that sets solid gives salty preps.
   > WHY: **Why potassium acetate after SDS?** The potassium salt of dodecyl sulfate is extremely insoluble ([Green and Sambrook 2020](#references)), so potassium swaps onto the SDS and it falls out of solution, taking the denatured capsid proteins with it. Alkaline lysis of bacteria for plasmid preps uses the same step: potassium dodecyl sulfate precipitates, and the denatured proteins come down with it ([QIAGEN, lysis of bacterial cells](#references)). Sodium would not do this: SDS is itself the sodium salt, and it stays dissolved.
   > TROUBLESHOOTING: mix-set-solid
8. Spin at 12,000 rpm for ~{1%minute} at 4 °C. Move the supernatant to a fresh tube; the pellet is protein. Spin the supernatant again for ~{3%minutes} and move it again, so no precipitate is carried into the isopropanol.
   > SPIN: MISSING: Waiting on Dustin: the ZnCl2 rotor (core.md). The lab's protocol gives rpm, and the notebooks do not name the rotor, so no g-force is given.
   > TROUBLESHOOTING: precipitate-carryover

## Part C: precipitate and wash the DNA

9. Add @isopropanol|room-temperature isopropanol{500%µl} to the supernatant and mix. Leave it at room temperature for about ~{10 to 30%minutes}. Do not put it on ice or leave it overnight.
   > CRITICAL: Keep the isopropanol at room temperature. Salt also precipitates in isopropanol, and salt carried into the DNA is the most common problem with this method.
   > WHY: **Why isopropanol, and why at room temperature?** DNA precipitates in less isopropanol than ethanol, so one volume fits in the tube with the sample, where ethanol would need 2 to 2.5 volumes. The cost is that salt also precipitates in isopropanol ([Bitesize Bio](#references)). For too much salt in the pellet, QIAGEN's bench guide says to use the isopropanol at room temperature and to wash the pellet twice with room-temperature 70% ethanol, spun at 10,000 to 15,000 x g, which is top speed in a microcentrifuge ([QIAGEN](#references)). In one run a second 250 µl wash raised A260/230 from 0.87 to 1.37. The short hold at room temperature before the spin is this lab's own step.
10. Spin at top speed for ~{15 to 30%minutes}. Discard the supernatant and keep the pellet.
   > SPIN: MISSING: The lab's protocol says top speed and names no rotor (core.md: the ZnCl2 rotor, waiting on Dustin).
11. Wash the pellet with @ethanol|room-temperature 70% ethanol{250%µl} and spin at top speed in a #microcentrifuge for ~{5 to 15%minutes}. Discard the ethanol.
   > SPIN: 10,000 to 15,000 x g
   > TROUBLESHOOTING: no-ethanol-wash
12. Wash a second time the same way.

## Part D: dry, dissolve and measure

13. After the last wash, pulse-spin and take off the last drops with a pipette. Air-dry for about ~{5 to 20%minutes}, until the pellet turns clear. Do not dry for hours: overdried DNA redissolves poorly ([QIAGEN](#references)).
14. Dissolve the pellet in @nuclease-free water{}, as the Phage Discovery Guide specifies for DNA sent for sequencing. Dissolve the first pellet in 50 µl, then carry that same 50 µl to the second pellet, and so on through all 5, so the DNA from the five tubes ends up in one tube. Do not substitute Tris or TE.
   > TROUBLESHOOTING: salt-pellet
15. Measure the DNA. See [checking DNA quantity and quality](#checking-dna-quantity-and-quality).

## What goes wrong and what fixes it

Salt carried into the final DNA is the most common problem with this method. It shows as a large A230 peak and a low A260/230, oversized pellets, and NanoDrop readings far above the true concentration. The [troubleshooting table](#troubleshooting) gives the fix at each step.

If the DNA is still salty or too dilute, the [rescue](#rescuing-salty-or-dilute-dna) below cleans it up, and the ~100 µl of lysate kept in reserve can seed fresh webbed plates for another prep.

## Scaling up for low yield

- The method is written for 5 ml in 5 tubes. Larger single batches can gel at the potassium acetate step, so run parallel 5 ml preps instead, for example three in parallel (15 tubes), and pool them.
- To top up a low-yield prep, run a second 5 ml prep and dissolve its pellets in the first prep's 50 µl.
- With a lysate of only about 10^7 pfu/ml, more tubes do not raise the yield; a higher-titer lysate does.

## Checking DNA quantity and quality

Check every prep before it goes to restriction digests or sequencing. Quantify on the Qubit, and use the NanoDrop only for the purity ratios.

### Qubit

The Qubit dsDNA assay measures the concentration. When salt is present, the NanoDrop reads far above the true concentration, because salt inflates A260. Treat the Qubit value as the true concentration.

Qubit dsDNA assay as run on a Qubit 3.0:

| Assay | Working solution | Standards | Sample |
| --- | --- | --- | --- |
| High sensitivity (HS) | 597 µl HS buffer + 3 µl HS reagent (or 995 + 5) | 190 µl working solution + 10 µl standard | 198 µl + 2 µl DNA (or 199 + 1) |
| Broad range (BR) | 796 µl buffer + 4 µl BR reagent | 190 µl working solution + 10 µl standard | 198 µl + 2 µl DNA (or 199 + 1) |

Vortex, let the tubes stand 2 minutes at room temperature, and read the standards before the samples. If the HS assay reads over range, dilute 1 µl of DNA into 19 µl of water (1:20) and multiply the reading by 20 (for example, 30.8 ng/µl x 20 = 616 ng/µl).

### NanoDrop

Select dsDNA, blank with 1 µl of nuclease-free water, then read 1 µl of sample. Record A260/280 and A260/230. Good preps from this lab read A260/280 of about 1.8 to 2.1. A260/230 is commonly expected in the range of 2.0 to 2.2, and a low value means a contaminant that absorbs at 230 nm or below is in the sample ([Thermo Scientific](#references)). Thermo's example is a sample in TE, the Tris and EDTA buffer, read against a water blank: it gives a low A260/230. The TES buffer here carries 0.1 M EDTA, and with this method a low ratio usually means salt carried over from the potassium acetate step. See the fixes above and the rescue below. If the scan is too poor to be worth a Qubit reading, redo the extraction.

### Targets

- The lab's threshold for restriction digests is 100 ng/µl by Qubit.
- To send DNA for sequencing at a set concentration, dilute it in nuclease-free water. For example, for 100 ng/µl in 50 µl from a 780 ng/µl prep, 6.4 µl of DNA plus 43.6 µl of water.
- Once it is quantified, analyze the DNA by restriction digest and gel.

## Rescuing salty or dilute DNA

Ethanol reprecipitation cleans salty DNA, concentrates dilute DNA and pools two weak preps into one tube. It usually raises A260/230, but it can lower the yield, so use it when the prep would otherwise be redone.

1. Measure the DNA volume with a pipette: dial it down until the air gap disappears. Base the volumes on this volume, not on the ng/µl reading.
2. Add salt: @sodium acetate|3 M sodium acetate{0.1%volume} (0.3 M final). If SDS may still be in the sample, use @sodium chloride{} at 0.2 M final instead. Then add @ice-cold ethanol|ice-cold 100% ethanol{2.5 to 3%volumes}. For 44 µl of DNA, that is 4.4 µl of sodium acetate and 110 to 132 µl of ethanol. For a very small amount of DNA, @glycogen|20 mg/ml glycogen{1%µl} can be added as a carrier.
   > WHY: **Why sodium acetate, sodium chloride or ammonium acetate?** Sodium acetate at 0.3 M final is the routine salt for DNA. Sodium chloride at 0.2 M final keeps SDS dissolved in the ethanol, so it does not come down with the DNA. Ammonium acetate leaves free nucleotides (dNTPs) in the supernatant, but ammonium ions inhibit T4 polynucleotide kinase, so it is not used for DNA headed for a kinase reaction ([Bitesize Bio](#references)).
3. Hold at -80 °C for ~{1%hour} to overnight, or at -20 °C overnight. A short hold in a freezer warmer than -20 °C is not enough.
4. Spin at full speed at 4 °C for ~{30%minutes}.
   > SPIN: MISSING: The lab's protocol says full speed and names no centrifuge or rotor.
5. Wash twice with @ice-cold ethanol wash|ice-cold 75% ethanol{0.5%ml}, with 10 minute spins at 4 °C.
   > SPIN: MISSING: The lab's protocol gives the 10 minute wash spins at 4 °C with no speed.
6. Air-dry until the pellet turns clear, as in step 13.
7. Dissolve the DNA in @nuclease-free water{50%µl}, as in step 14.

Pooling two weak extractions before reprecipitating gave 260.9 ng/µl at 2.01 / 2.01 in one run, and a gel with strong banding in another.

For how these genomes go on to be sequenced and annotated, see [phage discovery](/teaching/phage-discovery) and [the lab's phages](/research/phages).
