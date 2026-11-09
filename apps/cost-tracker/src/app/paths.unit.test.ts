import { expect, it } from "vitest";

import {
  participationPath,
  partnershipClaimPath,
  partnershipClaimReviewPath,
  partnershipParticipantsPath,
  partnershipPath,
  projectParticipantsPath,
  projectPath,
} from "@/app/paths";

it("builds the Project paths", () => {
  expect(projectPath("project-1")).toBe("/projects/project-1");
  expect(projectParticipantsPath("project-1")).toBe(
    "/projects/project-1/participants",
  );
});

it("builds the Partnership paths", () => {
  expect(partnershipPath("partnership-1")).toBe("/partnerships/partnership-1");
  expect(partnershipParticipantsPath("partnership-1")).toBe(
    "/partnerships/partnership-1/participants",
  );
  expect(participationPath("partnership-1", "participation-1")).toBe(
    "/partnerships/partnership-1/participants/participation-1",
  );
  expect(partnershipClaimPath("partnership-1")).toBe(
    "/partnerships/partnership-1/claim",
  );
  expect(partnershipClaimReviewPath("partnership-1")).toBe(
    "/partnerships/partnership-1/claim/review",
  );
});

it("encodes every id segment", () => {
  expect(projectPath("a/b?c#d")).toBe("/projects/a%2Fb%3Fc%23d");
  expect(participationPath("p/1", "q 2")).toBe(
    "/partnerships/p%2F1/participants/q%202",
  );
});
