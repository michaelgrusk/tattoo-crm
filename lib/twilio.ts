import twilio from "twilio";

export function getTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

export const TWILIO_MESSAGING_SERVICE_SID =
  process.env.TWILIO_MESSAGING_SERVICE_SID;
