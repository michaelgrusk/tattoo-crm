import { Suspense } from "react";
import { PortfolioView } from "./_components/portfolio-view";

export default function PortfolioPage() {
  return (
    <Suspense>
      <PortfolioView />
    </Suspense>
  );
}
