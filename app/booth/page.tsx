import { isBooth } from "@/lib/auth";
import BoothClient from "./BoothClient";
import Login from "./Login";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booth · Solanafaces", robots: { index: false } };

export default async function BoothPage() {
  return (await isBooth()) ? <BoothClient /> : <Login />;
}
