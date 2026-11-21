import React from 'react';
import { View } from 'react-native';
import { useStore } from '../state/store';
import { announcementsFor } from '../state/selectors';
import { formatClock } from '../utils/time';
import { Banner } from './Banner';

/** Account status (suspended / reserving paused) and announcements for a space. */
export function StatusBanners({ spaceId }: { spaceId?: string | null }) {
  const { state } = useStore();
  const st = state.myStatus;
  const notes = announcementsFor(state, spaceId);

  const until = (iso: string) => {
    const d = new Date(iso);
    if (d.getFullYear() > 9000) return 'until an admin reinstates it';
    const sameDay = d.toDateString() === new Date().toDateString();
    return `until ${sameDay ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ', '}${formatClock(d)}`;
  };

  return (
    <View>
      {st?.suspended_until ? (
        <Banner
          tone="danger"
          title={`Account suspended ${until(st.suspended_until)}`}
          body={st.suspended_reason ? `Reason: ${st.suspended_reason}` : 'Contact the warden or library desk.'}
        />
      ) : null}
      {!st?.suspended_until && st?.reserve_paused_until ? (
        <Banner
          tone="warning"
          title={`Reserving ahead is paused ${until(st.reserve_paused_until)}`}
          body="After several missed bookings or overrun breaks. You can still scan a free table's QR to check in."
        />
      ) : null}
      {notes.map(a => (
        <Banner key={a.id} title={a.title} body={a.body || undefined} />
      ))}
    </View>
  );
}
