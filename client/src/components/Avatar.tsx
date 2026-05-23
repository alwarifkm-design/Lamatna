const COLORS = [
  "#1B2A4A",
  "#C9A227",
  "#C67B5C",
  "#2A3F6B",
  "#5B8A72",
  "#8B5A7A",
  "#4A7C9B",
  "#6B5B4A",
];

const EMOJI = ["😊", "🌟", "🎯", "🎮", "📚", "⚽", "🎨", "🚀"];

interface AvatarProps {
  index: number;
  size?: number;
}

export function Avatar({ index, size = 56 }: AvatarProps) {
  const i = index % 8;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: COLORS[i],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {EMOJI[i]}
    </div>
  );
}
