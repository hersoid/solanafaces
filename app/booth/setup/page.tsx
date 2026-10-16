import { isBooth } from "@/lib/auth";
import Login from "../Login";
import SetupClient from "./SetupClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup · Solanafaces", robots: { index: false } };

export default async function SetupPage() {
  return (await isBooth()) ? <SetupClient /> : <Login />;
}
