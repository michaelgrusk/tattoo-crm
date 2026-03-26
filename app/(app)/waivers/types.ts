export type FieldType = "text" | "paragraph" | "yesno" | "checkbox" | "date";

export interface WaiverField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  hasFollowUp?: boolean;
  followUpLabel?: string;
}

export interface WaiverSection {
  id: string;
  title: string;
  fields: WaiverField[];
}

export interface WaiverTemplate {
  id: number;
  created_at: string;
  user_id: string;
  name: string;
  is_active: boolean;
  sections: WaiverSection[];
}

export interface SignedWaiver {
  id: number;
  created_at: string;
  template_id: number;
  client_id: number | null;
  client_name: string;
  client_email: string;
  responses: Record<string, string | boolean>;
  signature_type: string | null;
  signature_data: string | null;
  signed_at: string;
  waiver_templates?: { name: string } | null;
}

export const DEFAULT_SECTIONS: WaiverSection[] = [
  {
    id: "section-default",
    title: "Health & Consent",
    fields: [
      { id: "f-name", label: "Full name", type: "text", required: true },
      { id: "f-dob", label: "Date of birth", type: "date", required: true },
      {
        id: "f-allergy",
        label: "Are you allergic to any inks or metals?",
        type: "yesno",
        required: false,
        hasFollowUp: true,
        followUpLabel: "Please describe your allergies",
      },
      {
        id: "f-skin",
        label: "Do you have any skin conditions?",
        type: "yesno",
        required: false,
        hasFollowUp: true,
        followUpLabel: "Please describe your skin conditions",
      },
      {
        id: "f-meds",
        label: "Are you on any medications that affect healing?",
        type: "yesno",
        required: false,
        hasFollowUp: true,
        followUpLabel: "Please list your medications",
      },
      {
        id: "f-aftercare",
        label: "I have read and agree to follow the aftercare instructions",
        type: "checkbox",
        required: true,
      },
      {
        id: "f-photo",
        label: "I consent to photos/videos being taken of my tattoo for portfolio use",
        type: "checkbox",
        required: false,
      },
    ],
  },
];
