---
path: /research/protocols/phage-dna-extraction
title: "Phage DNA Extraction Protocol"
seo_title: "Phage DNA Extraction Protocol: PEG, resin and ZnCl2 methods"
description: "Phage DNA extraction and purification from a high-titer lysate: a PEG and resin column protocol, a column-free ZnCl2/TES method, and checking DNA quality."
protocol:
  steps:
    - "#before-you-start-the-lysate"
    - "#method-1-peg-precipitation-and-resin-column"
    - "#method-2-column-free-zncl2--tes-extraction"
    - "#day-1"
    - "#day-2"
    - "#checking-dna-quantity-and-quality"
    - "#rescuing-salty-or-dilute-dna"
  reagents:
    - { method: Method 1, name: filter-sterilized phage lysate, amount: 10 mL }
    - { method: Method 1, name: Nuclease Mix, amount: 40 µL }
    - { method: Method 1, name: phage precipitant solution (PEG8000/NaCl), amount: 4 mL }
    - { method: Method 1, name: sterile water, amount: 0.5 mL }
    - { method: Method 1, name: DNA Clean Up Resin at 37 °C, amount: 2 mL }
    - { method: Method 1, name: freshly made isopropanol wash, amount: 1 mL, stock: 80% }
    - { method: Method 1, name: Elution Buffer at 80 °C, amount: 100 µL }
    - { method: Method 2, name: high-titer lysate, amount: 5 ml }
    - { method: Method 2, name: nuclease mix (DNase I plus RNase A), amount: 20 µl, per: 5 ml }
    - { method: Method 2, name: zinc chloride, amount: 20 µl, stock: 2 M, per: tube }
    - method: Method 2
      name: TES buffer
      amount: 500 µl
      recipe: "0.1 M Tris-HCl, pH 8; 0.1 M EDTA; 0.5% SDS"
    - { method: Method 2, name: proteinase K, amount: 1 µl, stock: MISSING }
    - { method: Method 2, name: potassium acetate (pH 5.2), amount: 60 µl, stock: 3 M }
    - { method: Method 2, name: isopropanol, amount: 500 µl, stock: 100% or 80% }
    - { method: Method 2, name: ethanol wash, amount: 250 µl, stock: 70% }
    - { method: Method 2, name: nuclease-free water, amount: 50 µl }
    - { method: Rescue, name: sodium acetate, amount: 0.1 volume, stock: 3 M }
    - { method: Rescue, name: ice-cold ethanol, amount: 3 volumes, stock: 100% }
    - { method: Rescue, name: ice-cold ethanol wash, amount: 0.5 ml, stock: 75% }
    - { method: Rescue, name: glycogen carrier (optional), amount: 1 µl, stock: 20 mg/ml }
    - { method: Rescue, name: nuclease-free water, amount: 50 µl }
  timings:
    - { method: Method 1, step: precipitation at 37 °C, temperature_c: 37, time: 30 minutes }
    - { method: Method 1, step: precipitation at room temperature, time: 45 minutes to 1 hour }
    - { method: Method 1, step: swinging bucket spin, spin: "10,000 x g", time: 20 minutes }
    - { method: Method 1, step: clumpy pellet at room temperature, time: "5-10 minutes, no more than 10" }
    - { method: Method 1, step: resin spin, spin: 12-13k x g, time: 3 minutes }
    - { method: Method 1, step: isopropanol wash spin, spin: 12-13k x g, time: 3 minutes }
    - { method: Method 1, step: column drying spin, spin: "12,000 x g", time: 5 minutes }
    - { method: Method 1, step: Elution Buffer on the column, temperature_c: 80, time: 1 minute }
    - { method: Method 1, step: elution spin, spin: "12,000 x g", time: 1 minute }
    - { method: Method 2, step: nuclease mix, temperature_c: 37, time: 10 minutes }
    - { method: Method 2, step: zinc chloride, temperature_c: 37, time: 5 minutes }
    - { method: Method 2, step: zinc chloride spin, spin: "10,000 rpm", time: 1 minute }
    - { method: Method 2, step: TES, temperature_c: 60, time: 15 minutes }
    - { method: Method 2, step: proteinase K, temperature_c: 37, time: 10 minutes }
    - { method: Method 2, step: potassium acetate on ice, time: 15 minutes }
    - { method: Method 2, step: potassium acetate spin, spin: "12,000 rpm", temperature_c: 4, time: 1 minute }
    - { method: Method 2, step: isopropanol on ice, time: overnight }
    - { method: Method 2, step: DNA spin, spin: top speed, g: MISSING, time: 10 minutes }
    - { method: Method 2, step: ethanol wash spin, spin: MISSING, time: 1 minute }
    - { method: Rescue, step: hold, time: "-80 °C for 1 hour to overnight, or -20 °C overnight" }
    - { method: Rescue, step: DNA spin, spin: full speed, g: MISSING, temperature_c: 4, time: 30 minutes }
    - { method: Rescue, step: wash spins, spin: MISSING, temperature_c: 4, time: 10 minutes }
    - { method: Rescue, step: drying, time: "30 °C, or 37 °C for 10 minutes" }
  primers: not applicable
  equipment:
    - { method: Method 1, name: 50 mL conical vial }
    - { method: Method 1, name: swinging bucket centrifuge }
    - { method: Method 1, name: microfuge tubes }
    - { method: Method 1, name: vacuum manifold with column-syringe set up }
    - { method: Method 1, name: dry heat bath }
    - { method: Method 2, name: microcentrifuge tubes }
    - { method: Method 2, name: microcentrifuge }
    - { name: NanoDrop }
    - { name: Qubit 3.0 }
  host_strain: MISSING
  source:
    - citation: "Phage DNA Extraction Procedure, the two-page PDF posted on the old site (the lab's Baylor protocol)"
      for: Method 1
    - citation: "Alternative DNA Isolation Protocol 3.5, the lab's course materials"
      for: Method 2
    - citation: "Santos (1991), Nucleic Acids Research 19:5442"
      for: Method 2, as the lab's genome announcements cite it
    - citation: "the lab's notebooks"
      for: notes, troubleshooting and the ZnCl2 reagent strengths
  biosafety: MISSING
  status: MISSING
  version: MISSING
  last_run: MISSING
