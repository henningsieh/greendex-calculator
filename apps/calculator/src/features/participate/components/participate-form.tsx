"use client";

import {
  ACCOMMODATION_OPTIONS,
  CAR_TYPE_OPTIONS,
  ELECTRICITY_OPTIONS,
  EMISSION_IMPACT_STEPS,
  FOOD_OPTIONS,
  GENDER_OPTIONS,
  getParticipateStepsKey,
  QUESTIONNAIRE_STEPS,
  PARTICIPATE_TOTAL_STEPS,
  ROOM_OCCUPANCY_OPTIONS,
} from "@greendex/config/participate";
import { useTranslations } from "@greendex/i18n/client";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { AnimatedGroup } from "@/components/animated-group";
import { CountrySelect } from "@/components/country-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ImpactModal } from "@/features/participate/components/participate-impact-modal";
import type { ParticipantAnswers, Project } from "@/features/participate/types";
import {
  areAllNonEmpty,
  calculateEmissions,
  isNonNegativeNumber,
  isNumberAtLeast,
  isPositiveNumber,
  isTruthy,
} from "@/features/participate/utils";
import { PROJECT_ICONS } from "@/features/projects/components/project-icons";
import { calculateProjectDuration } from "@/features/projects/utils";

interface QuestionnaireFormProps {
  project: Project;
}

/**
 * Render an interactive questionnaire UI for a specific project.
 *
 * Renders a multi-step form that collects participant answers, calculates emissions
 * from inputs and Project Shared Travel Legs, shows step-by-step progress and
 * optional impact modals for emission-affecting answers, and displays a final emissions summary.
 * The component persists form state (answers and current step and confirmedEmissions) to localStorage per
 * project.id and clears that data on submission.
 *
 * @param project - Project data (dates, shared travel, welcome message, id) used
 *   to initialize defaults, compute project duration, and calculate emissions.
 * @returns The questionnaire UI as a JSX element.
 */

/**
 * Renders the multi-step participant questionnaire UI, managing form state, localStorage persistence, conditional step flow, emission calculations, and impact confirmation modals.
 *
 * @param project - Project data used to initialize default answers, provide canonical shared travel for emissions calculations, and display project-specific text (e.g., welcome message).
 * @returns The questionnaire form React element.
 */

