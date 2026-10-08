"use client";
import { useState } from "react";
import Image from "next/image";
import SlotSearch, { type SlotOption } from "./slot-search";
import { providerName } from "@/lib/slot-providers";
export default function CatalogueLookup() {
  const [slot, setSlot] = useState<SlotOption | null>(null),
    [message, setMessage] = useState("");
  return (
    <section
      className="catalogue-lookup"
      aria-label="Search the RouloBets slot collection"
    >
      <h2>Find a slot</h2>
      <p>
        Search the full RouloBets collection, or use the provider selection
        below for a random pick.
      </p>
      <SlotSearch
        selected={slot}
        onSelect={(s) => {
          setSlot(s);
          setMessage("");
        }}
        label="Search all RouloBets slots"
      />
      {slot && (
        <div className="lookup-selected">
          {slot.artwork_url && (
            <Image
              unoptimized
              alt=""
              src={slot.artwork_url}
              width={64}
              height={64}
            />
          )}
          <div>
            <h3>{slot.name}</h3>
            <p>{providerName(slot.provider, slot.producer)}</p>
            <label>
              Use this command in Twitch chat
              <input
                readOnly
                aria-label="Twitch slot call command"
                value={"!slot " + slot.name}
              />
            </label>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText("!slot " + slot.name);
                setMessage(
                  "Slot call copied. Paste it in Twitch chat when calls are open.",
                );
              } catch {
                setMessage(
                  "Copy is unavailable. Select and copy the command above.",
                );
              }
            }}
          >
            Copy slot call
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="search-selected">
          {message}
        </p>
      )}
    </section>
  );
}