---

This page gives two protocols for phage DNA extraction (also called phage DNA isolation, purification or preparation) from a high-titer bacteriophage lysate, as used in the Tarleton SEA-PHAGES lab. The first is a PEG precipitation and resin column procedure that replaces the old PDF on this site. The second is the column-free zinc chloride (ZnCl2) and TES method the lab has used as its standard since 2019. After both come the checks for DNA quantity and quality before sequencing, and a rescue for salty or dilute DNA. It is written for students and instructors running phage DNA preparation in a teaching lab.

## Before you start: the lysate

Both methods start from a filter-sterilized, high-titer phage lysate. How to make one (webbed plates, flooding, filtering and titering) is on the [phage isolation protocol](/research/protocols/phage-isolation) page.

- Titer the lysate first. The PEG and resin protocol below asks for at least 1 x 10^8 PFU/ml. In this lab, low-titer lysates (around 10^7 pfu/ml) gave persistently low DNA yields, and a higher titer is the first fix.
- Keep 100 µl of the lysate aside before any extraction. It is enough to re-seed up to ten plates if the extraction fails.
- Repeated extraction attempts over several weeks used up or degraded one lab's lysate until it could no longer make webbed plates. Make fresh webbed plates and lysate before the stock runs low.
- Nucleases are handled by one designated person. In this lab, a teaching assistant or staff member adds the nuclease mix to each group's lysate, which keeps nucleases in one pair of hands and off the shared benches.

## Method 1: PEG precipitation and resin column

