"use client";
// Small shared pieces: top bar, support card, mic-denied sheet copy.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function TopBar({ back, title, right }: { back?: string; title?: ReactNode; right?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="topbar chrome">
      {back ? (
        <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? router.back() : router.push(back))}>
          <Icon name="back" />
        </button>
      ) : <span className="spacer" />}
      <span className="center">{title}</span>
      {right ?? <span className="spacer" />}
    </div>
  );
}

export function SupportCard({ more = true }: { more?: boolean }) {
  return (
    <div className="support" role="note">
      <p className="headline" style={{ margin: 0 }}>You don&apos;t have to carry this alone</p>
      <p className="subhead" style={{ margin: "4px 0 0" }}>If you&apos;re thinking about ending your life or you&apos;re in danger, please reach out now.</p>
      <div className="group" style={{ marginTop: 12 }}>
        <a className="row" href="tel:08000787746"><span className="grow">SURPIN helpline, free and 24 hours</span><span className="detail">0800 078 7746</span></a>
        <a className="row" href="tel:112"><span className="grow">Emergency services</span><span className="detail">112</span></a>
        {more && <Link className="row" href="/support/"><span className="grow">More ways to get support</span><span className="chev"><Icon name="chev" /></span></Link>}
      </div>
    </div>
  );
}

export function MicDenied({ close }: { close: () => void }) {
  return (
    <>
      <h2>Mindly can&apos;t hear you yet</h2>
      <p>Microphone access is blocked for this site. Tap the icon next to the address bar, allow the microphone, then reload.
        On iPhone, go to Settings, then Safari, then Microphone. You can always type instead.</p>
      <div className="alert-actions"><button className="primary" onClick={close}>Got it</button></div>
    </>
  );
}
