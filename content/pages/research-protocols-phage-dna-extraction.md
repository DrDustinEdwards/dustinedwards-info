---
path: /research/protocols/phage-dna-extraction
title: "Phage DNA Extraction Protocol"
seo_title: "Phage DNA Extraction Protocol: column-free ZnCl2/TES method"
description: "Phage DNA extraction from a high-titer lysate by zinc chloride (ZnCl2) precipitation and TES, with no kit or column, plus DNA quantity and quality checks."
protocol:
  steps:
    - "#before-you-start-the-lysate"
    - "#part-a-collect-the-phage-and-open-the-capsids"
    - "#part-b-remove-the-protein"
    - "#part-c-precipitate-and-wash-the-dna"
    - "#part-d-dry-dissolve-and-measure"
    - "#checking-dna-quantity-and-quality"
    - "#rescuing-salty-or-dilute-dna"
  reagents:
    - { name: high-titer lysate, amount: 5 ml }
    - { name: nuclease mix (DNase I plus RNase A), amount: 20 µl, per: 5 ml }
    - { name: zinc chloride, amount: 20 µl, stock: 2 M, per: tube }
    - name: TES buffer
      amount: 500 µl
      per: tube
      recipe: "0.1 M Tris-HCl, pH 8; 0.1 M EDTA; 0.5% SDS"
    - { name: proteinase K, amount: 2.5 µl to 5 µl, stock: MISSING, per: tube }
    - { name: potassium acetate (pH 5.2), amount: 60 µl, stock: 3 M, per: tube }
    - { name: isopropanol at room temperature, amount: 500 µl, stock: 100% or 80%, per: tube }
    - { name: ethanol wash at room temperature, amount: 250 µl, stock: 70%, per: wash }
    - { method: Rescue, name: sodium acetate, amount: 0.1 volume, stock: 3 M }
    - { method: Rescue, name: sodium chloride (in place of sodium acetate if SDS may remain), amount: 0.2 M }
    - { method: Rescue, name: ice-cold ethanol, amount: 2.5 volumes to 3 volumes, stock: 100% }
    - { method: Rescue, name: ice-cold ethanol wash, amount: 0.5 ml, stock: 75% }
    - { method: Rescue, name: glycogen carrier (optional), amount: 1 µl, stock: 20 mg/ml }
  timings:
    - { step: nuclease mix, temperature_c: 37, time: 10 minutes }
    - { step: zinc chloride, temperature_c: 37, time: 5 minutes }
    - { step: zinc chloride spin, spin: "10,000 rpm", g: MISSING, time: 1 minute }
    - { step: TES, temperature_c: 60, time: 15 minutes }
    - { step: proteinase K, temperature_c: "55-60", time: 30 to 60 minutes }
    - { step: potassium acetate on ice, time: 15 minutes }
    - { step: potassium acetate spins, spin: "12,000 rpm", g: MISSING, temperature_c: 4, time: "1 minute, then 3 minutes" }
    - { step: isopropanol at room temperature, time: 10 to 30 minutes }
    - { step: DNA spin, spin: top speed, g: MISSING, time: 15 to 30 minutes }
    - { step: ethanol wash spins, spin: MISSING, time: 5 to 15 minutes each }
    - { step: air-drying, time: 5 to 20 minutes }
    - { method: Rescue, step: hold, time: "-80 °C for 1 hour to overnight, or -20 °C overnight" }
    - { method: Rescue, step: DNA spin, spin: full speed, g: MISSING, temperature_c: 4, time: 30 minutes }
    - { method: Rescue, step: wash spins, spin: MISSING, temperature_c: 4, time: 10 minutes }
  primers: not applicable
  equipment:
    - { name: microcentrifuge tubes }
    - { name: microcentrifuge }
    - { name: heat block }
    - { name: NanoDrop }
    - { name: Qubit 3.0 }
  host_strain: MISSING
  source:
    - citation: "Santos MA (1991), Nucleic Acids Research 19:5442, doi:10.1093/nar/19.19.5442"
      for: the zinc chloride method
    - citation: "Alternative DNA Isolation Protocol 3.5, the lab's course materials"
      for: the lab's version of the method
    - citation: "SEA-PHAGES Phage Discovery Guide, July 2025 edition, Protocol 9.2b"
      for: the final dissolve, and the nuclease mix recipe
    - citation: "QIAGEN bench guide, Isopropanol precipitation of DNA"
      for: room-temperature isopropanol, the wash spins and drying
    - citation: "Promega, Proteinase K product information"
      for: the proteinase K working concentration
    - citation: "Brauer et al. (2024), Environmental Microbiology 26:e16671, doi:10.1111/1462-2920.16671"
      for: the 60 °C proteinase K digestion in a zinc chloride phage DNA method
    - citation: "Thermo Scientific NanoDrop technical bulletin T042"
      for: A260/230 and EDTA
    - citation: "the lab's notebooks"
      for: troubleshooting, yields and the Qubit and NanoDrop readings
  biosafety: MISSING
  status: MISSING
  version: MISSING
  last_run: MISSING
