import re

with open('src/pages/OrganizerDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
imports = """import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AdListing,
  AdListingForm,
  AdPackage,
  Camp,
  OrganizerProfile,
} from '../types/models';
import { AD_PACKAGES } from '../types/models';
import { createAdListing, fetchOrganizerAds, deleteAdListing } from '../services/adService';
import { mockCamps } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { auth } from '../config/firebase';"""

content = re.sub(r"import \{ useState, useEffect, useCallback, useRef \} from 'react';.*?import \{ mockCamps \} from '\.\./data/mockData';", imports, content, flags=re.DOTALL)

# 2. Remove MOCK_ORGANIZER and MY_CAMPS globally
content = re.sub(r"// ─── Mock organizer.*?const ALL_CAMPS: Camp\[\] = mockCamps;", "const ALL_CAMPS: Camp[] = mockCamps;", content, flags=re.DOTALL)

# 3. Add profile to OverviewTab
overview_tab_def = """function OverviewTab({ ads, profile }: { ads: AdListing[], profile: OrganizerProfile }) {
  const MY_CAMPS = mockCamps.filter(c => c.organizerId === profile.id);
  const activeAds = ads.filter(a => a.status === 'active').length;"""
content = re.sub(r"function OverviewTab\(\{ ads \}: \{ ads: AdListing\[\] \}\) \{\n  const activeAds = ads.filter\(a => a.status === 'active'\).length;", overview_tab_def, content, flags=re.DOTALL)
content = re.sub(r"ALL_CAMPS\.filter\(c => c\.organizerId !== MOCK_ORGANIZER\.id\)", "ALL_CAMPS.filter(c => c.organizerId !== profile.id)", content)

# 4. Add profile to BuyAdsTab
buy_ads_tab_def = """function BuyAdsTab({ onSuccess, profile }: { onSuccess: () => void, profile: OrganizerProfile }) {"""
content = re.sub(r"function BuyAdsTab\(\{ onSuccess \}: \{ onSuccess: \(\) => void \}\) \{", buy_ads_tab_def, content, flags=re.DOTALL)
content = re.sub(r"await createAdListing\(MOCK_ORGANIZER\.id, MOCK_ORGANIZER\.organizationName, form\);", "await createAdListing(profile.id, profile.organizationName, form);", content)

# 5. Update main component
main_comp = """export default function OrganizerDashboard() {
  const { profile: userProfile } = useAuth();
  const profile = userProfile as OrganizerProfile | null;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [ads, setAds] = useState<AdListing[]>([]);
  const [loadingAds, setLoadingAds] = useState(true);
  const [dark, setDark] = useState(false);

  const loadAds = useCallback(async () => {
    if (!profile) return;
    setLoadingAds(true);
    try {
      const fetched = await fetchOrganizerAds(profile.id);
      setAds(fetched);
    } catch {
      // Firebase not configured yet — use empty state
      setAds([]);
    } finally {
      setLoadingAds(false);
    }
  }, [profile]);

  useEffect(() => { loadAds(); }, [loadAds]);

  const handleDelete = async (adId: string) => {
    if (!confirm('ลบโฆษณานี้ใช่ไหม?')) return;
    try {
      await deleteAdListing(adId);
      setAds(prev => prev.filter(a => a.id !== adId));
    } catch {
      alert('ลบไม่สำเร็จ — ตรวจสอบ Firebase config');
    }
  };

  const toggleDark = () => {
    setDark(d => {
      document.documentElement.classList.toggle('dark', !d);
      return !d;
    });
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const pendingCount = ads.filter(a => a.status === 'pending').length;"""
content = re.sub(r"export default function OrganizerDashboard\(\) \{.*?const pendingCount = ads.filter\(a => a.status === 'pending'\).length;", main_comp, content, flags=re.DOTALL)

# 6. Replace MOCK_ORGANIZER in JSX
content = re.sub(r"MOCK_ORGANIZER\.organizationName", "profile.organizationName", content)

# 7. Add logout button to Sidebar
sidebar_logout = """<button onClick={toggleDark}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
            style={{ color: 'var(--color-muted)' }}>
            <span>{dark ? '☀️' : '🌙'}</span>
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout} className="mt-2 w-full px-3 py-2 text-sm font-bold rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-200">
            Logout
          </button>"""
content = re.sub(r"<button onClick=\{toggleDark\}.*?</button>", sidebar_logout, content, flags=re.DOTALL)

# 8. Update tab content passing profile
content = re.sub(r"<OverviewTab ads=\{ads\} />", "<OverviewTab ads={ads} profile={profile} />", content)
content = re.sub(r"<BuyAdsTab onSuccess=\{\(\) => \{ loadAds\(\); setActiveTab\('my-ads'\); \}\} />", "<BuyAdsTab onSuccess={() => { loadAds(); setActiveTab('my-ads'); }} profile={profile} />", content)


with open('src/pages/OrganizerDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
