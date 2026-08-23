'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SITE, phoneHref } from '@/lib/config';
import {
  confirmationInputMode,
  identifierSettingsFromPublicCopy,
  normalizeConfirmationInput,
  normalizeTagInput,
  tagInputMode,
} from '@/lib/identifiers';

type LookupResult = {
  ok?: boolean;
  notFound?: boolean;
  error?: string;
  customer?: string;
  tag?: string;
  confirmation?: string;
  dropoffDate?: string;
  status?: string;
  tracks?: {
    webbsStatus?: string;
    specialtyStatus?: string;
    capeStatus?: string;
  };
  priceProcessing?: number | string;
  priceSpecialty?: number | string;
  priceTotal?: number | string;
  amountPaidProcessing?: number | string;
  amountPaidSpecialty?: number | string;
  paidProcessing?: boolean | string;
  paidSpecialty?: boolean | string;
  paid?: boolean | string;
  intakeLink?: string;
  updatedAt?: string;
  matches?: LookupResult[];
};

type StatusTone = 'ready' | 'progress' | 'hold' | 'unknown';

type TrackSummary = {
  key: string;
  label: string;
  value?: string;
  tone: StatusTone;
  message: string;
};

type PaymentCardProps = {
  label: string;
  amount?: number;
  paid?: boolean;
  owed?: number;
};

type ReadyPaymentLine = {
  label: string;
  due: number;
};

type PublicBrandingState = {
  name: string;
  address: string;
  phoneDisplay: string;
  phoneHref: string;
  email: string;
  mapsUrl: string;
  webbsEnabled: boolean;
  specialtyEnabled: boolean;
};

type PublicCopyState = {
  statusIntro: string;
  statusBestWay: string;
  statusLookupHelp: string;
  confirmationSearchHelp: string;
  confirmationLabel: string;
  confirmationPlaceholder: string;
  tagLabel: string;
  tagPlaceholder: string;
  confirmationValidation: 'exact_13' | 'digits_only' | 'freeform';
  tagFormat: 'digits_only' | 'letters_numbers';
  tagSearchHelp: string;
  callBeforePickup: boolean;
};

const DEFAULT_STATUS_COPY: PublicCopyState = {
  statusIntro:
    'Use your confirmation number, or use your phone number and last name if you do not have it handy. This page updates as your order moves through the shop.',
  statusBestWay:
    'Confirmation number works best before staff assign the permanent tag. If you do not have it handy, use the phone number from intake and the customer last name.',
  statusLookupHelp:
    'Most customers should start with the confirmation number. Phone number + last name is the best backup if you chose phone calls or do not have the tag yet.',
  confirmationSearchHelp:
    'Best for most customers. Use the number from your intake or state harvest/check-in.',
  confirmationLabel: 'Confirmation #',
  confirmationPlaceholder: 'State confirmation #',
  tagLabel: 'Tag Number',
  tagPlaceholder: 'Deer tag number',
  confirmationValidation: 'exact_13',
  tagFormat: 'digits_only',
  tagSearchHelp:
    'Only use this after staff have assigned the real deer tag.',
  callBeforePickup: false,
};

const READY_WORDS = ['ready', 'finished', 'complete', 'completed', 'done', 'called'];
const HOLD_WORDS = ['hold', 'waiting', 'pending', 'not started', 'dropped off', 'drop off', 'received'];
const PROGRESS_WORDS = ['process', 'cut', 'grind', 'smoke', 'cure', 'working', 'started', 'in progress', 'calling'];
const WEBBS_PRICE_NOTE =
  'Totals may include the processor Webbs handling fee, but Webbs product prices are not included. Those product charges will be provided when the Webbs order is delivered.';

const tones: Record<StatusTone, { border: string; background: string; text: string }> = {
  ready: { border: '#2a5f47', background: '#193b2e', text: '#a7e3ba' },
  progress: { border: '#6b4f1d', background: 'rgba(146, 108, 40, 0.18)', text: '#f4d08c' },
  hold: { border: '#334155', background: '#111827', text: '#dbe3ef' },
  unknown: { border: '#334155', background: '#0f1416', text: '#dbe3ef' },
};

function text(s?: string) {
  return String(s || '').toLowerCase();
}

function toNum(v: unknown) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function toBool(v: unknown) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  return ['1', 'true', 'yes', 'y', 'paid', 'x', 'on'].includes(s);
}

function positiveMoney(v: unknown) {
  const n = toNum(v);
  return typeof n === 'number' && n > 0 ? n : 0;
}

function money(n?: number) {
  return typeof n === 'number' ? `$${n.toFixed(2)}` : '-';
}

