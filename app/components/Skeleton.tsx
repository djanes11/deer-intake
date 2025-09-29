export default function Skeleton({ w = '100%', h = 14, radius = 8 }: { w?: string|number; h?: number; radius?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: radius }} />;
}