---

This is the lab's phage DNA extraction (also called phage DNA isolation, purification or preparation) from a high-titer bacteriophage lysate, as run in the Tarleton SEA-PHAGES lab. It is a column-free method: zinc chloride collects the phage, SDS and proteinase K open the capsids, potassium acetate takes out the protein and SDS, and isopropanol brings down the DNA. It needs no kit or column, and it has been the lab's standard since about 2018, in place of the resin column in the [SEA-PHAGES Phage Discovery Guide](https://discoveryguide.seaphages.org/). After the method come the checks for DNA quantity and quality before sequencing, and a rescue for salty or dilute DNA. It is written for students and instructors running phage DNA preparation in a teaching lab.

The method is Santos's zinc chloride precipitation ([Santos 1991](#references)). The lab's course materials call its version "Alternate 3.5", or "Alternative DNA Isolation Protocol 3.5", and the lab's published genome announcements describe it as "a modified zinc chloride precipitation method," citing Santos and the Phage Discovery Guide. Examples are the announcements for [Finny](/research/publications/10-1128-mra-01039-19/), [IndyLu](/research/publications/10-1128-mra-01079-21/), [Fizzles](/research/publications/10-1128-mra-01077-21/), [Loca](/research/publications/10-1128-mra-00783-22/) and [Godfather](/research/publications/10-1128-mra-00888-24/).

## Coming from the old Baylor PDF

The old site linked a two-page PDF, the "Phage DNA Extraction Procedure" the lab called the Baylor protocol, which precipitated phage with PEG and bound the DNA to a resin column. That PEG and resin method is the SEA-PHAGES Phage Discovery Guide's own protocol: see [Protocol 9.2a, Phage DNA Extraction Following Precipitation with PEG](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf#page=139) in the July 2025 edition.

This lab uses the zinc chloride route instead because PEG pelleting needs a high-speed spin (the Guide gives 10,000 x g for 20 minutes at 4 °C), and the lab's swinging-bucket centrifuge tops out at about 4,000 rpm. Spins of 25 to 40 minutes at that speed gave no PEG pellet. A zinc chloride pellet comes down in a microcentrifuge in 1 minute.

## Before you start: the lysate

The method starts from a filter-sterilized, high-titer phage lysate. How to make one (webbed plates, flooding, filtering and titering) is on the [phage isolation protocol](/research/protocols/phage-isolation) page.

- Titer the lysate first. In this lab, low-titer lysates (around 10^7 pfu/ml) gave persistently low DNA yields, and a higher titer is the first fix.
- Keep about 100 µl of the lysate aside before any extraction. It is enough to re-seed up to ten plates if the extraction fails. Repeated extraction attempts over several weeks used up or degraded one lab's lysate until it could no longer make webbed plates, so make fresh webbed plates and lysate before the stock runs low.
- Nucleases are handled by one designated person. In this lab, a teaching assistant or staff member adds the nuclease mix to each group's lysate, which keeps nucleases in one pair of hands and off the shared benches.
- To get more DNA, run more 1 ml tubes, not bigger batches. See [scaling up for low yield](#scaling-up-for-low-yield).

## Reagents

| Reagent | Amount and source |
| --- | --- |
| Nuclease mix | 20 µl per 5 ml of lysate. The lab's protocol names it only as DNase I plus RNase A. The Phage Discovery Guide gives a recipe in its [reagent recipes](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf#page=231). |
| Zinc chloride | 2 M ZnCl2, 20 µl per 1 ml of lysate |
| TES buffer | 0.1 M Tris-HCl, pH 8; 0.1 M EDTA; 0.5% SDS (the lab's protocol as copied into its notebooks, 2018 and 2019) |
| Proteinase K | 50 to 100 µg/ml final. The lab's protocol lists a 10 mg/ml stock; the [Finny genome announcement](/research/publications/10-1128-mra-01039-19/) and the Phage Discovery Guide give 20 mg/ml. Check the label on your tube before you add it. |
| Potassium acetate | 3 M, pH 5.2 |
| Isopropanol | 500 µl per tube, at room temperature. The lab has used both 100% and 80% isopropanol. |
| Ethanol | 70%, at room temperature, 250 µl per wash, two washes |

Centrifuge speeds below are in rpm, as used in the lab's microcentrifuge. The notebooks do not name the rotor, so no g-force is given.

## Part A: collect the phage and open the capsids

1. Add 20 µl of nuclease mix to 5 ml of high-titer lysate. Incubate at 37 °C for 10 minutes.
2. Split the lysate into 5 microcentrifuge tubes of 1 ml each.
3. Add 20 µl of 2 M ZnCl2 to each tube. Incubate at 37 °C for 5 minutes.
4. Spin at 10,000 rpm for 1 minute. Remove the supernatant quickly and keep the pellet.
5. Resuspend each pellet in 500 µl of TES. Incubate at 60 °C for 15 minutes.
6. Add proteinase K to 50 to 100 µg/ml: 2.5 to 5 µl of a 10 mg/ml stock per tube, or 1.25 to 2.5 µl of a 20 mg/ml stock. Incubate at 55 to 60 °C for 30 to 60 minutes. In this lab, the prep has been paused overnight at 4 °C after this step.

**Why zinc chloride and not PEG?** Both collect phage particles out of a large volume of lysate so the DNA can be extracted from a small pellet. Zinc chloride does it in minutes at 37 °C, and the phage pellet comes down in a 1 minute microcentrifuge spin. PEG needs a longer precipitation and a 10,000 x g spin for 20 minutes, which this lab's centrifuge cannot reach (see [coming from the old Baylor PDF](#coming-from-the-old-baylor-pdf)).

**Why this much proteinase K, this warm, for this long?** Proteinase K digests the capsid proteins and the nucleases added in step 1, and the SDS in the TES buffer stimulates it (the Phage Discovery Guide says the same of its own proteinase K step). A typical working concentration is 50 to 100 µg/ml ([Promega](#references)), and a published zinc chloride phage DNA method digests for 1 hour at 60 °C ([Brauer et al. 2024](#references)). The lab's earlier step, about 20 µg/ml at 37 °C for 10 minutes, was well below both.

## Part B: remove the protein

7. Add 60 µl of 3 M potassium acetate (pH 5.2). Mix hard, until the precipitate is fluffy and very white, then put the tube on ice for 15 minutes.
8. Spin at 12,000 rpm for 1 minute at 4 °C. Move the supernatant to a fresh tube; the pellet is protein. Spin the supernatant again for 3 minutes and move it again, so no precipitate is carried into the isopropanol.

**Why potassium acetate after SDS?** Potassium dodecyl sulfate is insoluble, so potassium swaps onto the SDS and it falls out of solution, taking the denatured capsid proteins with it ([alkaline lysis](#references) uses the same step). Sodium would not do this: SDS is itself the sodium salt, and it stays dissolved.

## Part C: precipitate and wash the DNA

9. Add 500 µl of room-temperature isopropanol to the supernatant and mix. Leave it at room temperature for about 10 to 30 minutes. Do not put it on ice or leave it overnight.
10. Spin at top speed for 15 to 30 minutes. Discard the supernatant and keep the pellet.
11. Wash the pellet with 250 µl of room-temperature 70% ethanol and spin for 5 to 15 minutes. Discard the ethanol.
12. Wash a second time the same way.

**Why isopropanol, and why at room temperature?** DNA precipitates in less isopropanol than ethanol, so one volume fits in the tube with the sample, where ethanol would need 2 to 2.5 volumes. The cost is that salt also precipitates in isopropanol ([Bitesize Bio](#references)). Using it at room temperature keeps salt co-precipitation down ([QIAGEN](#references)); salt carried into the DNA was this method's most common failure in the lab's notebooks. The two ethanol washes carry off salt that did come down: in one lab a second 250 µl wash raised A260/230 from 0.87 to 1.37.

## Part D: dry, dissolve and measure

13. After the last wash, pulse-spin and take off the last drops with a pipette. Air-dry for about 5 to 20 minutes, until the pellet turns clear. Do not dry for hours: overdried DNA redissolves poorly ([QIAGEN](#references)).
14. Dissolve the DNA as the Phage Discovery Guide's Protocol 9.2b directs for its final step ([step 6, eluting the phage DNA](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf#page=147)), because this DNA goes to sequencing. Dissolve the first pellet, then carry that same liquid to the second pellet, and so on through all 5, so the DNA from the five tubes ends up in one tube. Do not substitute Tris or TE.
15. Measure the DNA. See [checking DNA quantity and quality](#checking-dna-quantity-and-quality).

## What goes wrong and what fixes it

Salt carried into the final DNA is the most common failure of this method. It shows as a large A230 peak and a low A260/230 (values from 0.03 to 1.3 were recorded), oversized pellets, and NanoDrop readings far above the true concentration. In this lab, these fixed it:

- **Mix hard after the potassium acetate.** In one lab the mix set solid on adding acetate. Shaking it to a fluffy consistency before the 15 minutes on ice fixed a run of salty preps (2,467.7 ng/µl, A260/280 2.06, A260/230 2.24). Wait until the precipitate is gel-like and very white before spinning.
- **Spin the potassium acetate step twice**, as in step 8, so no precipitate is carried into the isopropanol.
- **Room-temperature isopropanol and two ethanol washes**, as in steps 9 to 12. One group failed five times running without the ethanol wash (5.7 to 21.5 ng/µl, A260/230 0.03 to 0.07, pellets too salty to dissolve).
- **Use TES, not phage buffer.** Resuspending the ZnCl2 pellet in phage buffer failed, and the notebook marks it as never to be done.
- **A white, viscous "pellet" that soaks up the liquid is salt, not DNA.** One read 100 ng/µl on the NanoDrop and failed PCR prep.

When it worked, the method gave 616 to 1,803 ng/µl with A260/280 of 1.88 to 2.10 and A260/230 of 1.07 to 1.71, and it recovered usable DNA from a 7.1 x 10^6 pfu/ml lysate that had given too little by the Guide's resin column.

If the DNA is still salty or too dilute, the [rescue](#rescuing-salty-or-dilute-dna) below cleans it up, and the ~100 µl of lysate kept in reserve can seed fresh webbed plates for another prep.

## Scaling up for low yield

- The method is written for 5 ml in 5 tubes. A single 10 ml batch in 10 tubes with 40 µl of nuclease mix gelled at the potassium acetate step into a final "salt block." Run parallel 5 ml preps instead: one group ran three in parallel (15 tubes) and pooled them.
- To top up a low-yield prep, run a second 5 ml prep and dissolve its pellets in the first prep's DNA.
- Where the lysate was only about 10^7 pfu/ml, more tubes did not fix the yield; a higher-titer lysate did.

## Checking DNA quantity and quality

Check every prep before it goes to restriction digests or sequencing. Quantify on the Qubit, and use the NanoDrop only for the purity ratios.

### Qubit

The Qubit dsDNA assay measures the concentration. On these preps the NanoDrop overreads badly, because salt inflates A260. Paired readings from this lab: NanoDrop 407 against Qubit 27.4 ng/µl, 1,082.7 against 59.8, 1,174.7 against 25.9. Treat the Qubit value as the true concentration.

Qubit dsDNA assay as run on a Qubit 3.0:

| Assay | Working solution | Standards | Sample |
| --- | --- | --- | --- |
| High sensitivity (HS) | 597 µl HS buffer + 3 µl HS reagent (or 995 + 5) | 190 µl working solution + 10 µl standard | 198 µl + 2 µl DNA (or 199 + 1) |
| Broad range (BR) | 796 µl buffer + 4 µl BR reagent | 190 µl working solution + 10 µl standard | 198 µl + 2 µl DNA (or 199 + 1) |

Vortex, let the tubes stand 2 minutes at room temperature, and read the standards before the samples. If the HS assay reads over range, dilute 1 µl of DNA into 19 µl of water (1:20) and multiply the reading by 20 (for example, 30.8 ng/µl x 20 = 616 ng/µl).

### NanoDrop

Select dsDNA, blank with 1 µl of the same liquid the DNA is dissolved in, then read 1 µl of sample. Record A260/280 and A260/230. Good preps from this lab read A260/280 of about 1.8 to 2.1. A260/230 is usually expected around 2.0 to 2.2, and a low value means something that absorbs near 230 nm is in the sample ([NanoDrop T042](#references)). EDTA is one such contaminant, and the TES buffer carries 0.1 M of it; salt carried over from the potassium acetate is the other one this lab sees. See the fixes above and the rescue below. A scan too poor to be worth a Qubit reading was taken as the sign to redo the extraction.

### Targets

- The lab's threshold for restriction digests was 100 ng/µl by Qubit.
- To send DNA for sequencing at a set concentration, dilute it in the same liquid it is dissolved in. For example, for 100 ng/µl in 50 µl from a 780 ng/µl prep, 6.4 µl of DNA plus 43.6 µl.
- Once it is quantified, analyze the DNA by restriction digest and gel.

## Rescuing salty or dilute DNA

Ethanol reprecipitation cleans salty DNA, concentrates dilute DNA and pools two weak preps into one tube. It raised A260/230 in most cases (from 0.74 to 1.67 in one), but not every time (0.66 to 0.63 in another), and it can cut the yield sharply, so use it when the prep would otherwise be redone.

1. Measure the DNA volume with a pipette: dial it down until the air gap disappears. Base the volumes on this volume, not on the ng/µl reading.
2. Add salt: 0.1 volume of 3 M sodium acetate (0.3 M final). If SDS may still be in the sample, use sodium chloride at 0.2 M final instead. Then add 2.5 to 3 volumes of ice-cold 100% ethanol. For 44 µl of DNA, that is 4.4 µl of sodium acetate and 110 to 132 µl of ethanol. For a very small amount of DNA, 1 µl of 20 mg/ml glycogen can be added as a carrier.
3. Hold at -80 °C for 1 hour to overnight, or at -20 °C overnight. One hour at about -16 °C did not work.
4. Spin at full speed at 4 °C for 30 minutes.
5. Wash twice with 0.5 ml of ice-cold 75% ethanol, with 10 minute spins at 4 °C.
6. Air-dry until the pellet turns clear, as in step 13.
7. Dissolve the DNA as in step 14.

**Why sodium acetate, sodium chloride or ammonium acetate?** Sodium acetate at 0.3 M final is the routine salt for DNA. Sodium chloride at 0.2 M final keeps SDS dissolved in the ethanol, so it does not come down with the DNA. Ammonium acetate leaves free nucleotides (dNTPs) in the supernatant, but ammonium ions inhibit T4 polynucleotide kinase, so it is not used for DNA headed for a kinase reaction ([Bitesize Bio](#references)).

Pooling two weak extractions before reprecipitating gave 260.9 ng/µl at 2.01 / 2.01 in one lab, and a gel with strong banding in another.

For how these genomes go on to be sequenced and annotated, see [phage discovery](/teaching/phage-discovery) and [the lab's phages](/research/phages).

## References

- Santos MA (1991). An improved method for the small scale preparation of bacteriophage DNA based on phage precipitation by zinc chloride. *Nucleic Acids Research* 19(19):5442. [doi:10.1093/nar/19.19.5442](https://doi.org/10.1093/nar/19.19.5442)
- SEA-PHAGES. [Phage Discovery Guide](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf), July 2025 edition: Protocol 9.2a (PEG precipitation), Protocol 9.2b (zinc chloride precipitation) and the reagent recipes. Online at [discoveryguide.seaphages.org](https://discoveryguide.seaphages.org/).
- QIAGEN. [Isopropanol precipitation of DNA](https://www.qiagen.com/us/knowledge-and-support/knowledge-hub/bench-guide/dna/handling-dna/isopropanol-precipitation-of-dna), DNA bench guide.
- Bitesize Bio. [DNA precipitation: ethanol vs. isopropanol](https://bitesizebio.com/2839/dna-precipitation-ethanol-vs-isopropanol/).
- Oswald N. [Ethanol precipitation of DNA and RNA: how it works](https://bitesizebio.com/253/the-basics-how-ethanol-precipitation-of-dna-and-rna-works/). Bitesize Bio.
- Promega. [Proteinase K product information](https://www.promega.com/resources/protocols/product-information-sheets/n/proteinase-k-protocol/).
- Brauer A, Rosendahl S, Kängsep A, Lewańczyk AC, Rikberg R, Hõrak R, Tamman H (2024). Isolation and characterization of a phage collection against *Pseudomonas putida*. *Environmental Microbiology* 26(6), e16671. [doi:10.1111/1462-2920.16671](https://doi.org/10.1111/1462-2920.16671)
- Thermo Scientific. [T042 technical bulletin: NanoDrop spectrophotometers, nucleic acid purity ratios](https://dna.uga.edu/wp-content/uploads/sites/51/2019/02/Note-on-the-260_280-and-260_230-Ratios.pdf).
- [Alkaline lysis](https://en.wikipedia.org/wiki/Alkaline_lysis), Wikipedia, on potassium acetate precipitating SDS as potassium dodecyl sulfate.
