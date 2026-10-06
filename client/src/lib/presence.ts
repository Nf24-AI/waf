import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/**
 * كم واحداً يركّز الآن.
 *
 * حضورٌ لحظيّ عبر قناة Supabase لا جدول: لا شيء يُخزَّن ولا اسم يُرسَل، كل
 * متصفّح يقول «أنا هنا، وأركّز أو لا» ويختفي حين يُغلق. وبلا Supabase يُعدّ
 * هذا المتصفّح وحده.
 */
export function useStudyingNow(studying: boolean): number {
  const [count, setCount] = useState(0);
  const channel = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const latest = useRef(studying);
  latest.current = studying;

  useEffect(() => {
    if (!supabase) return;
    const room = supabase.channel("waf-focus-room", { config: { presence: { key: crypto.randomUUID() } } });
    room
      .on("presence", { event: "sync" }, () => {
        const state = room.presenceState<{ studying: boolean }>();
        setCount(Object.values(state).filter(entries => entries.some(entry => entry.studying)).length);
      })
      .subscribe(status => {
        if (status === "SUBSCRIBED") void room.track({ studying: latest.current }).catch(() => {});
      });
    channel.current = room;
    return () => {
      channel.current = null;
      void supabase!.removeChannel(room);
    };
  }, []);

  useEffect(() => {
    void channel.current?.track({ studying }).catch(() => {});
  }, [studying]);

  return supabase ? count : studying ? 1 : 0;
}
