---
applyTo: '**'
description: Greendex participant questionnaire flow - 14-step routing, components, and content
---

# Participate Questionnaire — Flow

## Overview
This document details the questionnaire flow used in the Greendex participant questionnaire (14 steps). It explains routing, components, and each step's content.

## Route Location
```
src/app/[locale]/(app)/(public participation)/project/[id]/participate/
├── layout.tsx  - Public access layout (no auth required)
└── page.tsx    - Main route with QuestionnaireForm component
```

## Components Structure
```
src/components/participate/
├── questionnaire-form.tsx       - Main 14-step questionnaire
├── questionnaire-utils.ts       - Emission calculation functions
├── types.ts                     - Type definitions
└── __tests__/
    └── participate.test.tsx   - Unit tests for calculations

src/config/
└── questionnaire.ts             - Configuration & real-world emission factors
```

## 14-Step Questionnaire Flow

### Step 0: Welcome
- Project name and details
- Welcome message
- "Start Greendex" button

### Step 1: Project Days
- Question: "How many days are you participating on your project?"
- Type: Number input (min: 1)

### Step 2: Accommodation Category
- Question: "Which type of accommodation are you staying in?"
- Type: Options (Camping, Hostel, 3★ Hotel, 4★ Hotel, 5★ Hotel, Apartment, Friends/Family)

### Step 3: Room Occupancy
- Question: "How many people are sharing the room/tent?"
- Type: Options (alone, 2 people, 3 people, 4+ people)

### Step 4: Electricity Type
- Question: "Which type of energy does your accommodation use?"
- Type: Options (green energy, conventional, could not find out)

### Step 5: Food Habits
- Question: "How often do you plan to eat meat on your project?"
- Choices: never, rarely, sometimes, almost every day, every day

### Steps 6–10: Transport (TO the project)
- Step 6: Plane distance (km)
- Step 7: Boat distance (km)
- Step 8: Train distance (km)
- Step 9: Bus distance (km)
- Step 10: Car distance (km) — after completing this step, intermediate transport emissions are shown

### Step 11: Car Type (Conditional)
- Only shown when `carKm > 0` — Choices: conventional, electric

### Step 12: Car Passengers (Conditional)
- Only shown when `carKm > 0` (min: 1)

### Step 13: Age
- Question: "How old are you?" (min: 1)

### Step 14: Gender
- Question: "What is your gender?" — Choices: Female, Male, Other / Prefer not to say

### Progress UI
- Progress bar: `(currentStep + 1) / 15 * 100` (adjusted for skipped steps)
- Step counter: shows "Step X of 15" and accounts for conditional steps skipped

### Navigation & Validation
- Each step validates answers (numbers >= min, required choice selection)
- Back & Continue buttons; final step shows "Complete"

---

See `emissions-calculations.md` for the numeric emission formulas and `conditional-logic.md` for step-skipping behaviour.