This is the "Phage DNA Extraction Procedure" that was posted on the old site as a two-page PDF, given here as written. The lab has long called this the Baylor protocol. It uses a PEG8000/NaCl precipitant, a guanidinium thiocyanate DNA Clean Up Resin, 80% isopropanol washes on a vacuum manifold, and a heated Elution Buffer.

The goal of this procedure is to obtain high quality DNA from your concentrated phage lysate. You should have a phage titer of at least 1 x 10^8 PFU/ml in order to perform this extraction. Store your phage lysate at 4 °C. Store your purified DNA in the freezer.

### A. Degrade bacterial DNA

1. Transfer 10 mL of filter-sterilized phage lysate into a 50 mL conical vial.
2. Add 40 µL of Nuclease Mix and invert the tube several times to gently mix.

You must wear gloves when handling nuclease solutions. Do not vortex the sample. Work in the designated area and do not contaminate the lab benches with nuclease.

The nuclease mix (DNase I and RNase A) degrades bacterial DNA and RNA in the lysate. Avoid contaminating pipets, the workbench and anything else with it, and discard your gloves after using the nucleases so you do not carry them to anything you touch. The phage capsid protects its DNA from the nucleases, but if nucleases are present in later steps, the phage DNA may be degraded.

### B. Precipitate phage particles

1. Add 4 mL of phage precipitant solution (PEG8000/NaCl) to the nuclease-treated lysate and invert the tube several times to gently mix.
2. Incubate at 37 °C for 30 minutes.
3. Incubate at room temperature for 45 minutes to 1 hour. If you need to stop here, store at 4 °C.
4. Place the tube in a swinging bucket centrifuge and spin at 10,000 x g for 20 minutes. Decant the supernatant into the sink (rinse the sink after decanting). Drain the excess liquid from the pellet by inverting for 2-3 minutes on a paper towel. Dispose of the nuclease-contaminated material in the prep room. If you need to stop here, place your pellet/tube in the freezer.

Wear gloves and do not vortex. Longer precipitation times may give larger pellets that contain more phage particles, but these may also contain debris that can obstruct the resin column.

### C. Re-suspend the phage pellet

1. Add 0.5 mL of sterile water to the pellet.
2. Resuspend the pellet by gently pipetting up and down, avoiding bubbles. Make sure that the pellet is completely re-suspended. It is not necessary to completely re-dissolve the precipitate, but it should be uniformly suspended.
3. If it appears very clumpy, allow the suspended pellet to sit at room temperature for 5-10 minutes. No more than 10 minutes, because the nucleases are still active and the phage coat may begin to break down, exposing the phage DNA.

### D. Uncoat the phage genomic DNA

1. Add 2 mL of 37 °C DNA Clean Up Resin directly to the re-suspended pellet. Mix the resin before pipetting. To pipette the thick resin easily, cut the tip off a p-1000 tip. The resin contains guanidinium thiocyanate, a chemical that denatures protein. It is a skin irritant, so you must wear gloves.
2. Uncoat the phage particles by gently pipetting up and down. Gently swirl to mix.

The guanidinium thiocyanate breaks open the phage capsid and denatures the enzymes and the phage proteins. The resin in the mixture is a DNA binding resin. You will have to remove all of the resin in order to remove your DNA. To avoid DNA degradation, do not let the phage DNA and resin mixture stand too long at room temperature, do not store it at 4 °C and do not place it at 37 °C. Move on to the next step.

### E. Isolate the phage genomic DNA

