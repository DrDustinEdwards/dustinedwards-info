---
path: /research/tools/moi
title: "MOI Calculator"
seo_title: "Phage MOI Calculator: Multiplicity of Infection"
description: "Calculate the multiplicity of infection (MOI) from a phage titer, the volume added and a host cell count, with every step shown."
---

The multiplicity of infection (MOI) is the number of phages added per host cell. It sets how many cells are infected in the first round: at a low MOI most cells get no phage, and at a high MOI nearly every cell gets at least one.

## Formula

    pfu added = titer (pfu/ml) x µl added / 1,000 µl/ml
    cells = cells/ml x µl of culture / 1,000 µl/ml
    MOI = pfu added / cells
    share of cells infected = 1 - exp(-MOI)

The last line assumes phages meet cells at random (a Poisson distribution) and that every pfu adsorbs, so it is the most the MOI can infect. At an MOI of 1, about 63% of cells get at least one phage and about 37% get none.

## Worked example

These numbers are illustrative, chosen to make the arithmetic easy to follow: 10 µl of a lysate at 1 x 10^9 pfu/ml added to 250 µl of a host culture at 1 x 10^8 cells/ml.

1. pfu added: 1 x 10^9 pfu/ml x 10 µl / 1,000 µl/ml = 1 x 10^7 pfu.
2. Cells: 1 x 10^8 cells/ml x 250 µl / 1,000 µl/ml = 2.5 x 10^7 cells.
3. MOI: 1 x 10^7 pfu / 2.5 x 10^7 cells = 0.4.
4. Cells that get at least one phage: 1 - exp(-0.4) = 0.33, about 33%.

The MOI is 0.4 pfu per cell.

## Counting the cells

The MOI is only as good as the cell count. Count the host culture, for example by plating a dilution of it and counting colonies. This site gives no conversion from an optical density reading to cells per ml for the lab's hosts, so the calculator takes cells per ml and does not guess one from an OD. The 1 x 10^8 cells/ml in the example is not a measured value for any host.

## Where the numbers come from

- **10 µl of phage with 250 µl of host.** The lab's full plate titer plates 10 µl of each dilution with 250 µl of host: [full plate titer](/research/protocols/phage-isolation#full-plate-titer). The calculator opens with these volumes; change them to match your own experiment.
- **The titer** comes from the [titer calculator](/research/tools/titer).

The other calculators are the [titer calculator](/research/tools/titer), the [serial dilution planner](/research/tools/dilution), the [webbed plate calculator](/research/tools/webbed-plate), the [efficiency of plating calculator](/research/tools/eop) and the [lysate volume planner](/research/tools/lysate-volume).
