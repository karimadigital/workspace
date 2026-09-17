// Shared types for the Opportunities system.
// Used by both the server (store + routes) and the React dashboard.

export type OpportunityType =
  | "Paid speaking"
  | "Teaching/class"
  | "Training/RFP"
  | "Gig / Contract work"
  | "Partnership/Sponsorship"
  | "Award/Recognition"
  | "Shot (warm-adjacent)";

export type DoorType =
  | "Application"
  | "Nomination"
  | "CFP"
  | "Booking"
  | "Partnership program"
  | "Warm-adjacent approach";

export type Pays =
  | "Paid"
  | "Fee + travel"
  | "Rev-share/affiliate"
  | "Authority/visibility"
  | "Exposure only"
  | "Unknown";

export type DeadlineType = "Fixed" | "Rolling" | "Not announced";

export type VirtualInPerson = "Virtual" | "In-person" | "Hybrid" | "Unknown";

// Karima-owned pipeline decision.
export type Status =
  | "To review"
  | "Pitching"
  | "Applying"
  | "Submitted"
  | "Won"
  | "Passed";

// Checker-owned verification state.
export type Health =
  | "Verified"
  | "Expiring soon"
  | "Changed"
  | "Unclear"
  | "Expired"
  | "Link dead"
  | "Unchecked";

export const STATUS_VALUES: Status[] = [
  "To review",
  "Pitching",
  "Applying",
  "Submitted",
  "Won",
  "Passed",
];

export const HEALTH_VALUES: Health[] = [
  "Verified",
  "Expiring soon",
  "Changed",
  "Unclear",
  "Expired",
  "Link dead",
  "Unchecked",
];

export interface Opportunity {
  id: string;
  opportunity: string; // title
  organizer: string;
  opportunityType: OpportunityType;
  format: string;
  opportunityUrl: string;
  applicationUrl: string;
  doorType: DoorType | "";
  evidenceUrl: string;
  audienceIndustry: string;
  location: string;
  virtualInPerson: VirtualInPerson;
  pays: Pays;
  compensation: string;
  costToApply: string;
  deadline: string; // ISO date only, never "Rolling"
  deadlineType: DeadlineType;
  deadlineNote: string;
  eventDate: string; // ISO date, separate from deadline
  cycleYear: string;
  // 30-day money lens
  timeToMoneyDays: number | null;
  revenuePath: string;
  opportunityScore: number | null;
  // Shot tier
  warmLink: string; // required for Shot
  authorityBasis: string; // required for Shot
  whyItFits: string;
  // Ownership-scoped
  status: Status; // user only
  health: Health; // checker only
  healthReason: string;
  // Draft
  draftId: string | null;
  draftScore: number | null;
  draftFlag: string; // e.g. "needs your eyes"
  // Timestamps
  firstSeen: string;
  lastChecked: string;
  lastSeenOpen: string;
  canonicalKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Criteria {
  id: string;
  seeded: boolean;
  topics: string;
  typesOn: OpportunityType[];
  shotTierOn: boolean;
  shotSizeThreshold: string;
  industrySeed: string;
  standingTerritory: string;
  locationWeighting: string;
  payPosture: string;
  designNote: string; // Human Design context, drives the shot tier
  updatedAt: string;
}

export interface Draft {
  id: string;
  opportunityId: string;
  applicationUrl: string;
  body: string; // question-by-question draft
  score: number | null;
  scoreNotes: string; // per-dimension notes
  flag: string; // "needs your eyes" or ""
  passes: number;
  createdAt: string;
}

export type RunType = "Finder" | "Checker";
export type RunOutcome = "Succeeded" | "Partial" | "Failed" | "No finds";

export interface Run {
  id: string;
  runType: RunType;
  startedAt: string;
  finishedAt: string;
  huntersAttempted: number;
  countNew: number;
  countDuplicates: number;
  countUpdated: number;
  countRejected: number;
  countExpiredChanged: number;
  errors: string;
  outcome: RunOutcome;
  notes: string;
}

export interface DashboardState {
  opportunities: Opportunity[];
  criteria: Criteria | null;
  runs: Run[];
  needsInterview: boolean;
  generatedAt: string;
}