1. Distribute the re-suspended pellet with the resin into 2 microfuge tubes, about 1.5 mL per tube. Remove as much resin as possible. The transfer to microfuge tubes makes it easy to spin and remove the liquid from the pellet.
2. Spin each tube at high speed, 12-13k x g, for 3 minutes.
3. Pull off the supernatant with a bulb pipet or p-1000 tip. Be careful not to disturb the pellet.
4. Wash the salts and proteins off the DNA sample:
   1. Add 1 mL of freshly made 80% isopropanol to each microfuge tube.
   2. Wash the pellet by gently flicking the tube to mix. The idea is to wash the resin without shearing the DNA.
   3. Spin the tube at 12-13k x g for 3 minutes.
   4. Pull off the supernatant with a bulb pipet or a p-1000 tip. Be careful not to disturb the pellet.
   5. Repeat steps 1 to 4 of this wash.
   6. Add 1 mL of fresh 80% isopropanol to each pellet and re-suspend the resin/DNA.
   7. Combine the contents of both microfuge tubes in one column-syringe set up under vacuum in the hood. This is optional. If the titer is very high, the resin may be saturated if you combine the tubes at this step. In most cases it is best to use 2 columns and combine the DNA after elution.
   8. Allow the vacuum manifold to pull the liquid through the column. Your clean DNA and resin are now trapped on the column's filter.
5. Dry each column:
   1. Remove the column from the vacuum manifold.
   2. Put the column in a clean microfuge tube with the lid cut off.
   3. Centrifuge the column for 5 minutes at 12,000 x g to remove any excess isopropanol. This removes any traces of isopropanol, which will inhibit enzymatic reactions (sequencing, restriction digest).
6. Elute the phage genomic DNA from each column:
   1. Transfer the column to a clean microfuge tube.
   2. Quickly apply 100 µL of 80 °C Elution Buffer (kept in the dry heat bath) to the column. Do not allow the elution buffer to cool before adding it to the column. Return it to the heat block when you are finished using it.
   3. Let the column with Elution Buffer sit for 1 minute to free the DNA from the resin.
   4. Centrifuge for 1 minute at 12,000 x g to elute the purified phage genomic DNA into a clean microfuge tube.
