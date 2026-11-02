export type SegmentStatus = "saved" | "queued" | "transcribing" | "writing" | "done" | "no_speech" | "failed";

/** One recording within an entry. Its audio blob lives in the "audio" store under the same id. */
export interface Segment {
  id: string;
  created: string;
  seconds: number;
  ext: string;
  status: SegmentStatus;
  transcript: string | null;
  language?: string;
  error: string | null;
  dismissed?: boolean;
  /** Recorded in room mode, so the server keeps shakier speech instead of dropping it. */
  room?: boolean;
  /** Which speech engine heard it; "alt" is the alternative engine (NaijaVox). */
  engine?: "alt";
  /** Some of this text was hard to hear; worth a read-through. */
  uncertain?: boolean;
}

/** Something the person said they'd do. Offered once as a prompt; nothing is created until they accept. */
export interface Suggestion {
  id: string;
  kind: "task" | "reminder";
  text: string;
  /** Local date and time, "YYYY-MM-DDTHH:MM", for reminders. */
  when: string | null;
  status: "pending" | "accepted" | "dismissed" | "done";
}

export interface Entry {
  id: string;
  created: string;
  updated: string;
  title: string;
  body: string;
  prompt: string | null;
  mood: number | null;
  segments: Segment[];
  images?: { id: string; name: string }[];
  suggestions?: Suggestion[];
  /** Tasks in other entries that Mindly ticked off because this recording said they were done. Shown with an Undo. */
  completions?: { id: string; entryId: string; text: string; at: string }[];
  /** Part of the example journal, so it can be labelled and removed in one tap. */
  sample?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export interface Chat {
  id: string;
  entryId: string | null;
  created: string;
  updated: string;
  messages: ChatMessage[];
}

export interface Profile {
  goals?: string[];
  languages?: string[];
  speechLanguage?: string;
  onboarded?: boolean;
  consentedAt?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  profile: Profile;
  has_password: boolean;
  google: boolean;
  /** Decided by the server: "pro" during the trial or while paid, otherwise "free". */
  plan: "pro" | "free";
  paid: boolean;
  on_trial: boolean;
  /** Unix seconds. */
  trial_ends: number | null;
  paid_until: number | null;
}
