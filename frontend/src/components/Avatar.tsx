import { initials } from "@/lib/utils";

interface Props {
  name: string;
  color: string;
  size?: number;
  online?: boolean;
  isGroup?: boolean;
}

/** Circular initials avatar with an optional online presence dot. */
export default function Avatar({ name, color, size = 44, online, isGroup }: Props) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white select-none"
        style={{ background: color, fontSize: size * 0.4 }}
      >
        {isGroup ? (
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
        ) : (
          initials(name)
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-panel" />
      )}
    </div>
  );
}
