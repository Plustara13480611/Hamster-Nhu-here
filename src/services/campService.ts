import type { Camp, AdListing } from '../types/models';
import { mockCamps } from '../data/mockData';

const LOCAL_CUSTOM_CAMPS_KEY = 'sp_custom_camps';
const LOCAL_ACTIVE_ADS_KEY = 'sp_active_sponsored_ads';

/**
 * Get all camps: built-in mock camps + any custom camps created by organizers
 */
export function getSystemCamps(): Camp[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_CAMPS_KEY);
    if (!raw) return mockCamps;
    const custom: any[] = JSON.parse(raw);
    const parsedCustom: Camp[] = custom.map(c => ({
      ...c,
      startDate: new Date(c.startDate),
      endDate: new Date(c.endDate),
      applicationDeadline: new Date(c.applicationDeadline),
      createdAt: new Date(c.createdAt),
    }));

    // Merge: custom camps first (so they are fresh!), followed by default camps
    const customIds = new Set(parsedCustom.map(c => c.id));
    const defaults = mockCamps.filter(c => !customIds.has(c.id));
    return [...parsedCustom, ...defaults];
  } catch (err) {
    console.warn('Could not load custom camps from localStorage:', err);
    return mockCamps;
  }
}

/**
 * Save a newly created camp by an organizer
 */
export function saveOrganizerCamp(camp: Camp): void {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_CAMPS_KEY);
    const existing: Camp[] = raw ? JSON.parse(raw) : [];
    // Prepend or update
    const idx = existing.findIndex(c => c.id === camp.id);
    if (idx >= 0) {
      existing[idx] = camp;
    } else {
      existing.unshift(camp);
    }
    localStorage.setItem(LOCAL_CUSTOM_CAMPS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save organizer camp:', err);
  }
}

/**
 * Get all active sponsored ads / promoted spaces
 */
export function getActiveSponsoredAds(): AdListing[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVE_ADS_KEY);
    if (!raw) return [];
    const ads: any[] = JSON.parse(raw);
    return ads.map(a => ({
      ...a,
      startDate: new Date(a.startDate),
      endDate: new Date(a.endDate),
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt),
    }));
  } catch {
    return [];
  }
}

/**
 * Save an active sponsored ad after payment is completed
 */
export function saveActiveSponsoredAd(ad: AdListing): void {
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVE_ADS_KEY);
    const existing: AdListing[] = raw ? JSON.parse(raw) : [];
    const idx = existing.findIndex(a => a.id === ad.id);
    if (idx >= 0) {
      existing[idx] = ad;
    } else {
      existing.unshift(ad);
    }
    localStorage.setItem(LOCAL_ACTIVE_ADS_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save active ad:', err);
  }
}
