/**
 * SMS адаптер для sms-gate.app (capcom6/android-sms-gateway).
 * Android-устройство с SIM-картой в WG-сети.
 * Endpoint и basic-auth подтягиваются из Ключника (env):
 *   - process.env.SMS_GATEWAY_URL   (например http://10.66.0.9:8080)
 *   - process.env.SMS_GATEWAY_AUTH  (формат "username:password")
 *
 * API: POST {SMS_GATEWAY_URL}/message  с basic auth.
 * Документация: https://docs.sms-gate.app/integration/api/
 *
 * Паттерн скопирован один-в-один из garden-manager-app/src/lib/sms.ts.
 */

interface SmsGatewayResponse {
  id?: string;
  state?: string;
  recipients?: Array<{ phoneNumber: string; state: string; error?: string }>;
  message?: string;
}

export async function sendSms(phone: string, message: string): Promise<void> {
  const url = process.env.SMS_GATEWAY_URL;
  const auth = process.env.SMS_GATEWAY_AUTH;

  if (!url || !auth) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[sms:dev-fallback] ${phone}: ${message}`);
      return;
    }
    throw new Error("SMS provider not configured (SMS_GATEWAY_URL/SMS_GATEWAY_AUTH missing)");
  }

  const basic = Buffer.from(auth, "utf-8").toString("base64");
  const res = await fetch(`${url.replace(/\/$/, "")}/message`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      phoneNumbers: [phone],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SMS gateway HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as SmsGatewayResponse;
  const recipient = data.recipients?.[0];
  if (recipient && recipient.state === "Failed") {
    throw new Error(`SMS send failed for ${phone}: ${recipient.error ?? "unknown"}`);
  }
}
