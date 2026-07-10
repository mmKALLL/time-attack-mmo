import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OfferPanel } from '../OfferPanel';
import { orList } from '../AdvancementPanel';

afterEach(cleanup);

describe('orList (natural comma/or list)', () => {
  it('formats 0/1/2/3 names naturally', () => {
    expect(orList([])).toBe('');
    expect(orList(['Fighter'])).toBe('Fighter');
    expect(orList(['Fighter', 'Archer'])).toBe('Fighter or Archer');
    expect(orList(['Fighter', 'Archer', 'Magician'])).toBe('Fighter, Archer, or Magician');
    expect(orList(['Fighter', 'Archer', 'Magician', 'Rogue'])).toBe('Fighter, Archer, Magician, or Rogue');
  });
});

describe('OfferPanel keyboard + selection', () => {
  const opts = [
    { key: 'fighter', label: 'Fighter', sublabel: 'Requires Lv 10' },
    { key: 'archer', label: 'Archer', sublabel: 'Requires Lv 10', disabled: true, disabledReason: 'Reach level 10 first' },
  ];

  it('Enter, Space, and Escape all DECLINE (accept is click-only, never a key)', () => {
    for (const key of ['Enter', ' ', 'Escape']) {
      const onAccept = vi.fn();
      const onDecline = vi.fn();
      render(<OfferPanel title="Guild" body="body" options={opts} onAccept={onAccept} onDecline={onDecline} />);
      fireEvent.keyDown(window, { key });
      expect(onDecline).toHaveBeenCalledTimes(1);
      expect(onAccept).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('clicking the Accept button accepts the currently-selected (first enabled) option', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(<OfferPanel title="Guild" body="body" options={opts} acceptLabel="Advance" onAccept={onAccept} onDecline={onDecline} />);
    fireEvent.click(screen.getByText('Advance'));
    expect(onAccept).toHaveBeenCalledWith('fighter');
    expect(onDecline).not.toHaveBeenCalled();
  });

  it('does not accept via keyboard even when an enabled option is selected', () => {
    const onAccept = vi.fn();
    render(<OfferPanel title="Guild" body="body" options={opts} onAccept={onAccept} onDecline={() => {}} />);
    // Arrow-selection still moves the highlight, but no key accepts.
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('with no options, keys only decline (no plain-confirm on Enter)', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    render(<OfferPanel title="Guild" body="Nothing on offer" onAccept={onAccept} onDecline={onDecline} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAccept).not.toHaveBeenCalled();
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('renders each option label', () => {
    render(<OfferPanel title="Guild" body="body" options={opts} onAccept={() => {}} onDecline={() => {}} />);
    expect(screen.getByText('Fighter')).toBeInTheDocument();
    expect(screen.getByText('Archer')).toBeInTheDocument();
  });
});
