import React, { useState } from "react";
import { Check, Copy, Link2, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { canShare, shareExpiresOn, shareUrl } from "@shared/meeting-share";
import { fromIsoDate } from "@shared/meeting-date";
import type { MeetingRecord } from "@shared/meeting-store";

/**
 * Issuing and retiring a meeting's read-only link.
 *
 * The link is the credential, so the panel is honest about what it hands over:
 * what a holder can see, and the day it stops working. Both are decided
 * elsewhere — the server derives expiry from the meeting's own date, and
 * toSharedMeeting decides what travels — this only says so out loud.
 */
export default function SharePanel({
  meeting,
  freshToken,
  onShare,
  onUnshare,
  pending,
}: {
  meeting: MeetingRecord;
  /**
   * A token just minted, before the meeting list has been re-read.
   *
   * The mutation returns it, so there is no reason to make someone wait on
   * a full Notion refetch to see the link they just asked for.
   */
  freshToken?: string;
  onShare: () => void;
  onUnshare: () => void;
  pending: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const shareable = canShare(meeting);
  const expiresIso = shareExpiresOn(meeting.date);
  const token = meeting.share || freshToken || "";
  const url = token ? shareUrl(window.location.origin, token) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the field is selectable either way.
      toast.error("تعذّر النسخ. حدّد الرابط وانسخه يدويًا.");
    }
  };

  return (
    <div className="share-panel">
      <div className="share-head">
        <span className="stage-label">
          <Link2 size={14} /> رابط للقراءة فقط
        </span>
      </div>

      {!token ? (
        <>
          <p className="share-note">
            رابط يفتح صفحة هذا الاجتماع وحده، بلا كلمة مرور ولا وصول إلى بقية
            اجتماعاتك. من يفتحه يقرأ ولا يعدّل، ولا تظهر له ملاحظاتك التحضيرية.
          </p>
          <button
            className="share-action"
            onClick={onShare}
            disabled={pending || !shareable}
          >
            {pending ? <Loader2 size={15} className="spin" /> : <Link2 size={15} />}
            إنشاء الرابط
          </button>
          {!shareable && (
            <p className="share-warning">
              أضف تاريخ الاجتماع أولًا — صلاحية الرابط تُحسب منه.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="share-link">
            <input value={url} readOnly onFocus={event => event.target.select()} />
            <button onClick={copy} aria-label="نسخ الرابط">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <p className="share-note">
            {expiresIso
              ? `يعمل حتى نهاية ${fromIsoDate(expiresIso)}، ثم يتوقف من تلقاء نفسه.`
              : "يتوقف بعد الاجتماع بيوم."}
          </p>
          <button className="share-action danger" onClick={onUnshare} disabled={pending}>
            {pending ? <Loader2 size={15} className="spin" /> : <ShieldOff size={15} />}
            إيقاف المشاركة
          </button>
        </>
      )}
    </div>
  );
}
