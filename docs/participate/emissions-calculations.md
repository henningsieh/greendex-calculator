---
applyTo: '**'
description: Emissions calculations formulas and logic for the Greendex questionnaire
---

# Emissions Calculations — Greendex Questionnaire

This document contains all numeric factors, formulas, example calculations, and how emissions are displayed during and after the questionnaire.

## CO₂ Factors

### Transport CO₂ (kg CO₂ per km per person)
**Based on Erasmus+ intra-European travel context**
```ts
const CO2_FACTORS = {
  car: 0.168,        // Real-world EU fleet average (diesel/petrol)
  boat: 0.050,       // Standard ferry (0.115 for fast/long-distance ferry)
  bus: 0.032,        // Long-distance coach (Erasmus-eligible green travel)
  train: 0.035,      // EU electric train average (lower for high-speed rail)
  plane: 0.154,      // Short-haul intra-European flights (500-2000km range)
  electricCar: 0.053, // EU grid mix average
};
```

### Car Emissions With Passengers
Car emissions are divided by the number of passengers:
```ts
carCO2 = (carKm * carFactor) / carPassengers
```

### Accommodation CO₂ (kg CO₂ per night per person)
```ts
const ACCOMMODATION_FACTORS = {
  "Camping": 1.5,
  "Hostel": 3.0,
  "3★ Hotel": 5.0,
  "4★ Hotel": 7.5,
  "5★ Hotel": 10.0,
  "Apartment": 4.0,
  "Friends/Family": 2.0,
};

const occupancyFactors = {
  "alone": 1.0,
  "2 people": 0.6,
  "3 people": 0.4,
  "4+ people": 0.3,
};

const electricityFactors = {
  "green energy": 0.5,
  "conventional energy": 1.0,
  "could not find out": 1.0,
};
```

Accommodation formula:
```ts
accommodationCO2 = days × baseFactor × occupancyFactor × electricityFactor
```

### Food CO₂ (kg CO₂ per day)
```ts
const FOOD_FACTORS = {
  "never": 1.5,
  "rarely": 2.5,
  "sometimes": 4.0,
  "almost every day": 5.5,
  "every day": 7.0,
};
```

Food formula:
```ts
foodCO2 = days × foodFactor
```

### Total Emissions & Trees
```ts
totalCO2 = transportCO2 + accommodationCO2 + foodCO2
treesNeeded = Math.ceil(totalCO2 / 22) // 22kg CO₂ per tree per year
```

### Example Calculation
Scenario:
- 7 days, Hostel (3.0 base), 2 people per room, green energy, sometimes eat meat
- Flight 500 km, Bus 20 km, No car

Results:
```
Flight: 500 × 0.154 = 77.0 kg CO₂
Bus: 20 × 0.032 = 0.64 kg CO₂
Transport Subtotal: 77.64 kg CO₂
Transport Total (round trip): 77.64 × 2 = 155.28 kg CO₂
Accommodation: 7 × 3.0 × 0.6 × 0.5 = 6.3 kg CO₂
Food: 7 × 4.0 = 28.0 kg CO₂
Total: 189.58 kg CO₂
Trees: ceil(189.58 / 22) = 9
```

### Emission Display Logic
- Intermediate Display (Step 10): After transport questions, show transportCO2 and trees needed for 3 seconds to give immediate feedback.
- Final Display (Step 14): Show a breakdown for Transport, Accommodation, and Food, plus totals and trees needed.

### Console Output (on completion)
```js
=== Participant Questionnaire Complete ===
Participant Answers: { /* ...answers... */ }
Emissions Calculation: {
  transportCO2: 155.28,
  accommodationCO2: 6.3,
  foodCO2: 28.0,
  totalCO2: 189.58,
  treesNeeded: 9
}
==========================================
```
