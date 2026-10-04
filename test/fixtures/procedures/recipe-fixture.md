---
profile: recipe
method: [media]
path: /recipes/recipe-fixture
title: "Test Fixture: Simple Skillet Flatbread"
seo_title: "Test Fixture: Simple Skillet Flatbread"
description: "A generic test recipe used by the procedure tests and screenshots. It exercises every recipe feature and is never published."
draft: true
version: "fixture-1"
updated: 2026-09-30
servings: 4
cuisine: Generic
category: Bread
diet: [vegetarian]
prep_time: 15 minutes
cook_time: 20 minutes
time:
  total: 1.5 hours
  hands_on: 35 minutes
image:
  src: /media/fixture-recipe.jpg
  alt: "Four test flatbreads stacked on a board."
substitutions:
  - for: plain yogurt
    use: water
    note: "The bread is less tender but still works."
  - for: olive oil
    use: any neutral oil
materials:
  - name: flour
    display: plain flour
  - name: salt
  - name: yeast
    display: instant yeast
  - name: yogurt
    display: plain yogurt
  - name: warm water
  - name: olive oil
equipment:
  - mixing bowl
  - skillet
based_on:
  - citation: "A generic flatbread method, written for the test suite"
    for: the method and the proportions
troubleshooting:
  - id: tough-bread
    step: "5"
    problem: "The flatbreads come out tough."
    reason: "The skillet was not hot enough, so they dried before they puffed."
    solution: "Heat the skillet longer before the first bread goes in."
expected_results: "Four soft flatbreads, puffed in places and browned in spots on both sides."
limitations: "A test fixture only. The times assume a medium-heavy skillet on a gas burner."
references:
  - "Test fixture reference. [example.com](https://example.com/)"
---

This is a test fixture for the procedure format, not a recipe the site publishes. It exercises every recipe
feature: scaling amounts, a fixed amount, equipment, timers, flags and a step photo.

## Make the dough

1. Whisk @flour{250%g}, @salt{=1%tsp} and @yeast{1%tsp} in a #mixing bowl{}.
   > WHY: **Why a fixed amount of salt?** The test needs one amount that scaling leaves alone.
   > Salt is a matter of taste, so it stays the same for any batch.
2. Stir in @yogurt{120%g} and @warm water{80 to 100%ml} until a soft dough forms.
3. Knead for ~{5%minutes}, then cover and rest for ~rise{1%hour}.
   > PAUSE POINT: Make ahead: the dough keeps in the fridge overnight, covered.

## Cook

4. Divide the dough into 4 pieces and roll each thin.
   ![Four rolled rounds of dough on a floured board.](/media/fixture-step.jpg)
5. Heat a #skillet over medium-high heat with @olive oil{1%tbsp} and cook each bread for ~{2%minutes} a side.
   > CRITICAL: Heat the skillet fully before the first bread. A cool pan makes a tough bread.
   > TROUBLESHOOTING: tough-bread
