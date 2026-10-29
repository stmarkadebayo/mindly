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
}
