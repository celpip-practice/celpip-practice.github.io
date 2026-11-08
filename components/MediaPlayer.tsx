"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  /** Show native controls (practice mode only, like the official "playbar"). */
  controls?: boolean;
  autoPlay?: boolean;
  onEnded?: () => void;
  label?: string;
}

/** Official-looking "Playing..." audio box. Plays once automatically. */
export function AudioBox({ src, controls, autoPlay = true, onEnded, label }: Props) {
  const ref = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"loading" | "playing" | "ended" | "blocked">("loading");
  const ended = useRef(onEnded);
  ended.current = onEnded;

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    setProgress(0);
    setState("loading");
    if (autoPlay) {
      a.play().then(() => setState("playing")).catch(() => setState("blocked"));
    }
  }, [src, autoPlay]);

  return (
    <div className="media-center">
      <div className="audio-box" data-testid="audio-box">
        <div className="speaker" aria-hidden>🔊</div>
        <div className="meta">
          {state === "ended" ? label ?? "Click \"NEXT\" to continue." : state === "blocked" ? (
            <button className="btn-plain" onClick={() => ref.current?.play().then(() => setState("playing"))}>
              ▶ Play
            </button>
          ) : "Playing..."}
          <div className="bar"><div style={{ width: `${progress * 100}%` }} /></div>
        </div>
      </div>
      <audio
        ref={ref}
        src={src}
        controls={controls}
        preload="auto"
        data-testid="audio"
        onPlay={() => setState("playing")}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration) setProgress(a.currentTime / a.duration);
        }}
        onEnded={() => {
          setState("ended");
          setProgress(1);
          ended.current?.();
        }}
        style={controls ? {} : { display: "none" }}
      />
      {controls && <div className="playbar-note">This playbar will not appear in the official test.</div>}
    </div>
  );
}

export function VideoBox({ src, controls, onEnded }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    ref.current?.play().catch(() => setBlocked(true));
  }, [src]);
  return (
    <div className="media-center video-box">
      <video
        ref={ref}
        src={src}
        controls={controls || blocked}
        playsInline
        data-testid="video"
        onPlay={() => setBlocked(false)}
        onEnded={() => onEnded?.()}
      />
      {controls && <div className="playbar-note">This playbar will not appear in the official test.</div>}
    </div>
  );
}

/** Small inline play button for question audio in review / practice. */
export function MiniAudio({ src }: { src: string }) {
  return <audio src={src} controls preload="none" style={{ height: 32, verticalAlign: "middle" }} />;
}
