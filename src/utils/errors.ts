// Turns the database's error codes into messages a student can act on.
const MESSAGES: Record<string, string> = {
  not_signed_in: 'Please sign in again',
  account_suspended: 'Your account is suspended. Contact the warden',
  hostel_residents_only: "This hall is only for its residents",
  hostel_set_by_roster: "Your hostel comes from the warden's resident list",
  not_a_hostel: 'Pick a hostel, not the library',
  table_not_found: 'That table no longer exists',
  table_not_available: 'Someone just took this table',
  table_not_occupied: 'You can only queue for a table someone is using',
  table_not_on_break: "That table's owner isn't on a break",
  table_already_borrowed: 'Someone is already using this table',
  table_blocked_soon: 'This table is booked for an event soon',
  already_have_a_table: 'You already have a table',
  already_in_a_session: 'You already have an active session',
  already_your_table: 'This is already your table',
  already_in_queue: "You're already in this queue",
  reserve_paused: 'Reserving ahead is paused after missed bookings. You can still scan a free table',
  reservation_not_found: 'That reservation has ended',
  reservation_expired: 'Your reservation ran out',
  not_your_reservation: "That isn't your reservation",
  not_your_session: "That isn't your session",
  session_not_active: 'Your session is not active',
  not_on_break: "You're not on a break",
  no_break_time_left: 'No break time left in this session',
  invalid_reason: 'Something went wrong. Please try again',
  too_many_reports: "You've sent enough reports for today",
  admins_only: 'Only admins can do that',
  cannot_suspend_admin: "Admins can't be suspended",
  end_before_start: 'The end time must be after the start',
  block_in_past: 'That time has already passed',
  unknown_space: 'Unknown hall',
  report_not_found: 'That report no longer exists',
  invalid_status: 'Invalid status',
};

export function friendlyError(e: any, fallback = 'Something went wrong'): string {
  const raw: string = e?.message ?? String(e ?? '');
  if (raw.startsWith('unknown_hostels')) {
    return 'Unknown hostel in the list: ' + raw.replace(/^unknown_hostels:\s*/, '');
  }
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code];
  }
  if (/network|fetch/i.test(raw)) return 'No connection. Check your internet';
  if (/check constraint/i.test(raw)) return 'That value is out of range';
  return raw || fallback;
}
