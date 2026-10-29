import Link from "next/link";
import { Prose } from "@/components/Prose";

export default function Terms() {
  return (
    <Prose title="Terms and disclaimer">
      <h2>Mindly isn&apos;t therapy</h2>
      <p>Mindly is a journal with an AI companion. It isn&apos;t a medical device or a mental-health service. It can&apos;t diagnose, treat or monitor anything, and it can&apos;t respond to emergencies.</p>
      <p>If you&apos;re in danger or thinking about harming yourself, contact emergency services (112 in Nigeria) or a crisis line now. See <Link href="/support/">Get support</Link>.</p>
      <h2>AI can be wrong</h2>
      <p>Transcripts, written pages and reflections come from AI models and can contain mistakes. You can edit every page, and your original recordings are kept so you can check.</p>
      <h2>Record only yourself</h2>
      <p>Mindly is built for your own voice. Don&apos;t record or transcribe other people without their consent. The speech model&apos;s authors advise against it, and you agree to follow that.</p>
      <h2>Open models and their licences</h2>
      <p>Mindly uses Whisper large-v3-turbo (MIT licence) for speech and Google Gemma 4 (Apache 2.0, subject to Google&apos;s Gemma terms of use) for writing and chat. By using Mindly you agree to use these models only within those licences and their usage restrictions, including not using them for unlawful or harmful purposes.</p>
      <h2>Your content</h2>
      <p>What you write and record is yours. Use Mindly lawfully and don&apos;t use it to harm others.</p>
      <h2>Prototype</h2>
      <p>Mindly is an early prototype offered as-is, without guarantees of availability or data durability. Export your journal regularly.</p>
    </Prose>
  );
}
