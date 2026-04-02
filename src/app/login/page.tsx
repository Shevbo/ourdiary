import LoginClient from "@/components/LoginClient";
import { APP_VERSION } from "@/lib/app-version";

export default function LoginPage() {
  return <LoginClient appVersion={APP_VERSION} />;
}
