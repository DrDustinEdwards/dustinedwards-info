---
path: /research/tools/eop
title: "Efficiency of Plating Calculator"
seo_title: "Phage EOP Calculator: Efficiency of Plating"
description: "Calculate a phage's efficiency of plating (EOP) on a test host from two titers or from plaque counts, with every step shown."
---

The efficiency of plating (EOP) compares how well a phage forms plaques on a test host with how well it forms them on a reference host, usually the host it was isolated on. An EOP of 1 means the phage plates as well on the test host; an EOP of 0.01 means it forms one plaque there for every 100 on the reference host.

## Formula

    EOP = titer on the test host (pfu/ml) / titer on the reference host (pfu/ml)

Each titer is the [titer calculator](/research/tools/titer)'s: plaques counted / µl plated x 1,000 µl/ml x dilution factor. Plate the same lysate on both hosts, so the only difference is the host. The second calculator on this page starts from the plaque counts and works out both titers first.

## Worked example

These numbers are illustrative, chosen to make the arithmetic easy to follow: one lysate gives 20 plaques from 10 µl of the 10^-5 dilution on the test host, and 100 plaques from 10 µl of the 10^-6 dilution on the reference host.

1. Titer on the test host: 20 / 10 µl x 1,000 x 10^5 = 2 x 10^8 pfu/ml.
2. Titer on the reference host: 100 / 10 µl x 1,000 x 10^6 = 1 x 10^10 pfu/ml.
3. EOP: 2 x 10^8 pfu/ml on the test host / 1 x 10^10 pfu/ml on the reference host = 0.02.
4. As a percentage of the reference titer: 0.02 x 100 = 2%.

The EOP is 0.02, or 2% of the reference titer.

## No plaques on the test host

A plate with no plaques does not mean an EOP of 0. It means the EOP is below what that plate could detect: one plaque on it would have been the smallest titer it could show. The calculator states that limit, and a less dilute plate measures the real value.

## Where the numbers come from

- **10 µl plated.** The lab's full plate titer plates 10 µl of each dilution with 250 µl of host: [full plate titer](/research/protocols/phage-isolation#full-plate-titer).

For EOP from three or more plate counts on each host, with trimmed means and confidence intervals, use Stephen Abedon's [Titering and EOP Calculator](https://titering.phage.org/). This calculator takes one count per host and shows the arithmetic instead.

The other calculators are the [titer calculator](/research/tools/titer), the [serial dilution planner](/research/tools/dilution), the [webbed plate calculator](/research/tools/webbed-plate), the [MOI calculator](/research/tools/moi) and the [lysate volume planner](/research/tools/lysate-volume).
