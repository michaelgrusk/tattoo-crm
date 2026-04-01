import { Suspense } from "react";
import { CalendarView } from "./_components/calendar-view";

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
