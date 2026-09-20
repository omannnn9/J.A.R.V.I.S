"use client";

import { HeadModel } from "./HeadModel";
import type { AvatarState } from "@/lib/avatarState";

const STATE_LABEL: Record<AvatarState, string> = {
  asleep: "Asleep",
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function CenterStage({ state }: { state: AvatarState }) {
  const color = state === "listening" ? "var(--green)" : state === "asleep" ? "var(--muted)" : "var(--accent)";
  const bars = 42;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-2 sm:gap-3 sm:py-4">
      {/* Mobile gets a much smaller head — the phone's scarce vertical space
          belongs to the conversation and the command bar, not a decorative
          centerpiece. It scales up fast from sm: onward where there's room
          to spare. */}
      <div className="h-[170px] w-full max-w-[380px] sm:h-[440px] sm:max-w-[800px] md:h-[560px] md:max-w-[900px] lg:h-[680px] lg:max-w-[980px] xl:h-[760px] xl:max-w-[1080px]">
        <HeadModel state={state} />
      </div>

      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[3px] sm:text-[13px]" style={{ color }}>
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: color, animation: state !== "asleep" ? "blink-dot 1.6s infinite" : undefined }}
        />
        {STATE_LABEL[state]}
      </div>

      <div className="hidden h-4 w-full max-w-[420px] items-end justify-center gap-[3px] sm:flex">
        {Array.from({ length: bars }).map((_, i) => {
          const active = state === "speaking" || state === "listening";
          return (
            <span
              key={i}
              className={active ? "avatar-bar" : ""}
              style={{
                width: 2,
                height: "100%",
                background: color,
                opacity: active ? 0.8 : 0.25,
                animationDelay: `${(i % 9) * 0.06}s`,
                animationDuration: state === "speaking" ? "0.5s" : "1.1s",
                transform: active ? undefined : "scaleY(0.15)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
