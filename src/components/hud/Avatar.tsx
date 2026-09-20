"use client";

export type AvatarState = "asleep" | "idle" | "listening" | "thinking" | "speaking";

const STATE_LABEL: Record<AvatarState, string> = {
  asleep: "Asleep",
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function Avatar({ state, size = 220 }: { state: AvatarState; size?: number }) {
  const ringColor = state === "listening" ? "var(--green)" : "var(--accent)";
  const barCount = 7;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div
        className={`relative flex items-center justify-center ${state !== "asleep" ? "avatar-breathe" : ""}`}
        style={{ width: size, height: size }}
      >
        {/* outer holographic rings */}
        <div
          className="absolute inset-0 rounded-full border avatar-ring-slow"
          style={{
            borderColor: `color-mix(in srgb, ${ringColor} 35%, transparent)`,
            borderWidth: 1,
            opacity: state === "asleep" ? 0.15 : 0.5,
          }}
        />
        <div
          className="absolute rounded-full border avatar-ring-slow-rev"
          style={{
            inset: size * 0.08,
            borderColor: `color-mix(in srgb, ${ringColor} 25%, transparent)`,
            borderWidth: 1,
            borderStyle: "dashed",
            opacity: state === "asleep" ? 0.12 : 0.4,
          }}
        />

        {/* glow */}
        <div
          className={`absolute rounded-full ${state === "thinking" || state === "speaking" ? "avatar-glow" : ""}`}
          style={{
            inset: size * 0.16,
            background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${ringColor} 55%, transparent), transparent 70%)`,
            filter: "blur(6px)",
          }}
        />

        {/* core orb */}
        <div
          className="absolute rounded-full border"
          style={{
            inset: size * 0.2,
            background:
              "radial-gradient(circle at 38% 32%, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 55%, rgba(0,0,0,0.3) 100%)",
            borderColor: "var(--border)",
            boxShadow: `0 0 ${size * 0.18}px color-mix(in srgb, ${ringColor} ${state === "asleep" ? 8 : 30}%, transparent)`,
          }}
        />

        {/* face */}
        <div className="relative flex flex-col items-center gap-[14%]" style={{ width: size * 0.5 }}>
          <div className="flex w-full justify-center gap-[18%]">
            <span
              className="avatar-eye block rounded-full"
              style={{
                width: size * 0.09,
                height: size * 0.09,
                background: ringColor,
                opacity: state === "asleep" ? 0.25 : 0.95,
                boxShadow: state === "asleep" ? "none" : `0 0 10px color-mix(in srgb, ${ringColor} 70%, transparent)`,
              }}
            />
            <span
              className="avatar-eye block rounded-full"
              style={{
                width: size * 0.09,
                height: size * 0.09,
                background: ringColor,
                opacity: state === "asleep" ? 0.25 : 0.95,
                boxShadow: state === "asleep" ? "none" : `0 0 10px color-mix(in srgb, ${ringColor} 70%, transparent)`,
                animationDelay: "0.15s",
              }}
            />
          </div>

          {/* mouth: waveform bars when speaking/listening, flat line otherwise */}
          <div className="flex items-end justify-center gap-[6%]" style={{ height: size * 0.11 }}>
            {Array.from({ length: barCount }).map((_, i) => (
              <span
                key={i}
                className={`block rounded-full ${state === "speaking" || state === "listening" ? "avatar-bar" : ""}`}
                style={{
                  width: size * 0.018,
                  height: "100%",
                  background: state === "asleep" ? "var(--muted)" : ringColor,
                  opacity: state === "speaking" ? 0.95 : state === "listening" ? 0.7 : 0.35,
                  animationDelay: `${i * 0.07}s`,
                  animationDuration: state === "speaking" ? "0.55s" : "1.1s",
                  transform: state === "speaking" || state === "listening" ? undefined : "scaleY(0.15)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="text-[10px] font-bold uppercase tracking-[2.5px]"
        style={{ color: state === "asleep" ? "var(--muted)" : ringColor }}
      >
        {STATE_LABEL[state]}
      </div>
    </div>
  );
}
