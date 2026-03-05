import LoginPage from "@/components/pages/login/LoginPage";

export default async function Login({ searchParams }) {
  const params = await searchParams;
  const message = params?.message || null;
  return <LoginPage message={message} />;
}