// oxlint-disable-next-line complexity
export function QuestionnaireForm({ project }: QuestionnaireFormProps) {
  const t = useTranslations("participation.questionnaire");

  const getDefaultAnswers = (project: Project): Partial<ParticipantAnswers> => ({
    firstName: "",
    country: "",
    email: "",
    days: (() => {
      try {
        return calculateProjectDuration(project.startDate, project.endDate);
      } catch (error) {
        console.error(
          `Error calculating project duration for project ${project.id}:`,
          error,
        );
        return 0; // Fallback to 0 days if dates are invalid
      }
    })(),
    flightKm: 0,
    boatKm: 0,
    trainKm: 0,
    busKm: 0,
    carKm: 0,
    carPassengers: 1,
    age: 0,
  });

  const [answers, setAnswers] = useState<Partial<ParticipantAnswers>>(() => {
    if (typeof window === "undefined") {
      // Server-side rendering, return default values
      return getDefaultAnswers(project);
    }

    const key = `questionnaire-${project.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const savedAnswers = parsed.answers || {};
        // Only set default days if not already saved
        if (!savedAnswers.days) {
          savedAnswers.days = getDefaultAnswers(project).days;
        }
        return savedAnswers;
      } catch (error) {
        console.warn(
          `Invalid JSON in localStorage for key ${key}, falling back to defaults`,
          error,
        );
        localStorage.removeItem(key);
        const savedAnswers: Partial<ParticipantAnswers> = {};
        savedAnswers.days = getDefaultAnswers(project).days;
        return savedAnswers;
      }
    }
    return getDefaultAnswers(project);
  });

  const [currentStep, setCurrentStep] = useState<
    (typeof QUESTIONNAIRE_STEPS)[keyof typeof QUESTIONNAIRE_STEPS]
  >(() => {
    if (typeof window === "undefined") {
      return 0;
    }

    const key = `questionnaire-${project.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored).currentStep || 0;
      } catch (error) {
        console.warn(
          `Invalid JSON in localStorage for key ${key}, falling back to step 0`,
          error,
        );
        localStorage.removeItem(key);
        return 0;
      }
    }
    return 0;
  });

  const [isHydrated, setIsHydrated] = useState(false);

  // Impact modal state
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [impactData, setImpactData] = useState<{
    previousCO2: number;
    newCO2: number;
    impact: number;
    stepKey: string;
    stepValue: string | number;
  } | null>(null);

  // Confirmed emissions for display, updated only after impact modals
  const [confirmedEmissions, setConfirmedEmissions] = useState<{
    totalCO2: number;
    treesNeeded: number;
  } | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const key = `questionnaire-${project.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.confirmedEmissions || null;
      } catch (error) {
        console.warn(
          `Invalid JSON in localStorage for key ${key}, falling back to null for confirmedEmissions`,
          error,
        );
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    const key = `questionnaire-${project.id}`;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ answers, currentStep, confirmedEmissions }),
      );
    } catch (error) {
      console.error(
        `Failed to save questionnaire data to localStorage for key ${key}:`,
        error,
      );
      // Optionally clear the key if it exists to free up space
      try {
        localStorage.removeItem(key);
      } catch (removeError) {
        console.error(`Failed to remove localStorage key ${key}:`, removeError);
      }
    }
  }, [answers, currentStep, confirmedEmissions, project.id]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const totalSteps = PARTICIPATE_TOTAL_STEPS;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const updateAnswer = <K extends keyof ParticipantAnswers>(
    key: K,
    value: ParticipantAnswers[K],
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const proceedToNextStep = () => {
    // Skip car questions if no car travel
    if (
      currentStep === QUESTIONNAIRE_STEPS.carKm &&
      (!answers.carKm || answers.carKm === 0)
    ) {
      setCurrentStep(QUESTIONNAIRE_STEPS.age); // Skip to age
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(
        (currentStep +
          1) as (typeof QUESTIONNAIRE_STEPS)[keyof typeof QUESTIONNAIRE_STEPS],
      );
    } else {
      handleSubmit();
    }
  };

  const shouldShowImpact = (stepKey: string | null): boolean => {
    if (!stepKey) {
      return false;
    }

    // Skip impact modal for welcome and participantInfo steps
    if (stepKey === "welcome" || stepKey === "participantInfo") {
      return false;
    }

    // Skip impact for zero-value transport questions
    if (["flightKm", "boatKm", "trainKm", "busKm"].includes(stepKey)) {
      const value = answers[stepKey as keyof ParticipantAnswers];
      if (Number(value) === 0) {
        return false;
      }
    }

    // Skip carPassengers impact if no car travel
    if (stepKey === "carPassengers" && (!answers.carKm || answers.carKm === 0)) {
      return false;
    }

    // Type-safe check for emission impact steps
    return (EMISSION_IMPACT_STEPS as readonly string[]).includes(stepKey);
  };

  const handleNext = () => {
    const stepKey = getParticipateStepsKey(currentStep);

    if (stepKey && shouldShowImpact(stepKey)) {
      // Calculate previous CO₂ WITHOUT the current answer(s)
      const answersWithoutCurrent = {
        ...answers,
      };
      if (stepKey === "electricity") {
        // For accommodation, calculate impact as total accommodation CO₂
        // by removing all accommodation-related answers
        answersWithoutCurrent.accommodationCategory = undefined;
        answersWithoutCurrent.roomOccupancy = undefined;
        answersWithoutCurrent.electricity = undefined;
      } else {
        delete answersWithoutCurrent[stepKey as keyof ParticipantAnswers];
      }
      const previousEmissions = calculateEmissions(
        answersWithoutCurrent,
        project.sharedTravelLegs,
      );
      const previousCO2 =
        previousEmissions.participantTravelCO2 +
        previousEmissions.accommodationCO2 +
        previousEmissions.foodCO2;

      // Calculate new CO₂ WITH the current answer (participant-only)
      const currentValue = answers[stepKey as keyof ParticipantAnswers];
      const newEmissions = calculateEmissions(answers, project.sharedTravelLegs);
      const newCO2 =
        newEmissions.participantTravelCO2 +
        newEmissions.accommodationCO2 +
        newEmissions.foodCO2;
      const impact = newCO2 - previousCO2;

      setImpactData({
        previousCO2,
        newCO2,
        impact,
        stepKey,
        stepValue: currentValue as string | number,
      });
      setShowImpactModal(true);
    } else {
      proceedToNextStep();
    }
  };

  const handleImpactModalClose = () => {
    const fullEmissions = calculateEmissions(answers, project.sharedTravelLegs);
    const participantCO2 =
      fullEmissions.participantTravelCO2 +
      fullEmissions.accommodationCO2 +
      fullEmissions.foodCO2;
    setConfirmedEmissions({
      totalCO2: participantCO2,
      treesNeeded: Math.ceil(participantCO2 / 22),
    });
    setShowImpactModal(false);
    proceedToNextStep();
  };

  const handleBack = () => {
    // Handle back navigation with conditional steps
    if (
      currentStep === QUESTIONNAIRE_STEPS.age &&
      (!answers.carKm || answers.carKm === 0)
    ) {
      // Jump back to carKm step if we skipped car questions
      setCurrentStep(QUESTIONNAIRE_STEPS.carKm);
      return;
    }

    if (currentStep > QUESTIONNAIRE_STEPS.welcome) {
      setCurrentStep(
        (currentStep -
          1) as (typeof QUESTIONNAIRE_STEPS)[keyof typeof QUESTIONNAIRE_STEPS],
      );
    }
  };

  const handleSubmit = () => {
    const emissions = calculateEmissions(answers, project.sharedTravelLegs);

    // Complete data structure as requested
    const completeData = {
      answers, // Discrete answers object
      emissions, // Calculated results, including Project Shared Travel once
      summary: {
        totalCO2: emissions.totalCO2,
        treesNeeded: emissions.treesNeeded,
        breakdown: {
          participantTravel: emissions.participantTravelCO2,
          projectSharedTravel: emissions.projectSharedTravelCO2,
          accommodation: emissions.accommodationCO2,
          food: emissions.foodCO2,
        },
      },
    };

    console.log("=== Participant Questionnaire Complete ===");
    console.log("Discrete Answers:", answers);
    console.log("Emissions Calculation:", emissions);
    console.log("Complete Data:", completeData);
    console.log("==========================================");

    // Clear persisted data after submission
    localStorage.removeItem(`questionnaire-${project.id}`);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case QUESTIONNAIRE_STEPS.welcome:
        return true;
      case QUESTIONNAIRE_STEPS.participantInfo:
        return areAllNonEmpty(answers.firstName, answers.country, answers.email);
      case QUESTIONNAIRE_STEPS.days:
        return isPositiveNumber(answers.days);
      case QUESTIONNAIRE_STEPS.accommodationCategory:
        return isTruthy(answers.accommodationCategory);
      case QUESTIONNAIRE_STEPS.roomOccupancy:
        return isTruthy(answers.roomOccupancy);
      case QUESTIONNAIRE_STEPS.electricity:
        return isTruthy(answers.electricity);
      case QUESTIONNAIRE_STEPS.food:
        return isTruthy(answers.food);
      case QUESTIONNAIRE_STEPS.flightKm:
        return isNonNegativeNumber(answers.flightKm);
      case QUESTIONNAIRE_STEPS.boatKm:
        return isNonNegativeNumber(answers.boatKm);
      case QUESTIONNAIRE_STEPS.trainKm:
        return isNonNegativeNumber(answers.trainKm);
      case QUESTIONNAIRE_STEPS.busKm:
        return isNonNegativeNumber(answers.busKm);
      case QUESTIONNAIRE_STEPS.carKm:
        return isNonNegativeNumber(answers.carKm);
      case QUESTIONNAIRE_STEPS.carType:
        return isTruthy(answers.carType);
      case QUESTIONNAIRE_STEPS.carPassengers:
        return isNumberAtLeast(answers.carPassengers, 1);
      case QUESTIONNAIRE_STEPS.age:
        return isPositiveNumber(answers.age);
      case QUESTIONNAIRE_STEPS.gender:
        return isTruthy(answers.gender);
      default:
        return false;
    }
  };

  const emissions = calculateEmissions(answers, project.sharedTravelLegs);
  /**
   * Adjust step display number when car questions are conditionally skipped.
   * If user enters 0 car km, we skip carType and carPassengers steps,
   * so when at age step, display it as if at carType step for progress bar.
   */
  const currentStepDisplay =
    currentStep === QUESTIONNAIRE_STEPS.age &&
    (!answers.carKm || answers.carKm === 0)
      ? QUESTIONNAIRE_STEPS.carType
      : currentStep;

  const renderedStep = isHydrated ? currentStep : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Compact Stats Bar - shown from step 2 onwards */}
      {isHydrated && currentStep >= 2 && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2 sm:gap-3"
          initial={{ opacity: 0, y: -10 }}
        >
          <Card className="flex flex-col items-center justify-between gap-1.5 border-red-500/20 bg-red-500/5 p-2.5 sm:flex-row sm:gap-3 sm:p-3">
            <div className="mb-0.5 flex items-center gap-2.5 sm:mb-0">
              <PROJECT_ICONS.emissions className="size-4 text-red-400 sm:size-5" />
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                {t("results.co2-footprint")}
              </span>
            </div>
            <span className="font-mono text-base font-bold text-red-400 tabular-nums sm:text-lg">
              {(confirmedEmissions?.totalCO2 ?? 0).toFixed(1)} kg
            </span>
          </Card>
          <Card className="flex flex-col items-center justify-between gap-1.5 border-green-500/20 bg-green-500/5 p-2.5 sm:flex-row sm:gap-3 sm:p-3">
            <div className="mb-0.5 flex items-center gap-2.5 sm:mb-0">
              <PROJECT_ICONS.emissions_offset className="size-4 text-green-400 sm:size-5" />
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                {t("results.trees-needed")}
              </span>
            </div>
            <span className="font-mono text-base font-bold text-green-400 tabular-nums sm:text-lg">
              {confirmedEmissions?.treesNeeded ?? 0}
            </span>
          </Card>
        </motion.div>
      )}

      {/* Progress Bar */}
      {isHydrated && (
        <div className="flex items-center gap-3">
          <Progress className="h-1.5 flex-1" value={progress} />
          <div className="text-[11px] text-muted-foreground sm:text-xs">
            {t("header.step-counter", {
              current: currentStepDisplay + 1,
              total: totalSteps,
            })}
          </div>
        </div>
      )}

      {/* Impact Modal */}
      {showImpactModal && impactData && (
        <ImpactModal
          accommodationCategory={answers.accommodationCategory}
          carKm={answers.carKm}
          days={answers.days}
          impact={impactData.impact}
          isOpen={showImpactModal}
          newCO2={impactData.newCO2}
          onClose={handleImpactModalClose}
          previousCO2={impactData.previousCO2}
          roomOccupancy={answers.roomOccupancy}
          stepKey={impactData.stepKey}
          stepValue={impactData.stepValue}
        />
      )}

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          initial={{ opacity: 0, x: 20 }}
          key={renderedStep}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Card className="border-primary/20 bg-card/50 p-4 backdrop-blur-sm sm:p-5 md:p-6">
            {/* Step 0: Welcome */}
            {renderedStep === 0 && (
              <div className="space-y-6 text-center">
                <p className="text-sm text-muted-foreground sm:text-base">
                  {project.welcomeMessage || t("welcome.default-message")}
                </p>
                <AnimatedGroup>
                  <p className="mt-3 text-center text-xl font-bold text-emerald-500 sm:text-2xl">
                    {t("welcome.ready")}
                  </p>
                  <p className="mt-1.5 text-center text-base font-medium text-secondary sm:text-lg">
                    {t("welcome.every-choice")}
                  </p>
                  <p className="mx-auto mt-4 max-w-xl text-center text-lg font-semibold text-foreground sm:text-xl">
                    {t("welcome.fun-message")}
                  </p>
                </AnimatedGroup>
                <Button
                  className="mt-4 w-full bg-linear-to-r from-teal-700 to-emerald-600 px-8 py-4 text-base transition-all duration-250 hover:scale-[1.02] hover:from-teal-800 hover:to-emerald-700 sm:w-auto sm:text-lg"
                  onClick={handleNext}
                  size="lg"
                >
                  {t("welcome.start-button")}
                  <ArrowRightIcon className="ml-2 size-5" />
                </Button>
              </div>
            )}

            {/* Step 1: Participant Info */}
            {renderedStep === 1 && (
              <div className="space-y-5">
                <h2 className="mb-3 text-center text-xl font-bold text-foreground sm:text-2xl">
                  {t("participant-info.title")}
                </h2>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-foreground" htmlFor="firstName">
                      {t("participant-info.first-name")}{" "}
                      <span className="text-red-500">
                        {t("participant-info.required")}
                      </span>
                    </Label>
                    <Input
                      className="h-11 text-base sm:text-lg"
                      id="firstName"
                      onChange={(e) => updateAnswer("firstName", e.target.value)}
                      placeholder={t("participant-info.first-name-placeholder")}
                      type="text"
                      value={answers.firstName || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">
                      {t("participant-info.country")}{" "}
                      <span className="text-red-500">
                        {t("participant-info.required")}
                      </span>
                    </Label>
                    <CountrySelect
                      className="text-base sm:text-lg"
                      onValueChange={(value) => updateAnswer("country", value)}
                      placeholder={t("participant-info.country-placeholder")}
                      value={answers.country || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground" htmlFor="email">
                      {t("participant-info.email")}{" "}
                      <span className="text-red-500">
                        {t("participant-info.required")}
                      </span>
                    </Label>
                    <Input
                      className="h-11 text-base sm:text-lg"
                      id="email"
                      onChange={(e) => updateAnswer("email", e.target.value)}
                      placeholder={t("participant-info.email-placeholder")}
                      type="email"
                      value={answers.email || ""}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Days */}
            {renderedStep === 2 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  {t("days.question")}
                </Label>
                <p className="text-sm text-muted-foreground">{t("days.note")}</p>
                <Input
                  className="h-11 text-base sm:text-lg"
                  min="1"
                  onChange={(e) =>
                    updateAnswer("days", Number.parseInt(e.target.value, 10))
                  }
                  placeholder={t("days.placeholder")}
                  type="number"
                  value={answers.days || ""}
                />
              </div>
            )}

            {/* Step 3: Accommodation Category */}
            {renderedStep === 3 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  Which type of accommodation are you staying in?
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ACCOMMODATION_OPTIONS.map((option) => (
                    <button
                      className={`rounded-lg border-2 p-3 text-left text-sm transition-all hover:scale-[1.01] active:scale-[0.99] sm:p-3.5 sm:text-base ${
                        answers.accommodationCategory === option
                          ? "border-teal-500 bg-teal-500/10 font-semibold text-teal-400 shadow-sm"
                          : "border-border text-foreground hover:border-border/50 hover:bg-accent"
                      }`}
                      key={option}
                      onClick={() =>
                        updateAnswer("accommodationCategory", option)
                      }
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Room Occupancy */}
            {renderedStep === 4 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  How many people are sharing the room/tent?
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {ROOM_OCCUPANCY_OPTIONS.map((option) => (
                    <button
                      className={`rounded-lg border-2 p-3 text-sm transition-all hover:scale-[1.01] active:scale-[0.99] sm:p-3.5 sm:text-base ${
                        answers.roomOccupancy === option
                          ? "border-teal-500 bg-teal-500/10 font-semibold text-teal-400 shadow-sm"
                          : "border-border text-foreground hover:border-border/50 hover:bg-accent"
                      }`}
                      key={option}
                      onClick={() => updateAnswer("roomOccupancy", option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Electricity */}
            {renderedStep === 5 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  Which type of energy does your accommodation use?
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ELECTRICITY_OPTIONS.map((option) => (
                    <button
                      className={`rounded-lg border-2 p-3 text-left text-sm transition-all hover:scale-[1.01] active:scale-[0.99] sm:p-3.5 sm:text-base ${
                        answers.electricity === option
                          ? "border-teal-500 bg-teal-500/10 font-semibold text-teal-400 shadow-sm"
                          : "border-border text-foreground hover:border-border/50 hover:bg-accent"
                      }`}
                      key={option}
                      onClick={() => updateAnswer("electricity", option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6: Food */}
            {renderedStep === 6 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  How often do you plan to eat meat on your project?
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FOOD_OPTIONS.map((option) => (
                    <button
                      className={`rounded-lg border-2 p-3 text-left text-sm transition-all hover:scale-[1.01] active:scale-[0.99] sm:p-3.5 sm:text-base ${
                        answers.food === option
                          ? "border-teal-500 bg-teal-500/10 font-semibold text-teal-400 shadow-sm"
                          : "border-border text-foreground hover:border-border/50 hover:bg-accent"
                      }`}
                      key={option}
                      onClick={() => updateAnswer("food", option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 7: Flight km */}
            {renderedStep === 7 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  Your way TO the project: How many kilometres did you fly?
                </Label>
                <Input
                  className="h-11 text-base sm:text-lg"
                  min="0"
                  onChange={(e) =>
                    updateAnswer(
                      "flightKm",
                      Number.parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="0"
                  step="0.1"
                  type="number"
                  value={answers.flightKm ?? ""}
                />
              </div>
            )}

            {/* Step 8: Boat km */}
            {renderedStep === 8 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  Your way TO the project: How many kilometres did you go by boat?
                </Label>
                <Input
                  className="h-11 text-base sm:text-lg"
                  min="0"
                  onChange={(e) =>
                    updateAnswer("boatKm", Number.parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  step="0.1"
                  type="number"
                  value={answers.boatKm ?? ""}
                />
              </div>
            )}

            {/* Step 9: Train km */}
            {renderedStep === 9 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  Your way TO the project: How many kilometres did you go by train
                  or metro?
                </Label>
                <Input
                  className="h-11 text-base sm:text-lg"
                  min="0"
                  onChange={(e) =>
                    updateAnswer(
                      "trainKm",
                      Number.parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="0"
                  step="0.1"
                  type="number"
                  value={answers.trainKm ?? ""}
                />
              </div>
            )}

            {/* Step 10: Bus km */}
            {renderedStep === 10 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  Your way TO the project: How many kilometres did you go by
                  bus/van?
                </Label>
                <Input
                  className="h-11 text-base sm:text-lg"
                  min="0"
                  onChange={(e) =>
                    updateAnswer("busKm", Number.parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  step="0.1"
                  type="number"
                  value={answers.busKm ?? ""}
                />
              </div>
            )}

            {/* Step 11: Car km */}
            {renderedStep === 11 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  Your way TO the project: How many kilometres did you go by car?
                </Label>
                <Input
                  className="h-11 text-base sm:text-lg"
                  min="0"
                  onChange={(e) =>
                    updateAnswer("carKm", Number.parseFloat(e.target.value) || 0)
                  }
                  placeholder="0"
                  step="0.1"
                  type="number"
                  value={answers.carKm ?? ""}
                />
              </div>
            )}

            {/* Step 12: Car Type (conditional) */}
            {renderedStep === 12 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  What type of car did you use?
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CAR_TYPE_OPTIONS.map((option) => (
                    <button
                      className={`rounded-lg border-2 p-3 text-left text-sm transition-all hover:scale-[1.01] active:scale-[0.99] sm:p-3.5 sm:text-base ${
                        answers.carType === option
                          ? "border-teal-500 bg-teal-500/10 font-semibold text-teal-400 shadow-sm"
                          : "border-border text-foreground hover:border-border/50 hover:bg-accent"
                      }`}
                      key={option}
                      onClick={() => updateAnswer("carType", option)}
                      type="button"
                    >
                      {t(`transport.car-type.${option}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 13: Car Passengers (conditional) */}
            {renderedStep === 13 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  How many participants (including you) were sitting in the car?
                </Label>
                <Input
                  className="h-11 text-base sm:text-lg"
                  min="1"
                  onChange={(e) =>
                    updateAnswer(
                      "carPassengers",
                      Number.parseInt(e.target.value, 10),
                    )
                  }
                  placeholder="1"
                  type="number"
                  value={answers.carPassengers || ""}
                />
              </div>
            )}

            {/* Step 14: Age */}
            {renderedStep === 14 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  How old are you?
                </Label>
                <Input
                  className="h-11 text-base sm:text-lg"
                  min="1"
                  onChange={(e) =>
                    updateAnswer("age", Number.parseInt(e.target.value, 10))
                  }
                  placeholder="Age"
                  type="number"
                  value={answers.age || ""}
                />
              </div>
            )}

            {/* Step 15: Gender */}
            {renderedStep === 15 && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-foreground md:text-xl">
                  What is your gender?
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {GENDER_OPTIONS.map((option) => (
                    <button
                      className={`rounded-lg border-2 p-3 text-left text-sm transition-all hover:scale-[1.01] active:scale-[0.99] sm:p-3.5 sm:text-base ${
                        answers.gender === option
                          ? "border-teal-500 bg-teal-500/10 font-semibold text-teal-400 shadow-sm"
                          : "border-border text-foreground hover:border-border/50 hover:bg-accent"
                      }`}
                      key={option}
                      onClick={() => updateAnswer("gender", option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            {renderedStep > 0 && (
              <div className="mt-6 flex gap-3">
                <Button
                  className="h-11 flex-1 text-sm sm:text-base"
                  onClick={handleBack}
                  type="button"
                  variant="outline"
                >
                  <ArrowLeftIcon className="mr-2 size-4" />
                  {t("navigation.back")}
                </Button>
                <Button
                  className={`h-11 flex-1 bg-linear-to-r from-teal-500 to-emerald-500 text-sm text-white transition-all duration-250 hover:from-teal-600 hover:to-emerald-600 hover:shadow-md sm:text-base ${
                    renderedStep === 0 ? "w-full" : ""
                  }`}
                  disabled={!canProceed()}
                  onClick={handleNext}
                  type="button"
                >
                  {renderedStep === 15 ? (
                    <>
                      <CheckCircle2Icon className="mr-2 size-5" />
                      {t("navigation.complete")}
                    </>
                  ) : (
                    <>
                      {t("navigation.continue")}
                      <ArrowRightIcon className="ml-2 size-5" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Show final results after completion */}
      {renderedStep === 15 && emissions.totalCO2 > 0 && (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="border-teal-500/30 bg-linear-to-br from-teal-500/20 to-emerald-500/20 p-6">
            <div className="space-y-6">
              <h3 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
                {t("results.summary-title")}
              </h3>
              <div className="space-y-3 text-sm sm:text-base">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("results.participant-travel")}
                  </span>
                  <span className="font-semibold text-foreground">
                    {emissions.participantTravelCO2.toFixed(1)} kg CO₂
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("results.accommodation")}
                  </span>
                  <span className="font-semibold text-foreground">
                    {emissions.accommodationCO2.toFixed(1)} kg CO₂
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("results.food")}
                  </span>
                  <span className="font-semibold text-foreground">
                    {emissions.foodCO2.toFixed(1)} kg CO₂
                  </span>
                </div>
                {emissions.projectSharedTravelCO2 > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("results.project-shared-travel")}
                    </span>
                    <span className="font-semibold text-foreground">
                      {emissions.projectSharedTravelCO2.toFixed(1)} kg CO₂
                    </span>
                  </div>
                )}
                <div className="border-t border-teal-500/30 pt-3">
                  <div className="flex justify-between text-lg sm:text-xl">
                    <span className="font-bold text-foreground">
                      {t("results.total")}
                    </span>
                    <span className="font-bold text-teal-400">
                      {emissions.totalCO2.toFixed(1)} kg CO₂
                    </span>
                  </div>
                </div>
              </div>
              <p className="pt-2 text-center text-xs text-muted-foreground sm:text-sm">
                {t("results.console-note")}
              </p>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
