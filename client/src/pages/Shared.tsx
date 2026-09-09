import React from "react";
import { useRoute } from "wouter";
import { CalendarDays, Lock as LockIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { MEETING_ROUTES } from "@shared/routes";
import { MeetingPage } from "./MeetingPage";

/**
 * A meeting page handed to someone outside the workspace.
 *
 * The token in the address is the whole credential, and it names exactly one
 * meeting: there is no list behind this page and no id to substitute, so a
 * link is a way into one meeting and not a way into the workspace.
 *
 * Everything here is read-only. The stage is the same component the organiser
 * presents from, in its read-only mode, so a shared page cannot drift away
 * from the page it is a copy of.
 */
export default function Shared() {
  const [, params] = useRoute(MEETING_ROUTES.shared);
  const token = params?.token ?? "";

  const query = trpc.meetings.shared.useQuery(
    { token },
    {
      enabled: token.length > 0,
      retry: false,
      // Nothing to re-fetch for: the page is a snapshot someone was sent.
      refetchOnWindowFocus: false,
    }
  );

  if (query.isLoading) {
    return (
      <div dir="rtl" className="state-screen">
        <div className="state-card">
          <div className="loading-orb" />
          <h2>جارٍ التحميل</h2>
        </div>
      </div>
    );
  }

  if (query.error || !query.data) {
    // FORBIDDEN is the expired link; anything else is a link that never was.
    const expired = query.error?.data?.code === "FORBIDDEN";
    return (
      <div dir="rtl" className="state-screen">
        <div className="state-card">
          {expired ? <CalendarDays size={30} /> : <LockIcon size={30} />}
          <h2>{expired ? "انتهت صلاحية الرابط" : "رابط غير صالح"}</h2>
          <p>
            {expired
              ? "هذا الرابط كان لاجتماع مضى. اطلب من صاحب الاجتماع رابطًا جديدًا."
              : "تأكد من نسخ الرابط كاملًا، أو اطلب رابطًا جديدًا."}
          </p>
        </div>
      </div>
    );
  }

  return <MeetingPage meeting={query.data.meeting} language="ar" readOnly />;
}
