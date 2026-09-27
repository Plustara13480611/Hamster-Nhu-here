/**
 * Firestore service layer for AdListings
 *
 * All Firestore operations for the Organizer Ad system.
 * Abstracts the Firebase SDK so components stay clean and testable.
 *
 * Collection structure:
 *   adListings/{adId}
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AdListing, AdListingForm, AdPackage, AdStatus } from '../types/models';
import { AD_PACKAGES } from '../types/models';

const ADS_COLLECTION = 'adListings';

// ─── Timestamp helpers ───────────────────────────────────────────────────────

function tsToDate(ts: unknown): Date {
  if (ts instanceof Timestamp) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts as string);
}

function adFromFirestore(id: string, data: Record<string, unknown>): AdListing {
  return {
    id,
    organizerId:    data.organizerId as string,
    organizerName:  data.organizerName as string,
    packageId:      data.packageId as string,
    packageName:    data.packageName as string,
    placement:      data.placement as AdListing['placement'],
    title:          data.title as string,
    description:    data.description as string,
    imageUrl:       data.imageUrl as string,
    targetUrl:      data.targetUrl as string,
    ctaText:        data.ctaText as string,
    startDate:      tsToDate(data.startDate),
    endDate:        tsToDate(data.endDate),
    status:         data.status as AdStatus,
    rejectionReason: data.rejectionReason as string | undefined,
    approvedAt:     data.approvedAt ? tsToDate(data.approvedAt) : undefined,
    approvedBy:     data.approvedBy as string | undefined,
    totalCost:      data.totalCost as number,
    paid:           data.paid as boolean,
    paidAt:         data.paidAt ? tsToDate(data.paidAt) : undefined,
    metrics: {
      impressions: (data.metrics as Record<string, number>)?.impressions ?? 0,
      clicks:      (data.metrics as Record<string, number>)?.clicks ?? 0,
      ctr:         (data.metrics as Record<string, number>)?.ctr ?? 0,
    },
    createdAt:  tsToDate(data.createdAt),
    updatedAt:  tsToDate(data.updatedAt),
  };
}

// ─── Create Ad Listing ───────────────────────────────────────────────────────

const LOCAL_ADS_KEY = 'sp_local_ads';

export async function createAdListing(
  organizerId: string,
  organizerName: string,
  form: AdListingForm,
): Promise<string> {
  const pkg = AD_PACKAGES.find(p => p.id === form.packageId) as AdPackage;
  if (!pkg) throw new Error(`Unknown package: ${form.packageId}`);

  const localId = 'ad_' + Date.now();
  const newAd: AdListing = {
    id: localId,
    organizerId,
    organizerName,
    packageId: pkg.id,
    packageName: pkg.name,
    placement: pkg.placement,
    title: form.title,
    description: form.description,
    imageUrl: form.imageUrl,
    targetUrl: form.targetUrl,
    ctaText: form.ctaText,
    startDate: new Date(form.startDate),
    endDate: new Date(form.endDate),
    status: 'pending' as AdStatus,
    totalCost: pkg.price,
    paid: false,
    metrics: { impressions: 0, clicks: 0, ctr: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Cache locally
  try {
    const key = `${LOCAL_ADS_KEY}_${organizerId}`;
    const cached: AdListing[] = JSON.parse(localStorage.getItem(key) || '[]');
    cached.unshift(newAd);
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (e) {
    console.warn("Could not cache ad locally:", e);
  }

  // Sync to Firestore in background
  addDoc(collection(db, ADS_COLLECTION), {
    organizerId,
    organizerName,
    packageId:   pkg.id,
    packageName: pkg.name,
    placement:   pkg.placement,
    title:       form.title,
    description: form.description,
    imageUrl:    form.imageUrl,
    targetUrl:   form.targetUrl,
    ctaText:     form.ctaText,
    startDate: new Date(form.startDate),
    endDate:   new Date(form.endDate),
    status: 'pending' as AdStatus,
    totalCost: pkg.price,
    paid: false,
    metrics: { impressions: 0, clicks: 0, ctr: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch(err => {
    console.warn("Background Firestore createAdListing skipped:", err);
  });

  return localId;
}

// ─── Fetch Organizer's Ads ────────────────────────────────────────────────────

export async function fetchOrganizerAds(organizerId: string): Promise<AdListing[]> {
  const key = `${LOCAL_ADS_KEY}_${organizerId}`;
  const localData = localStorage.getItem(key);
  const cached: AdListing[] = localData ? JSON.parse(localData).map((a: any) => ({
    ...a,
    startDate: new Date(a.startDate),
    endDate: new Date(a.endDate),
    createdAt: new Date(a.createdAt),
    updatedAt: new Date(a.updatedAt),
  })) : [];

  try {
    const q = query(
      collection(db, ADS_COLLECTION),
      where('organizerId', '==', organizerId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await Promise.race([
      getDocs(q),
      new Promise<null>((r) => setTimeout(() => r(null), 1200))
    ]);
    if (snap && !snap.empty) {
      const ads = snap.docs.map(d => adFromFirestore(d.id, d.data() as Record<string, unknown>));
      localStorage.setItem(key, JSON.stringify(ads));
      return ads;
    }
  } catch (e) {
    console.warn("Firestore fetchOrganizerAds skipped/timeout:", e);
  }
  return cached;
}

// ─── Update Ad (for organizer edits while still pending) ─────────────────────

export async function updateAdListing(
  adId: string,
  updates: Partial<Pick<AdListing, 'title' | 'description' | 'imageUrl' | 'targetUrl' | 'ctaText'>>,
): Promise<void> {
  const ref = doc(db, ADS_COLLECTION, adId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

// ─── Delete Ad (only pending or rejected) ────────────────────────────────────

export async function deleteAdListing(adId: string): Promise<void> {
  await deleteDoc(doc(db, ADS_COLLECTION, adId));
}

// ─── Admin: Update Status ─────────────────────────────────────────────────────
// (จะย้ายไป Admin Dashboard ในภายหลัง)

export async function updateAdStatus(
  adId: string,
  status: AdStatus,
  adminUid: string,
  rejectionReason?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === 'approved') {
    updates.approvedAt = serverTimestamp();
    updates.approvedBy = adminUid;
  }
  if (status === 'rejected' && rejectionReason) {
    updates.rejectionReason = rejectionReason;
  }
  await updateDoc(doc(db, ADS_COLLECTION, adId), updates);
}
