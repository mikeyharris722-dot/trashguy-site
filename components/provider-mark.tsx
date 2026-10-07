"use client";
import { useState } from "react";
import Image from "next/image";
export default function ProviderMark({
  name,
  src,
  active,
}: {
  name: string;
  src?: string;
  active: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image
      unoptimized
      width={32}
      height={32}
      src={src}
      alt={name + " logo"}
      className={
        "h-6 w-6 object-contain sm:h-8 sm:w-8 " +
        (active ? "opacity-100" : "opacity-60")
      }
      onError={() => setFailed(true)}
    />
  ) : (
    <span aria-label={name} className="text-[10px] font-black text-purple-200">
      {name
        .split(/[ &]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}
