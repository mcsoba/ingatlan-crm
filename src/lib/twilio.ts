import twilioLib from "twilio";

let twilioInstance: ReturnType<typeof twilioLib> | null = null;

// Lazy, same reason as getStripe()/getResend() — constructing with missing
// credentials would throw immediately at module-import time.
function getTwilioClient(): ReturnType<typeof twilioLib> {
  if (!twilioInstance) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !authToken) {
      throw new Error(
        "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN nincs beállítva — add meg a .env.local-ban az SMS-küldéshez",
      );
    }
    twilioInstance = twilioLib(sid, authToken);
  }
  return twilioInstance;
}

export async function sendSms(to: string, body: string) {
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) {
    throw new Error(
      "TWILIO_FROM_NUMBER nincs beállítva — add meg a .env.local-ban az SMS-küldéshez",
    );
  }
  return getTwilioClient().messages.create({ to, from, body });
}
