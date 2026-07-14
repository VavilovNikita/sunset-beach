"use client";

import { useState } from "react";

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    // Wire this up to your own endpoint (e.g. an API route or booking CRM).
    setTimeout(() => setStatus("sent"), 700);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          name="name"
          placeholder="Your name"
          minLength={2}
          required
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <textarea
          name="message"
          placeholder="Message"
          minLength={10}
          required
          rows={4}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream placeholder:text-cream/40 focus:outline-none focus:border-coral resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {status === "sent" ? "Message sent" : status === "sending" ? "Sending…" : "Send a Message"}
      </button>
    </form>
  );
}
