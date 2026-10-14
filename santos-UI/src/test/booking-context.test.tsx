import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BookingProvider, useBooking } from '@/components/hotel/booking-context';
afterEach(cleanup);
function BookingProbe() {
  const { selected, nights, update } = useBooking();
  return <><output aria-label="Selected room">{selected.id}</output><output aria-label="Stay nights">{nights}</output><button onClick={() => update({ roomId: 'junior-suite', checkIn: '2026-11-20', checkOut: '2026-11-25' })}>Select suite</button></>;
}
describe('shared booking setup regression', () => {
  it('provides selections to booking controls without a missing-context failure', () => {
    render(<BookingProvider><BookingProbe/></BookingProvider>);
    expect(screen.getByLabelText('Selected room').textContent).toBe('deluxe-king');
    fireEvent.click(screen.getByText('Select suite'));
    expect(screen.getByLabelText('Selected room').textContent).toBe('junior-suite');
    expect(screen.getByLabelText('Stay nights').textContent).toBe('5');
  });
});