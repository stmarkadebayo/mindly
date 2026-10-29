"use client";
import Link from "next/link";
import { Mark, Sparkles } from "@/components/Hand";
import { Orb } from "@/components/Orb";

export default function Welcome() {
  return (
    <main className="welcome">
      <div className="brand"><Mark size={26} />Mindly</div>
      <div className="stage">
        <div className="orb"><Orb idle={1.7} /></div>
        <Sparkles className="sparkles" />
      </div>
      <h1 className="large-title">Talk it out.<br />Mindly keeps the page.</h1>
      <p className="subhead" style={{ margin: 0 }}>
        A private journal you speak to. Say what&apos;s on your mind and get back a clear page in your own words.
      </p>
      <div className="actions">
        <Link className="btn btn-primary btn-block" href="/auth/?mode=signup">Get started</Link>
        <Link className="btn btn-plain btn-block" href="/auth/?mode=signin">I already have an account</Link>
      </div>
    </main>
  );
}
