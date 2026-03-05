import { login, signup } from "./actions";
import LoginPage from "@/components/pages/login/LoginPage";

export default function Login() {
  return <LoginPage login={login} signup={signup} />;
}
