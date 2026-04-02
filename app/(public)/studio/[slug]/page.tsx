export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Studio page works — slug: {slug}</div>;
}