function formatDateTime(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(value?: string) {
  if (!value) return 'Drop-off date not listed';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map((part) => Number(part));
    if (year && month && day) {
      return new Date(year, month - 1, day).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Drop-off date not listed';
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeName(n?: string) {
  return (n || '').trim().replace(/[^a-zA-Z'\-\s]/g, ' ').replace(/\s+/g, ' ');
}

function normalizePhone(n?: string) {
  return String(n || '').replace(/\D+/g, '').slice(0, 10);
}

function statusTone(status?: string): StatusTone {
  const value = text(status);
  if (!value) return 'unknown';
  if (READY_WORDS.some((word) => value.includes(word))) return 'ready';
  if (PROGRESS_WORDS.some((word) => value.includes(word))) return 'progress';
  if (HOLD_WORDS.some((word) => value.includes(word))) return 'hold';
  return 'unknown';
}

function statusMessage(label: string, status?: string) {
  const tone = statusTone(status);
  const value = text(status);
  if (value.includes('called')) return `Please contact the shop about your ${label.toLowerCase()}.`;
  if (value.includes('picked up')) return `Your ${label.toLowerCase()} has already been picked up.`;
  if (tone === 'ready') return `Your ${label.toLowerCase()} is ready for pickup.`;
  if (tone === 'progress') return `Your ${label.toLowerCase()} is still being worked on.`;
  if (tone === 'hold') return `We have your ${label.toLowerCase()} and it is waiting for the next step.`;
  return `We will update this page as your ${label.toLowerCase()} moves through the shop.`;
}

function customerFacingStatus(status?: string) {
  const value = text(status);
  if (!value) return 'Not posted yet';
  if (value.includes('called')) return 'Please contact us';
  if (value.includes('picked up')) return 'Picked up';
  if (READY_WORDS.some((w) => value.includes(w))) return 'Ready for pickup';
  if (PROGRESS_WORDS.some((w) => value.includes(w))) return 'Still being worked on';
  if (HOLD_WORDS.some((w) => value.includes(w))) return 'We have it';
  return 'Status updated';
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] || '';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function customerSummary(summaries: TrackSummary[]) {
  const active = summaries.filter((item) => !text(item.value).includes('picked up'));
  const pickedUp = summaries.filter((item) => text(item.value).includes('picked up')).map((item) => item.label);
  const ready = active.filter((item) => item.tone === 'ready').map((item) => item.label);
  const progress = active.filter((item) => item.tone === 'progress').map((item) => item.label);

  if (ready.length && progress.length) {
    return {
      tone: 'ready' as StatusTone,
      title: `${joinLabels(ready)} ${ready.length === 1 ? 'is' : 'are'} ready.`,
      body: `${joinLabels(progress)} ${progress.length === 1 ? 'is' : 'are'} still being worked on. You can pick up ready items when the shop is open.`,
    };
  }
  if (ready.length) {
    return {
      tone: 'ready' as StatusTone,
      title: `${joinLabels(ready)} ${ready.length === 1 ? 'is' : 'are'} ready for pickup.`,
      body: 'Check the pickup details below before heading to the shop.',
    };
  }
  if (progress.length) {
    return {
      tone: 'progress' as StatusTone,
      title: 'Your order is still being worked on.',
      body: 'No action is needed right now. The shop will contact you when something is ready for pickup.',
    };
  }
  if (pickedUp.length && pickedUp.length === summaries.length) {
    return {
      tone: 'ready' as StatusTone,
      title: 'This order has been picked up.',
      body: 'If you think something is missing, contact the shop.',
    };
  }
  return {
    tone: 'hold' as StatusTone,
    title: 'We have your deer.',
    body: 'No action is needed right now. This page will update as your order moves through the shop.',
  };
}

function todaysHours(hours: ReadonlyArray<{ label: string; value: string }>) {
  const day = new Date().getDay();
  const weekdayNames = [
    ['sun', 'sunday'],
    ['mon', 'monday'],
    ['tue', 'tues', 'tuesday'],
    ['wed', 'wednesday'],
    ['thu', 'thur', 'thurs', 'thursday'],
    ['fri', 'friday'],
    ['sat', 'saturday'],
  ];
  const todayWords = weekdayNames[day];
  const isWeekday = day >= 1 && day <= 5;
  const dayAliases = weekdayNames.flatMap((aliases, index) =>
    aliases.map((word) => ({ word, index }))
  ).sort((a, b) => b.word.length - a.word.length);
  const hasWord = (label: string, word: string) => new RegExp(`\\b${word}\\b`).test(label);
  const dayIndexIn = (value: string) => dayAliases.find(({ word }) => hasWord(value, word))?.index;
  const dayInRange = (start: number, end: number) =>
    start <= end ? day >= start && day <= end : day >= start || day <= end;
  const match = hours.find((row) => {
    const label = String(row.label || '').toLowerCase().replace(/[–—]/g, '-');
    if (!label) return false;
    if (/\b(daily|every day|all week)\b/.test(label)) return true;
    if (/\bweekdays?\b/.test(label)) return isWeekday;
    if (/\bweekends?\b/.test(label)) return day === 0 || day === 6;
    const range = label.match(/([a-z]+)\s*(?:-|to|through|thru)\s*([a-z]+)/);
    if (range) {
      const start = dayIndexIn(range[1]);
      const end = dayIndexIn(range[2]);
      if (start !== undefined && end !== undefined && dayInRange(start, end)) return true;
    }
    return todayWords.some((word) => hasWord(label, word));
  });
  return match ? `${match.label}: ${match.value}` : '';
}

function trackSummaries(
  res: LookupResult | null,
  options?: {
    webbsEnabled?: boolean;
    specialtyEnabled?: boolean;
  }
): TrackSummary[] {
  if (!res) return [];
  const tracks = res.tracks || {};
  const webbsEnabled = options?.webbsEnabled !== false;
  const specialtyEnabled = options?.specialtyEnabled !== false;
  return [
    {
      key: 'meat',
      label: 'Processing',
      value: res.status,
      tone: statusTone(res.status),
      message: statusMessage('Processing', res.status),
    },
    {
      key: 'cape',
      label: 'Cape',
      value: tracks.capeStatus,
      tone: statusTone(tracks.capeStatus),
      message: statusMessage('Cape', tracks.capeStatus),
    },
    {
      key: 'webbs',
      label: 'Webbs',
      value: tracks.webbsStatus,
      tone: statusTone(tracks.webbsStatus),
      message: statusMessage('Webbs', tracks.webbsStatus),
    },
    {
      key: 'specialty',
      label: 'Specialty',
      value: tracks.specialtyStatus,
      tone: statusTone(tracks.specialtyStatus),
      message: statusMessage('Specialty', tracks.specialtyStatus),
    },
  ].filter((item) => {
    if (!item.value) return false;
    if (item.key === 'webbs' && !webbsEnabled) return false;
    if (item.key === 'specialty' && !specialtyEnabled) return false;
    return true;
  });
}

export default function StatusPage() {
  const [confirmation, setConfirmation] = useState('');
  const [tag, setTag] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [res, setRes] = useState<LookupResult | null>(null);
  const [matches, setMatches] = useState<LookupResult[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [urlLookupStarted, setUrlLookupStarted] = useState(false);
  const [publicHours, setPublicHours] = useState<ReadonlyArray<{ label: string; value: string }>>(
    SITE.hours as ReadonlyArray<{ label: string; value: string }>
  );
  const [branding, setBranding] = useState<PublicBrandingState>({
    name: SITE.name,
    address: SITE.address,
    phoneDisplay: SITE.phone,
    phoneHref,
    email: '',
    mapsUrl: SITE.mapsUrl,
    webbsEnabled: true,
    specialtyEnabled: true,
  });
  const [publicCopy, setPublicCopy] = useState<PublicCopyState>(DEFAULT_STATUS_COPY);
  const identifierSettings = useMemo(() => identifierSettingsFromPublicCopy(publicCopy as any), [publicCopy]);

  const pollUntilRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestReadyRef = useRef(false);

  const isReady = useMemo(() => {
    if (!res) return false;
    const t = res.tracks || {};
    return (
      READY_WORDS.some((w) => text(res.status).includes(w)) ||
      READY_WORDS.some((w) => text(t.capeStatus).includes(w)) ||
      (branding.webbsEnabled && READY_WORDS.some((w) => text(t.webbsStatus).includes(w))) ||
      (branding.specialtyEnabled && READY_WORDS.some((w) => text(t.specialtyStatus).includes(w)))
    );
  }, [res, branding.webbsEnabled, branding.specialtyEnabled]);

  useEffect(() => {
    latestReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    fetch('/api/public/site-settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j?.settings?.hours) && j.settings.hours.length) {
          setPublicHours(
            j.settings.hours.map((h: any) => ({
              label: String(h?.label || ''),
              value: String(h?.value || ''),
            }))
          );
        }
        if (j?.ok && j?.settings?.branding) {
          const nextPhoneHref = j.settings.branding.phoneE164
            ? `tel:${j.settings.branding.phoneE164}`
            : j.settings.branding.phoneDisplay
              ? `tel:${String(j.settings.branding.phoneDisplay).replace(/\D+/g, '')}`
              : phoneHref;
          setBranding({
            name: String(j.settings.branding.name || SITE.name),
            address: String(j.settings.branding.address || SITE.address),
            phoneDisplay: String(j.settings.branding.phoneDisplay || SITE.phone),
            phoneHref: nextPhoneHref,
            email: String(j.settings.branding.email || ''),
            mapsUrl: String(j.settings.branding.mapsUrl || SITE.mapsUrl),
            webbsEnabled: j.settings.features?.webbsEnabled !== false,
            specialtyEnabled: j.settings.features?.specialtyEnabled !== false,
          });
        }
        if (j?.ok && j?.settings?.publicCopy) {
          const identifiers = identifierSettingsFromPublicCopy(j.settings.publicCopy);
          setPublicCopy({
            ...DEFAULT_STATUS_COPY,
            statusIntro: String(j.settings.publicCopy.statusIntro || DEFAULT_STATUS_COPY.statusIntro),
            statusBestWay: String(j.settings.publicCopy.statusBestWay || DEFAULT_STATUS_COPY.statusBestWay),
            statusLookupHelp: String(j.settings.publicCopy.statusLookupHelp || DEFAULT_STATUS_COPY.statusLookupHelp),
            confirmationSearchHelp: String(j.settings.publicCopy.confirmationSearchHelp || DEFAULT_STATUS_COPY.confirmationSearchHelp),
            confirmationLabel: identifiers.confirmationLabel,
            confirmationPlaceholder: identifiers.confirmationPlaceholder,
            confirmationValidation: identifiers.confirmationValidation,
            tagLabel: identifiers.tagLabel,
            tagPlaceholder: identifiers.tagPlaceholder,
            tagFormat: identifiers.tagFormat,
            tagSearchHelp: String(j.settings.publicCopy.tagSearchHelp || DEFAULT_STATUS_COPY.tagSearchHelp),
            callBeforePickup: !!j.settings.publicCopy.callBeforePickup,
          });
        }
      })
      .catch(() => {});
  }, []);

  const priceProcessing = toNum(res?.priceProcessing);
  const rawPriceSpecialty = toNum(res?.priceSpecialty);
  const amountPaidProcessing = positiveMoney(res?.amountPaidProcessing);
  const amountPaidSpecialty = positiveMoney(res?.amountPaidSpecialty);
  const hasWebbsOrder = branding.webbsEnabled && !!res?.tracks?.webbsStatus;
  const specialtyApplies =
    branding.specialtyEnabled &&
    (
      (typeof rawPriceSpecialty === 'number' && rawPriceSpecialty > 0) ||
      amountPaidSpecialty > 0 ||
      !!res?.tracks?.specialtyStatus ||
      (res?.paidSpecialty !== undefined && res?.paidSpecialty !== null && String(res.paidSpecialty) !== '')
    );
  const priceSpecialty = specialtyApplies ? rawPriceSpecialty : undefined;
  const rawPriceTotal = toNum(res?.priceTotal);
  const computedLineTotal =
    typeof priceProcessing === 'number' || typeof priceSpecialty === 'number'
      ? (priceProcessing || 0) + (priceSpecialty || 0)
      : undefined;
  const priceTotal =
    typeof computedLineTotal === 'number' &&
    (rawPriceTotal === undefined || rawPriceTotal <= 0 || computedLineTotal > rawPriceTotal)
      ? computedLineTotal
      : rawPriceTotal;

  const rawPaidOverall = toBool(res?.paid);
  const rawPaidProc = toBool(res?.paidProcessing);
  const rawPaidSpec = toBool(res?.paidSpecialty);
  const processingPaidByAmount =
    typeof priceProcessing === 'number' &&
    priceProcessing > 0 &&
    amountPaidProcessing >= priceProcessing;
  const specialtyPaidByAmount =
    typeof priceSpecialty === 'number' &&
    priceSpecialty > 0 &&
    amountPaidSpecialty >= priceSpecialty;
  const paidProc =
    rawPaidProc !== undefined
      ? rawPaidProc || processingPaidByAmount
      : rawPaidOverall !== undefined && (!priceProcessing || priceProcessing <= 0)
        ? rawPaidOverall
        : processingPaidByAmount || undefined;
  const paidSpec =
    rawPaidSpec !== undefined
      ? rawPaidSpec || specialtyPaidByAmount
      : rawPaidOverall !== undefined && (!priceSpecialty || priceSpecialty <= 0)
        ? rawPaidOverall
        : specialtyPaidByAmount || undefined;
  const paidOverallFromAmounts =
    (typeof priceProcessing !== 'number' || priceProcessing <= 0 || processingPaidByAmount) &&
    (!specialtyApplies || typeof priceSpecialty !== 'number' || priceSpecialty <= 0 || specialtyPaidByAmount) &&
    ((typeof priceProcessing === 'number' && priceProcessing > 0) ||
      (specialtyApplies && typeof priceSpecialty === 'number' && priceSpecialty > 0));
  const paidOverall =
    [paidProc, paidSpec].some((v) => v !== undefined)
      ? [paidProc, paidSpec].every((v, i) =>
          i === 1 && (!priceSpecialty || priceSpecialty <= 0) ? true : v !== false
        ) && ([paidProc, paidSpec].some((v) => v === true) || paidOverallFromAmounts)
      : rawPaidOverall || paidOverallFromAmounts;
  const hasAnyPaid = [res?.paid, res?.paidProcessing, res?.paidSpecialty].some(
    (v) => v !== undefined && v !== null && String(v) !== ''
  ) || amountPaidProcessing > 0 || amountPaidSpecialty > 0;
  const hasAnyPricing =
    typeof priceProcessing === 'number' ||
    typeof priceSpecialty === 'number' ||
    typeof priceTotal === 'number';

  const owedProcessing =
    paidOverall === true || paidProc === true
      ? 0
      : typeof priceProcessing === 'number'
        ? Math.max(0, priceProcessing - amountPaidProcessing)
        : undefined;
  const owedSpecialty =
    paidOverall === true || paidSpec === true
      ? 0
      : typeof priceSpecialty === 'number'
        ? Math.max(0, priceSpecialty - amountPaidSpecialty)
        : undefined;
  const owedTotal =
    paidOverall === true
      ? 0
      : typeof owedProcessing === 'number' || typeof owedSpecialty === 'number'
        ? (owedProcessing || 0) + (owedSpecialty || 0)
        : typeof priceTotal === 'number'
          ? priceTotal
          : undefined;

  const summaries = useMemo(
    () => trackSummaries(res, { webbsEnabled: branding.webbsEnabled, specialtyEnabled: branding.specialtyEnabled }),
    [res, branding.webbsEnabled, branding.specialtyEnabled]
  );
  const currentStage = summaries[0];
  const readySummaries = useMemo(
    () => summaries.filter((item) => item.tone === 'ready' && !text(item.value).includes('picked up')),
    [summaries]
  );
  const processingReady = readySummaries.some((item) => item.key === 'meat');
  const specialtyReady = readySummaries.some((item) => item.key === 'specialty');
  const readyLabels = readySummaries.map((item) => item.label);
  const readyPaymentLines = useMemo(() => {
    const lines: ReadyPaymentLine[] = [];
    if (processingReady && typeof owedProcessing === 'number') {
      lines.push({ label: 'Processing', due: owedProcessing });
    }
    if (specialtyReady && typeof owedSpecialty === 'number') {
      lines.push({ label: 'Specialty', due: owedSpecialty });
    }
    return lines;
  }, [processingReady, specialtyReady, owedProcessing, owedSpecialty]);
  const plainSummary = useMemo(() => customerSummary(summaries), [summaries]);
  const todayHours = useMemo(() => todaysHours(publicHours), [publicHours]);
  const mapsUrl = branding.mapsUrl;
  const showNotFoundHelp = !!err && !res && /no deer matched|no match/i.test(err);

  const field: React.CSSProperties = {
    background: '#0f1416',
    color: '#e6e7eb',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '13px 14px',
  };
  const sectionCard: React.CSSProperties = {
    border: '1px solid #1f2937',
    borderRadius: 14,
    background: '#11161b',
    padding: 14,
  };
  const primaryBtn: React.CSSProperties = {
    background: '#2f6f3f',
    color: '#fff',
    border: '1px solid transparent',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 800,
    cursor: 'pointer',
  };
  const secondaryBtn: React.CSSProperties = {
    background: '#11161b',
    color: '#e6e7eb',
    border: '1px solid #1f2937',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  };
  const errBox: React.CSSProperties = {
    marginTop: 12,
    border: '1px solid #7f1d1d',
    background: 'rgba(127,29,29,.15)',
    color: '#fecaca',
    borderRadius: 12,
    padding: 12,
  };

  async function postStatus(payload: { confirmation?: string; tag?: string; lastName?: string; phone?: string }) {
    const r = await fetch('/api/public-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await r.json()) as LookupResult;
  }

  const doLookupChain = useCallback(async (payload: { confirmation?: string; tag?: string; lastName?: string; phone?: string }) => {
    setLoading(true);
    setErr(null);
    setMatches([]);
    try {
      const attempts: Array<{ confirmation?: string; tag?: string; lastName?: string; phone?: string }> = [];
      const hasConfirmation = !!payload.confirmation;
      const hasTagAndName = !!payload.tag && !!payload.lastName;
      const hasPhoneAndName = !!payload.phone && payload.phone.length === 10 && !!payload.lastName;

      if (hasConfirmation || hasTagAndName || hasPhoneAndName) {
        attempts.push(payload);
      } else {
        setRes(null);
        setErr('Enter your confirmation number, tag and last name, or phone number and last name.');
        return;
      }

      let lastErr: string | null = null;
      for (const p of attempts) {
        const resp = await postStatus(p);
        if (resp?.ok && Array.isArray(resp.matches) && resp.matches.length) {
          setRes(null);
          setMatches(resp.matches);
          setLastUpdatedAt(Date.now());
          return;
        }
        if (resp?.ok) {
          setRes(resp);
          setMatches([]);
          setLastUpdatedAt(Date.now());
          return;
        }
        if (resp?.error && !resp?.notFound) {
          lastErr = resp.error;
          break;
        }
      }

      setRes(null);
      setMatches([]);
      setErr(lastErr || 'No deer matched that search. Try your confirmation number first, or use phone number and last name if you do not have it.');
    } catch (e: any) {
      setRes(null);
      setMatches([]);
      setErr(e?.message || 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const doLookup = useCallback(
    async (payload: { confirmation?: string; tag?: string; lastName?: string; phone?: string }) => doLookupChain(payload),
    [doLookupChain]
  );

  useEffect(() => {
    if (urlLookupStarted || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const rawConfirmation = params.get('confirmation') || params.get('conf') || '';
    const rawTag = params.get('tag') || '';
    const rawLastName = params.get('lastName') || params.get('last') || '';
    const rawPhone = params.get('phone') || '';
    const nextConfirmation = normalizeConfirmationInput(rawConfirmation, identifierSettings);
    const nextTag = normalizeTagInput(rawTag, identifierSettings);
    const nextLastName = normalizeName(rawLastName);
    const nextPhone = normalizePhone(rawPhone);
    if (!nextConfirmation && !(nextTag && nextLastName) && !(nextPhone && nextLastName)) {
      setUrlLookupStarted(true);
      return;
    }

    setUrlLookupStarted(true);
    if (nextConfirmation) setConfirmation(nextConfirmation);
    if (nextTag) setTag(nextTag);
    if (nextLastName) setLastName(nextLastName);
    if (nextPhone) setPhone(nextPhone);
    void doLookupChain({ confirmation: nextConfirmation, tag: nextTag, lastName: nextLastName, phone: nextPhone });
  }, [urlLookupStarted, identifierSettings, doLookupChain]);

  function clearPolling() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      confirmation: normalizeConfirmationInput(confirmation, identifierSettings),
      tag: normalizeTagInput(tag, identifierSettings),
      lastName: normalizeName(lastName),
      phone: normalizePhone(phone),
    };

    if (!payload.confirmation && !(payload.tag && payload.lastName) && !(payload.phone && payload.lastName)) {
      setErr(`Enter your ${identifierSettings.confirmationLabel.toLowerCase()}, your ${identifierSettings.tagLabel.toLowerCase()} and last name, or your phone number and last name.`);
      return;
    }

    doLookup(payload);

    clearPolling();
    pollUntilRef.current = Date.now() + 5 * 60 * 1000;
    const delays = [30_000, 60_000, 120_000];
    let i = 0;

    const tick = async () => {
      if (!pollUntilRef.current || Date.now() > pollUntilRef.current) return;
      if (document.hidden) {
        timeoutRef.current = setTimeout(tick, 15_000);
        return;
      }

      await doLookup(payload);
      if (latestReadyRef.current) return;

      const nextDelay = delays[Math.min(i++, delays.length - 1)];
      timeoutRef.current = setTimeout(tick, nextDelay);
    };

    timeoutRef.current = setTimeout(tick, delays[0]);
  }

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, []);

  async function handleScan() {
    try {
      // @ts-ignore
      if (!('BarcodeDetector' in window)) return;
      // @ts-ignore
      const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const bitmap = await createImageBitmap(canvas);
      // @ts-ignore
      const codes = await detector.detect(bitmap);
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      if (codes?.[0]?.rawValue) {
        const raw = String(codes[0].rawValue).trim();
        if (/^\d+$/.test(raw)) {
          setConfirmation(raw);
        } else {
          setTag(raw.replace(/\s+/g, ' '));
        }
      }
    } catch {
      // ignore scan failures
    }
  }

  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && 'mediaDevices' in navigator;

  return (
    <main className="app-frame" style={{ maxWidth: 960 }}>
      <section className="app-hero">
        <div className="app-hero-grid">
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="app-kicker">Customer Status</div>
            <h1 className="app-title" style={{ fontSize: 'clamp(28px, 5vw, 38px)' }}>Check Your Deer Status</h1>
            <p className="app-copy">
              {publicCopy.statusIntro}
            </p>
          </div>
        </div>
      </section>

      <section className="app-surface-light" style={{ padding: 18, display: 'grid', gap: 8 }}>
        <div className="app-section-head">
          <div className="app-section-title">Look Up Your Order</div>
          <div className="app-section-copy">
            {publicCopy.statusLookupHelp}
          </div>
        </div>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                border: '1px solid #dbe4ee',
                borderRadius: 14,
                background: '#ffffff',
                padding: 14,
                color: '#0f172a',
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
                Easiest option
              </div>
              <div style={{ fontWeight: 900 }}>{`Search by ${identifierSettings.confirmationLabel.toLowerCase()} first.`}</div>
              <div style={{ color: '#475569', lineHeight: 1.5 }}>
                {publicCopy.statusBestWay}
                {' '}The final deer tag may not be assigned yet, so phone number and last name can be easier than tag lookup.
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              <div style={{ ...sectionCard, background: '#f8fafc', borderColor: '#dbe4ee', color: '#0f172a' }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{`Search by ${identifierSettings.confirmationLabel}`}</div>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
                  {publicCopy.confirmationSearchHelp}
                </div>
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={identifierSettings.confirmationPlaceholder}
                  inputMode={confirmationInputMode(identifierSettings)}
                  aria-label="Confirmation number"
                  style={{ ...field, width: '100%' }}
                />
              </div>

              <div style={{ ...sectionCard, background: '#f8fafc', borderColor: '#dbe4ee', color: '#0f172a' }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Search by Phone and Last Name</div>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
                  Good backup if you chose phone calls or do not have your confirmation number handy.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(normalizePhone(e.target.value))}
                    placeholder="10-digit phone"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    aria-label="Phone number for status lookup"
                    style={field}
                  />
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Customer last name"
                    aria-label="Customer last name for phone lookup"
                    style={field}
                  />
                </div>
              </div>

              <div style={{ ...sectionCard, background: '#f8fafc', borderColor: '#dbe4ee', color: '#0f172a' }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{`Search by ${identifierSettings.tagLabel} and Last Name`}</div>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
                  {publicCopy.tagSearchHelp}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={identifierSettings.tagPlaceholder} inputMode={tagInputMode(identifierSettings)} aria-label="Tag number" style={field} />
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Customer last name"
                    aria-label="Customer last name for tag lookup"
                    style={field}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {canScan ? (
                <button type="button" onClick={handleScan} title="Scan code" style={{ ...secondaryBtn, whiteSpace: 'nowrap' }}>
                  Scan
                </button>
              ) : null}
              <button disabled={loading} style={primaryBtn} aria-busy={loading}>
                {loading ? 'Checking...' : 'Check Status'}
              </button>
            </div>
          </form>
      </section>

      {err ? (
        <div role="alert" aria-live="polite" style={errBox}>
          {err}
        </div>
      ) : null}
      {showNotFoundHelp ? (
        <NotFoundHelp
          confirmationLabel={identifierSettings.confirmationLabel}
          tagLabel={identifierSettings.tagLabel}
          phoneHref={branding.phoneHref}
          phoneDisplay={branding.phoneDisplay}
        />
      ) : null}

      {matches.length ? (
        <section className="app-surface-light" style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div className="app-section-head">
            <div className="app-section-title">Choose Your Deer</div>
            <div className="app-section-copy">
              We found {matches.length} deer with that phone number and last name. Select the one you want to check.
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {matches.map((match, index) => {
              const matchSummaries = trackSummaries(match, {
                webbsEnabled: branding.webbsEnabled,
                specialtyEnabled: branding.specialtyEnabled,
              });
              const matchStage = matchSummaries[0];
              const key = `${match.confirmation || match.tag || index}-${match.dropoffDate || index}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setRes(match);
                    setMatches([]);
                    setErr(null);
                    setLastUpdatedAt(Date.now());
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #dbe4ee',
                    borderRadius: 14,
                    background: '#ffffff',
                    color: '#0f172a',
                    padding: 14,
                    cursor: 'pointer',
                    display: 'grid',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 18 }}>{match.customer || 'Customer'}</div>
                      <div style={{ color: '#475569', marginTop: 3 }}>
                        Drop-off {formatDateOnly(match.dropoffDate)}
                      </div>
                    </div>
                    {matchStage ? (
                      <StatusPill tone={matchStage.tone} label={customerFacingStatus(matchStage.value) || 'Status pending'} />
                    ) : null}
                  </div>
                  <div style={{ color: '#475569', lineHeight: 1.45 }}>
                    Confirmation {match.confirmation || '-'} {match.tag ? `| Tag ${match.tag}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {res ? (
        <section className="app-surface-light" style={{ padding: 18, display: 'grid', gap: 16 }}>
          <div
            style={{
              ...sectionCard,
              borderColor: tones[plainSummary.tone].border,
              background: plainSummary.tone === 'ready' ? '#ecfdf3' : '#f8fafc',
              color: '#0f172a',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.78, marginBottom: 4 }}>Order found</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{res.customer || 'Customer'}</div>
                <div style={{ opacity: 0.86, marginTop: 4 }}>
                  Confirmation {res.confirmation || '-'} {res.tag ? `| Tag ${res.tag}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                {res.intakeLink ? (
                  <Link
                    href={res.intakeLink}
                    style={{
                      background: '#ffffff',
                      color: '#166534',
                      border: '1px solid #bbf7d0',
                      borderRadius: 999,
                      padding: '8px 14px',
                      fontWeight: 900,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    View intake form
                  </Link>
                ) : null}
                {currentStage ? (
                  <StatusPill tone={currentStage.tone} label={customerFacingStatus(currentStage.value) || 'Status pending'} />
                ) : null}
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
                What this means
              </div>
              <div style={{ fontSize: 23, fontWeight: 950, lineHeight: 1.18 }}>
                {plainSummary.title}
              </div>
              <p style={{ margin: 0, color: '#475569', lineHeight: 1.5 }}>
                {plainSummary.body}
              </p>
              {res.updatedAt ? (
                <div style={{ color: '#64748b', fontSize: 13, fontWeight: 800 }}>
                  Status last updated: {formatDateTime(res.updatedAt)}
                </div>
              ) : null}
            </div>
            {res.intakeLink ? (
              <p style={{ margin: '8px 0 0', color: '#475569', lineHeight: 1.45 }}>
                Need to review your cuts, contact information, or specialty selections? Open the read-only intake form.
              </p>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <SummaryCard
              title="Current status"
              value={customerFacingStatus(currentStage?.value || res.status) || 'Status pending'}
              note={currentStage?.message || 'We will keep this page updated as your deer moves through the shop.'}
            />
            <SummaryCard
              title="Processing balance"
              value={money(owedProcessing)}
              note={
                paidOverall || paidProc
                  ? 'Processing is marked paid.'
                  : typeof owedProcessing === 'number'
                    ? processingReady
                      ? 'This is the processing balance to plan for at pickup.'
                      : 'This balance is shown for processing, even if processing is not ready yet.'
                    : 'Processing pricing has not been posted yet.'
              }
            />
            {specialtyApplies ? (
              <SummaryCard
                title="Specialty balance"
                value={money(owedSpecialty)}
                note={
                  paidOverall || paidSpec
                    ? 'Specialty is marked paid.'
                    : typeof owedSpecialty === 'number'
                      ? specialtyReady
                        ? 'This is the specialty balance to plan for at pickup.'
                        : 'This balance is shown for specialty items, even if they are not ready yet.'
                      : 'Specialty pricing has not been posted yet.'
                }
              />
            ) : null}
            <SummaryCard
              title="Total balance shown"
              value={money(owedTotal)}
              note={
                paidOverall
                  ? 'No additional balance is showing.'
                  : typeof owedTotal === 'number'
                    ? hasWebbsOrder
                      ? `This is the total currently showing for processing and specialty items. ${WEBBS_PRICE_NOTE}`
                      : 'This is the total currently showing in our system. Different items may finish at different times.'
                    : 'Pricing has not been posted yet.'
              }
            />
            <SummaryCard
              title="Payment status"
              value={paidOverall ? 'Paid' : hasAnyPaid ? 'Partially paid or unpaid' : 'Not posted yet'}
              note={
                paidOverall
                  ? 'No additional balance is showing.'
                  : hasAnyPaid
                    ? 'See the payment breakdown below for what is paid and what is still owed.'
                    : 'Payment details will appear here once entered.'
              }
            />
          </div>

          <section style={sectionCard} aria-label="Status details">
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Order Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {summaries.map((item) => (
                <TrackCard key={item.key} item={item} />
              ))}
            </div>
          </section>

          {(hasAnyPricing || hasAnyPaid) && (
            <section style={sectionCard} aria-label="Payment details">
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Payment Breakdown</div>
              {hasWebbsOrder ? (
                <div style={{ marginBottom: 10, border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: 12, padding: 12, lineHeight: 1.45, fontWeight: 800 }}>
                  {WEBBS_PRICE_NOTE}
                </div>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <PaymentCard label="Processing" amount={priceProcessing} paidAmount={amountPaidProcessing} paid={paidOverall || paidProc} owed={owedProcessing} />
                {specialtyApplies ? <PaymentCard label="Specialty" amount={priceSpecialty} paidAmount={amountPaidSpecialty} paid={paidOverall || paidSpec} owed={owedSpecialty} /> : null}
                <PaymentCard label="Total" amount={priceTotal} paidAmount={amountPaidProcessing + amountPaidSpecialty} paid={paidOverall} owed={owedTotal} />
              </div>
            </section>
          )}

          <PickupPanel
            ready={isReady}
            processorName={branding.name}
            addressText={branding.address}
            mapsUrl={mapsUrl}
            phoneHref={branding.phoneHref}
            phoneDisplay={branding.phoneDisplay}
            email={branding.email}
            hours={publicHours}
            todayHours={todayHours}
            readyLabels={readyLabels}
            readyPaymentLines={readyPaymentLines}
            callBeforePickup={publicCopy.callBeforePickup}
            statusUpdatedAt={res.updatedAt}
            lastUpdatedAt={lastUpdatedAt}
          />
        </section>
      ) : null}
    </main>
  );
}

function SummaryCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div
      style={{
        border: '1px solid #dbe4ee',
        borderRadius: 14,
        background: '#f8fafc',
        padding: 14,
        color: '#0f172a',
      }}
    >
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>{value}</div>
      <div style={{ color: '#475569', lineHeight: 1.45 }}>{note}</div>
    </div>
  );
}

function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  const palette = tones[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.text,
        borderRadius: 999,
        padding: '8px 14px',
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

function TrackCard({ item }: { item: TrackSummary }) {
  const palette = tones[item.tone];
  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        background: '#ffffff',
        borderRadius: 14,
        padding: 14,
        display: 'grid',
        gap: 8,
        color: '#0f172a',
      }}
    >
      <div style={{ fontSize: 12, color: '#64748b' }}>{item.label}</div>
      <StatusPill tone={item.tone} label={item.value || 'Status pending'} />
      <div style={{ color: '#475569', lineHeight: 1.45 }}>{item.message}</div>
    </div>
  );
}

function PaymentCard({ label, amount, paidAmount, paid, owed }: PaymentCardProps & { paidAmount?: number }) {
  return (
    <div
      style={{
        border: '1px solid #dbe4ee',
        borderRadius: 14,
        background: '#ffffff',
        padding: 14,
        display: 'grid',
        gap: 8,
        color: '#0f172a',
      }}
    >
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{money(amount)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Badge ok={!!paid} label={paid ? 'Paid' : 'Unpaid'} />
        {paidAmount ? <Badge ok label={`Paid ${money(paidAmount)}`} /> : null}
        {typeof owed === 'number' ? <Badge ok={owed === 0} label={owed === 0 ? 'Balance cleared' : `Owes ${money(owed)}`} /> : null}
      </div>
    </div>
  );
}

function Badge({ ok, label }: { ok?: boolean; label: string }) {
  const palette = ok ? tones.ready : tones.hold;
  return (
    <span
      style={{
        display: 'inline-block',
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.text,
        borderRadius: 999,
        padding: '4px 10px',
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

function NotFoundHelp({
  confirmationLabel,
  tagLabel,
  phoneHref,
  phoneDisplay,
}: {
  confirmationLabel: string;
  tagLabel: string;
  phoneHref: string;
  phoneDisplay: string;
}) {
  return (
    <section
      aria-label="Lookup Help"
      style={{
        marginTop: 12,
        border: '1px solid #dbe4ee',
        background: '#ffffff',
        borderRadius: 14,
        padding: 14,
        color: '#0f172a',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 18 }}>Need help finding it?</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', lineHeight: 1.55 }}>
        <li>Try the {confirmationLabel.toLowerCase()} first. This works even before staff assign the final deer tag.</li>
        <li>If you do not have the confirmation number, use the phone number from intake and the customer last name.</li>
        <li>If you are using {tagLabel.toLowerCase()}, make sure staff already assigned that tag and enter the customer last name.</li>
        <li>Check for a typo in the confirmation number, phone number, tag, or last name.</li>
      </ul>
      <div>
        <a
          href={phoneHref}
          style={{ background: '#2f6f3f', color: '#ffffff', borderRadius: 12, padding: '10px 13px', fontWeight: 900, textDecoration: 'none', display: 'inline-block' }}
        >
          Call Shop{phoneDisplay ? `: ${phoneDisplay}` : ''}
        </a>
      </div>
    </section>
  );
}

function PickupPanel({
  processorName,
  ready,
  addressText,
  mapsUrl,
  phoneHref,
  phoneDisplay,
  email,
  hours,
  todayHours,
  readyLabels,
  readyPaymentLines,
  callBeforePickup,
  statusUpdatedAt,
  lastUpdatedAt,
}: {
  processorName: string;
  ready: boolean;
  addressText: string;
  mapsUrl: string;
  phoneHref: string;
  phoneDisplay: string;
  email: string;
  hours: ReadonlyArray<{ label: string; value: string }>;
  todayHours: string;
  readyLabels: string[];
  readyPaymentLines: ReadyPaymentLine[];
  callBeforePickup: boolean;
  statusUpdatedAt?: string;
  lastUpdatedAt: number | null;
}) {
  const paymentDueForReady = readyPaymentLines.reduce((sum, line) => sum + line.due, 0);
  const readyLabelText = joinLabels(readyLabels);
  const pickupPaymentLine = readyPaymentLines.length
    ? paymentDueForReady > 0
      ? `Plan for ready-item balances: ${readyPaymentLines.map((line) => `${line.label} ${money(line.due)}`).join(', ')}.`
      : 'No balance is currently showing for the ready item(s).'
    : 'Any balance for pickup will be confirmed by the shop.';
  const checklist = ready
    ? [
        readyLabelText ? `${readyLabelText} ${readyLabels.length === 1 ? 'is' : 'are'} ready for pickup.` : 'At least one item is ready for pickup.',
        readyLabels.some((label) => ['Processing', 'Specialty', 'Webbs'].includes(label))
          ? 'Bring a cooler or box if you are picking up meat or specialty products.'
          : 'Bring any pickup materials staff asked you to bring.',
        pickupPaymentLine,
        todayHours ? `Today: ${todayHours}.` : 'Check the pickup hours before heading in.',
        callBeforePickup ? 'Call the shop before you come in.' : '',
      ].filter(Boolean)
    : [
        'No action is needed right now.',
        'The shop will contact you when something is ready.',
        todayHours ? `Today: ${todayHours}.` : '',
      ].filter(Boolean);

  return (
    <section
      aria-label="Pickup Information"
      style={{
        border: '1px solid #dbe4ee',
        background: '#f8fafc',
        borderRadius: 14,
        padding: 14,
        color: '#0f172a',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Pickup Information</div>
          <div style={{ color: '#475569' }}>
            When your deer is ready, this is where to go and how to reach {processorName}.
          </div>
        </div>
        {ready ? <StatusPill tone="ready" label="Ready for pickup" /> : null}
      </div>

      {lastUpdatedAt ? (
        <div style={{ fontSize: 12, opacity: 0.78 }}>
          {statusUpdatedAt ? `Status last updated: ${formatDateTime(statusUpdatedAt)}` : `Checked at: ${new Date(lastUpdatedAt).toLocaleTimeString()}`}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href={phoneHref} style={{ background: '#2f6f3f', color: '#ffffff', borderRadius: 12, padding: '10px 13px', fontWeight: 900, textDecoration: 'none' }}>
          Call Shop
        </a>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ background: '#ffffff', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 13px', fontWeight: 900, textDecoration: 'none' }}>
          Get Directions
        </a>
        {email ? (
          <a href={`mailto:${email}`} style={{ background: '#ffffff', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 13px', fontWeight: 900, textDecoration: 'none' }}>
            Email Shop
          </a>
        ) : null}
      </div>

      <div style={{ border: '1px solid #dbe4ee', borderRadius: 14, background: '#ffffff', padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 950 }}>Pickup checklist</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', lineHeight: 1.55 }}>
          {checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {todayHours ? (
          <div>
            <div style={{ fontSize: 12, opacity: 0.76, marginBottom: 5 }}>Today</div>
            <div style={{ fontWeight: 900 }}>{todayHours}</div>
          </div>
        ) : null}

        <div>
          <div style={{ fontSize: 12, opacity: 0.76, marginBottom: 5 }}>Location</div>
          <div>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
              {addressText}
            </a>
          </div>
        </div>

        {hours?.length ? (
          <div>
            <div style={{ fontSize: 12, opacity: 0.76, marginBottom: 5 }}>Hours</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: 0.92, display: 'grid', gap: 2 }}>
              {hours.map((h, i) => (
                <li key={i}>
                  {h.label}: {h.value}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div style={{ fontSize: 12, opacity: 0.76, marginBottom: 5 }}>Phone</div>
          <a href={phoneHref} style={{ color: '#2f6f3f', textDecoration: 'none', fontWeight: 800 }}>
            {phoneDisplay}
          </a>
        </div>
      </div>
    </section>
  );
}
