"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return (
    <div className="row small">
      <span className="spinner" aria-hidden="true" /> Checking again every {seconds} seconds
    </div>
  );
}
