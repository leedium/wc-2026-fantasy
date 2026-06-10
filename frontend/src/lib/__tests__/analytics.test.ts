/**
 * @jest-environment jsdom
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the GTM bridge so we can assert whether trackEvent forwards to it.
const sendGTMEvent = jest.fn();
jest.mock('@next/third-parties/google', () => ({
  sendGTMEvent: (...args: unknown[]) => sendGTMEvent(...args),
}));

import { ANALYTICS_EVENTS, trackEvent } from '../analytics';

describe('trackEvent', () => {
  const original = process.env.NEXT_PUBLIC_GTM_ID;

  beforeEach(() => {
    sendGTMEvent.mockClear();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GTM_ID = original;
  });

  it('is a no-op when NEXT_PUBLIC_GTM_ID is not configured', () => {
    delete process.env.NEXT_PUBLIC_GTM_ID;
    trackEvent(ANALYTICS_EVENTS.login);
    expect(sendGTMEvent).not.toHaveBeenCalled();
  });

  it('forwards the event and params to the dataLayer when GTM is configured', () => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST123';
    trackEvent(ANALYTICS_EVENTS.referralShared, { method: 'link' });
    expect(sendGTMEvent).toHaveBeenCalledWith({
      event: 'referral_shared',
      method: 'link',
    });
  });
});