7. Store the DNA at 4 °C until you are ready to quantify (NanoDrop) and analyze it (restriction digest and gel).
8. Quantify the DNA on the NanoDrop, using the Elution Buffer as a blank.
9. If the concentration is over 1 µg/µl, dilute a small amount of DNA 1:1 in EB and re-measure.
10. If the concentration is below 300 ng/µl, concentrate the DNA using an ethanol/salt precipitation (see [rescuing salty or dilute DNA](#rescuing-salty-or-dilute-dna)).

### Notes on Method 1 from this lab

- **The spin speed matters.** Where the swinging-bucket centrifuge topped out at about 4,000 rpm, spins of 25 to 40 minutes at that speed gave no PEG pellet, and splitting the precipitate and spinning at 12,000 rpm for 1 hour did not rescue it. Those groups moved to Method 2. One group did get 780 ng/µl with a 1 hour spin at 4,100 rpm in a swinging bucket (about 3,500 x g; a 2017 lab notebook entry records both figures), a 6 minute resin spin at 10,000 g, two 1 ml 80% isopropanol washes and a 100 µl elution in 80 °C water, against 3.6 to 12.7 ng/µl from the Wizard column kit on the same phage. Other recorded runs of this protocol failed, so results were mixed.
- **Making the precipitant.** A PEG 8000/NaCl solution that would not dissolve after hours of heating and stirring went into solution when the PEG was added first and the NaCl second.
- Holding the PEG precipitation at 4 °C for days gave a small yellow pellet but still too little DNA.

## Method 2: column-free ZnCl2 / TES extraction

This is the lab's own phage DNA isolation method, labeled "Alternate 3.5" or "Alternative DNA Isolation Protocol 3.5" in the course materials and used as the standard extraction from 2019 to 2023, mostly for *Microbacterium foliorum* phages. It needs no kit or column. Zinc chloride precipitates the phage particles, SDS in the TES buffer and proteinase K strip the capsid, potassium acetate removes the protein and SDS, and isopropanol precipitates the DNA. It runs over two days.

The lab's published genome announcements describe this as "a modified zinc chloride precipitation method," citing Santos (1991, *Nucleic Acids Research* 19:5442) and the SEA-PHAGES Phage Discovery Guide. Examples are the announcements for [Finny](/research/publications/10-1128-mra-01039-19/), [IndyLu](/research/publications/10-1128-mra-01079-21/), [Fizzles](/research/publications/10-1128-mra-01077-21/), [Loca](/research/publications/10-1128-mra-00783-22/) and [Godfather](/research/publications/10-1128-mra-00888-24/).

### Reagents

| Reagent | Amount and source |
| --- | --- |
| Nuclease mix | 20 µl per 5 ml of lysate. The lab's protocol and notebooks name it only as DNase I plus RNase A (see the recipe below). |
| Zinc chloride | 2 M ZnCl2 |
| TES buffer | 0.1 M Tris-HCl, pH 8; 0.1 M EDTA; 0.5% SDS (the lab's ZnCl2 protocol as copied into its notebooks, 2018 and 2019) |
| Proteinase K | 10 mg/ml in the lab's protocol. The [Finny genome announcement](/research/publications/10-1128-mra-01039-19/) reports 20 mg/ml, as does the Phage Discovery Guide. The sources do not settle the difference. |
| Potassium acetate | 3 M, pH 5.2 |
| Isopropanol | 500 µl per tube. The protocol names no strength. The lab has used both 100% and 80% isopropanol with good results (lab notebooks, 2018 to 2025). |
| Ethanol | 70%, 250 µl per wash, with a 1 minute spin (lab notebook, 2018) |
| Nuclease-free water | 50 µl in total |

The lab's sources do not give a recipe for the nuclease mix beyond DNase I plus RNase A. For reference, the [SEA-PHAGES Phage Discovery Guide](https://discoveryguide.seaphages.org/) gives this one (the guide's recipe, not the lab's): per 5 ml, 150 mM NaCl, DNase I at 0.25 mg/ml (from a 5 mg/ml stock), RNase A at 0.25 mg/ml (from a 10 mg/ml stock) and 50% glycerol, stored at -20 °C.

Centrifuge speeds below are in rpm, as used in the lab's microcentrifuge. The notebooks do not name the rotor, so no g-force is given.

### Day 1

1. Add 20 µl of nuclease mix to 5 ml of high-titer lysate. Incubate at 37 °C for 10 minutes.
2. Split the lysate into 5 microcentrifuge tubes of 1 ml each.
3. Add 20 µl of 2 M ZnCl2 to each tube. Incubate at 37 °C for 5 minutes.
4. Spin at 10,000 rpm for 1 minute. Remove the supernatant quickly and keep the pellet.
5. Resuspend each pellet in 500 µl of TES. Incubate at 60 °C for 15 minutes.
6. Add 1 µl of proteinase K (10 mg/ml). Incubate at 37 °C for 10 minutes. In this lab, the prep has been paused overnight at 4 °C after this step.
7. Add 60 µl of 3 M potassium acetate (pH 5.2). Mix well and put on ice for 15 minutes. A white precipitate of capsid protein forms.
8. Spin at 12,000 rpm for 1 minute at 4 °C. Keep the supernatant; the pellet is protein.
9. Add 500 µl of isopropanol (100% or 80%; see the reagents table) to the supernatant and leave it on ice overnight.

### Day 2

10. Spin at top speed for 10 minutes. Discard the supernatant and keep the pellet.
11. Wash the pellet with 250 µl of 70% ethanol and spin for 1 minute. Discard the ethanol.
12. Dry the pellets completely. The protocol says "DO NOT RUSH THIS STEP." Go on only when the pellets have turned clear and no droplets remain.
13. Resuspend the first pellet in 50 µl of nuclease-free water, then carry that same 50 µl to the second pellet, and so on through all 5, so the DNA from all five tubes ends up in one 50 µl.
14. Measure the DNA on the NanoDrop (concentration, A260/280 and A260/230) and confirm on the Qubit. See [checking DNA quantity and quality](#checking-dna-quantity-and-quality).

### What goes wrong and what fixed it

Salt carried into the final DNA is the most common failure of this method. It shows as a large A230 peak and a low A260/230 (values from 0.03 to 1.3 were recorded), oversized pellets, and NanoDrop readings far above the true concentration. In this lab, these changes reduced it:

- **Mix hard after the potassium acetate.** In one lab the mix set solid on adding acetate. Shaking it to a fluffy consistency before the 15 minutes on ice fixed a run of salty preps (2,467.7 ng/µl, A260/280 2.06, A260/230 2.24; a later run gave 5,347.2 ng/µl, 2.07 / 2.01). Wait until the precipitate is gel-like and very white before spinning.
- **Spin the potassium acetate step twice** (the second spin 3 minutes) so no precipitate is carried into the isopropanol.
- **Give the isopropanol time.** At least 3 to 4 hours on ice, or overnight. 1.5 hours failed twice. Holds of 2 to 5 days on ice, and -20 °C for 6 hours, also gave DNA.
- **Never skip the 70% ethanol wash, and do it twice.** One group failed five times running without it (5.7 to 21.5 ng/µl, A260/230 0.03 to 0.07, pellets too salty to dissolve). A second 250 µl wash raised A260/230 from 0.87 to 1.37 in another.
- **Dry the pellets fully.** Under-dried pellets gave unusable readings and lost DNA. Drying that worked: inverted on a paper towel or Kimwipe at room temperature for 1 to 3.5 hours; inverted, then a 30 °C incubator for 20 minutes to 1 hour; a heat block with lids open at 30 °C for 30 to 40 minutes, or at 60 °C for 10 to 20 minutes; or the fan of a hood for 25 minutes to 1 hour 45 minutes.
- **Use TES, not phage buffer.** Resuspending the ZnCl2 pellet in phage buffer failed, and the notebook marks it as never to be done.
- **A white, viscous "pellet" that soaks up the 50 µl of water is salt, not DNA.** One read 100 ng/µl on the NanoDrop and failed PCR prep.

When it worked, the method gave 616 to 1,803 ng/µl with A260/280 of 1.88 to 2.10 and A260/230 of 1.07 to 1.71, and it recovered usable DNA from a 7.1 x 10^6 pfu/ml lysate that had given too little by the column route.

### Scaling up for low yield

- The method is written for 5 ml in 5 tubes, and scaling it up has gone both ways. One lab scaled to 10 ml of lysate in 10 tubes with 40 µl of nuclease mix and got a gel in the potassium acetate step and a final "salt block." Other groups ran 10 tubes (or 10 x 1 ml aliquots) to raise a low yield, and one ran three 5 ml preps in parallel (15 tubes) and pooled them.
- To top up a low-yield prep, run a second 5 ml prep and resuspend its pellets in the first prep's 50 µl.
- Re-resuspending an already used pellet set a second time also recovered extra DNA.

## Other routes tried: Wizard column and hybrids

The SEA-PHAGES Phage Discovery Guide's Promega Wizard column protocol (9.1) repeatedly gave too little DNA in this lab (Qubit readings of a few ng/ml up to about 104 ng/µl, often too low to read), including from lysates of 7.3 x 10^9 and 1.5 x 10^10 pfu/ml. That is why the lab moved to Method 2.

- Raising the nuclease mix (to 7, 10 or 20 µl), adding 15 µl of EDTA, or inverting 6 minutes instead of 2 did not raise the yield. Slower, longer mixing with the resin helped a little (82.5 ng/µl).
- A ZnCl2 pellet fed into the Wizard resin and column (pellets resuspended in 0.1 M EDTA and pooled) gave no DNA until 0.5 µl of proteinase K and 50 µl of SDS at 37 °C for 10 minutes were added. With them, repeats reached about 60 ng/µl. It still gave a poor A260/230 (0.36) in one lab.
- A Wizard column pass did not remove salt from a ZnCl2 prep. A Promega Wizard PCR and gel clean-up kit was used to clean ZnCl2 DNA that was salty and carried RNA.

## Checking DNA quantity and quality

Check every prep before it goes to restriction digests or sequencing.

### NanoDrop

Select dsDNA, blank with 1 µl of nuclease-free water (or with the elution buffer if the DNA is in elution buffer), then read 1 µl of sample. Record the concentration, A260/280 and A260/230. Good preps from this lab read A260/280 of about 1.8 to 2.1. A low A260/230 means salt; see the fixes above and the rescue below. A scan too poor to be worth a Qubit reading was taken as the sign to redo the extraction.

### Qubit

On ZnCl2 preps the NanoDrop overreads badly, because salt inflates A260. Paired readings from this lab: NanoDrop 407 against Qubit 27.4 ng/µl, 1,082.7 against 59.8, 1,174.7 against 25.9. Treat the Qubit value as the true concentration, and let the instructor decide which value sets digest volumes. Very high NanoDrop readings (over 9,000 ng/µl) settled to about 2,900 to 3,000 ng/µl when the DNA was diluted 1:50 and 1:100 in water.

Qubit dsDNA assay as run on a Qubit 3.0:

| Assay | Working solution | Standards | Sample |
| --- | --- | --- | --- |
| High sensitivity (HS) | 597 µl HS buffer + 3 µl HS reagent (or 995 + 5) | 190 µl working solution + 10 µl standard | 198 µl + 2 µl DNA (or 199 + 1) |
| Broad range (BR) | 796 µl buffer + 4 µl BR reagent | 190 µl working solution + 10 µl standard | 198 µl + 2 µl DNA (or 199 + 1) |

Vortex, let the tubes stand 2 minutes at room temperature, and read the standards before the samples. If the HS assay reads over range, dilute 1 µl of DNA into 19 µl of water (1:20) and multiply the reading by 20 (for example, 30.8 ng/µl x 20 = 616 ng/µl).

### Targets

- Method 1 aims for 300 ng/µl to 1 µg/µl.
- The lab's threshold for restriction digests was 100 ng/µl.
- To send DNA for sequencing at 100 ng/µl in 50 µl, dilute with water. For example, 6.4 µl of a 780 ng/µl prep plus 43.6 µl of water.
- Analyze the DNA by restriction digest and gel, as step 7 of Method 1 says, once it is quantified.

## Rescuing salty or dilute DNA

Ethanol reprecipitation with sodium acetate cleans salty DNA, concentrates dilute DNA and pools two weak preps into one tube. It raised A260/230 in most cases (from 0.74 to 1.67 in one), but not every time (0.66 to 0.63 in another), and it can cut the yield sharply, so use it when the prep would otherwise be redone.

1. Measure the DNA volume with a pipette: dial it down until the air gap disappears. Base the volumes on this volume, not on the ng/µl reading.
2. Add 0.1 volume of 3 M sodium acetate and 3 volumes of ice-cold 100% ethanol (2.5 volumes was also used). For 44 µl of DNA, that is 4.4 µl and 132 µl; for 280 µl, 28 µl and 840 µl. For a very small amount of DNA, 1 µl of 20 mg/ml glycogen can be added as a carrier.
3. Hold at -80 °C for 1 hour to overnight, or at -20 °C overnight. One hour at about -16 °C did not work.
4. Spin at full speed at 4 °C for 30 minutes.
5. Wash twice with 0.5 ml of ice-cold 75% ethanol, with 10 minute spins at 4 °C.
6. Dry until no droplets remain (30 °C, or 37 °C for 10 minutes).
7. Resuspend in 50 µl of nuclease-free water.

Pooling two weak extractions before reprecipitating gave 260.9 ng/µl at 2.01 / 2.01 in one lab, and a gel with strong banding in another.

For how these genomes go on to be sequenced and annotated, see [phage discovery](/teaching/phage-discovery) and [the lab's phages](/research/phages).
