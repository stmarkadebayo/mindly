import { SupportCard } from "@/components/Bits";
import { Prose } from "@/components/Prose";

export default function Support() {
  return (
    <Prose title="Get support">
      <SupportCard more={false} />
      <h2>If it&apos;s not an emergency</h2>
      <ul>
        <li>Talk to someone you trust today: a friend, family member or faith leader.</li>
        <li>Your university&apos;s counselling or health centre offers free, confidential support.</li>
        <li>Find more helplines at <a href="https://findahelpline.com/countries/ng" target="_blank" rel="noopener">findahelpline.com</a>.</li>
      </ul>
      <p className="footnote">Mindly can help you put things into words, but it isn&apos;t a replacement for people who can be there with you.</p>
    </Prose>
  );
}
