import { Prose } from "@/components/Prose";

export default function Privacy() {
  return (
    <Prose title="Privacy">
      <h2>The short version</h2>
      <p>Your journal stays on your device. Mindly&apos;s server only sees your recordings and words for the moment it takes to transcribe them, write your page or reply, and keeps none of it.</p>
      <h2>What&apos;s stored where</h2>
      <ul>
        <li><b>On this device</b>, in your browser&apos;s private storage: your entries, original recordings, transcripts, moods and conversations.</li>
        <li><b>On our server</b>: your account (email, name, a scrambled password or your Google ID) and onboarding answers such as your goals and languages.</li>
      </ul>
      <h2>What&apos;s sent, and to whom</h2>
      <ul>
        <li><b>When you record</b>, the audio goes to our server, where an open Whisper model turns it into text. The file is deleted straight after.</li>
        <li><b>To write your page</b>, the transcript goes to Gemma 4, an open-weight model from Google, run by OpenRouter.</li>
        <li><b>When you reflect or talk</b>, your message and your most relevant entries go to the same model, so it can ground what it says in your own words.</li>
      </ul>
      <p>We don&apos;t sell your data, show ads, or use your journal to train models. Model providers process requests under their own terms.</p>
      <h2>Your control</h2>
      <ul>
        <li>Export everything from Settings at any time.</li>
        <li>Delete a single entry, your whole journal on this device, or your account.</li>
        <li>Clearing your browser&apos;s site data also deletes your journal, so export first if you want to keep it.</li>
      </ul>
      <p className="footnote">Mindly is a prototype built for OPEN//BUILD 2026. App lock is a screen lock; it doesn&apos;t encrypt the stored journal.</p>
    </Prose>
  );
}
