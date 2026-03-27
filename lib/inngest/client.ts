import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "needlebook",
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev: process.env.INNGEST_DEV === "1",
});

// ─── Event types ───────────────────────────────────────────────────────────────

export type AppointmentScheduledEvent = {
  name: "needlebook/appointment.scheduled";
  data: {
    appointment_id: string;
    user_id: string;
    client_name: string;
    client_email: string;
    client_phone?: string; // E.164 format, e.g. +14155552671
    appointment_date: string; // YYYY-MM-DD
    appointment_time: string; // HH:MM:SS
    appointment_type: string;
    studio_name: string;
  };
};

export type Events = {
  "needlebook/appointment.scheduled": AppointmentScheduledEvent;
};
