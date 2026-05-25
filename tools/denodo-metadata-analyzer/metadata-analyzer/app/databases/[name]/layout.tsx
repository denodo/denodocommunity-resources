// Enable dynamic params for client-side routing
export const dynamicParams = true;

// Generate static params - return placeholder for build, actual routing is client-side
export async function generateStaticParams() {
  // Return a placeholder - all actual database navigation happens client-side
  return [{ name: 'index' }];
}

export default function DatabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
