import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  assertBookingLocalModeAllowed,
  isBookingLocalMode,
} from './local-mode';

export type LocalSession = {
  id: string;
  workshopId: string;
  workshopTitle: string;
  workshopSlug: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  reservedCount: number;
  priceGrossGrosz: number;
  currency: string;
  status: 'draft' | 'scheduled' | 'sold_out' | 'cancelled' | 'completed';
  locationName: string | null;
  locationAddress: string | null;
  published: boolean;
  minimumAge: number | null;
  maximumAge: number | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalParticipant = {
  displayName: string;
  age: number | null;
  participantType: 'adult' | 'child' | 'unspecified';
  accessibilityNotes: string | null;
};

export type LocalBooking = {
  id: string;
  bookingReference: string;
  sessionId: string;
  quantity: number;
  status:
    | 'pending'
    | 'awaiting_payment'
    | 'confirmed'
    | 'cancelled'
    | 'expired'
    | 'refunded'
    | 'partially_refunded';
  purchaserEmail: string;
  purchaserFirstName: string;
  purchaserLastName: string;
  purchaserPhone: string;
  customerNotes: string;
  marketingConsent: boolean;
  termsAcceptedAt: string;
  privacyPolicyVersion: string;
  unitPriceGrossGrosz: number;
  totalPriceGrossGrosz: number;
  currency: string;
  participants: LocalParticipant[];
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
};

export type LocalOutboxEmail = {
  id: string;
  bookingId: string;
  type: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  providerMessageId: string | null;
  errorMessage: string | null;
};

type LocalStore = {
  version: 1;
  sessions: LocalSession[];
  bookings: LocalBooking[];
  outbox: LocalOutboxEmail[];
};

const STORE_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  'tmp',
  'local-booking'
);
const STORE_PATH = path.join(STORE_DIR, 'store.json');
const LOCK_PATH = path.join(STORE_DIR, 'store.lock');

function emptyStore(): LocalStore {
  return { version: 1, sessions: [], bookings: [], outbox: [] };
}

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

function readStoreUnlocked(): LocalStore {
  ensureDir();
  if (!existsSync(STORE_PATH)) {
    return emptyStore();
  }
  try {
    const raw = readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as LocalStore;
    if (!parsed || parsed.version !== 1) return emptyStore();
    return {
      version: 1,
      sessions: parsed.sessions ?? [],
      bookings: parsed.bookings ?? [],
      outbox: parsed.outbox ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStoreUnlocked(store: LocalStore): void {
  ensureDir();
  const tmp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  renameSync(tmp, STORE_PATH);
}

async function withStoreLock<T>(
  fn: (store: LocalStore) => T | Promise<T>
): Promise<T> {
  assertBookingLocalModeAllowed();
  if (!isBookingLocalMode()) {
    throw new Error('Local booking store requires BOOKING_LOCAL_MODE=1');
  }
  ensureDir();
  const started = Date.now();
  while (existsSync(LOCK_PATH)) {
    if (Date.now() - started > 5000) {
      try {
        const age = Date.now() - Number(readFileSync(LOCK_PATH, 'utf8'));
        if (Number.isFinite(age) && age > 8000) {
          // Stale lock from a crashed process
          break;
        }
      } catch {
        break;
      }
      throw new Error('Local booking store lock timeout');
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  writeFileSync(LOCK_PATH, String(Date.now()), 'utf8');
  try {
    const store = readStoreUnlocked();
    const result = await fn(store);
    writeStoreUnlocked(store);
    return result;
  } finally {
    try {
      if (existsSync(LOCK_PATH)) {
        // best-effort unlock
        writeFileSync(LOCK_PATH, '0', 'utf8');
        const { unlinkSync } = await import('node:fs');
        unlinkSync(LOCK_PATH);
      }
    } catch {
      // ignore unlock failures
    }
  }
}

export function buildIdempotencyKey(input: {
  sessionId: string;
  email: string;
  quantity: number;
  firstName: string;
  lastName: string;
}): string {
  return createHash('sha256')
    .update(
      [
        input.sessionId,
        input.email.trim().toLowerCase(),
        String(input.quantity),
        input.firstName.trim().toLowerCase(),
        input.lastName.trim().toLowerCase(),
      ].join('|')
    )
    .digest('hex');
}

function generateReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'CN-';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function listLocalSessions(options?: {
  includeUnpublished?: boolean;
  workshopSlug?: string;
}): Promise<LocalSession[]> {
  return withStoreLock((store) => {
    const now = Date.now();
    return store.sessions
      .filter((s) => {
        if (
          !options?.includeUnpublished &&
          (!s.published || s.status === 'draft')
        ) {
          return false;
        }
        if (s.status === 'cancelled') return false;
        if (options?.workshopSlug && s.workshopSlug !== options.workshopSlug) {
          return false;
        }
        return new Date(s.startsAt).getTime() >= now - 60_000;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  });
}

export async function getLocalSession(
  sessionId: string
): Promise<LocalSession | null> {
  return withStoreLock((store) => {
    return store.sessions.find((s) => s.id === sessionId) ?? null;
  });
}

export async function upsertLocalSession(
  input: Omit<LocalSession, 'createdAt' | 'updatedAt' | 'reservedCount'> & {
    reservedCount?: number;
  }
): Promise<LocalSession> {
  return withStoreLock((store) => {
    const now = new Date().toISOString();
    const existing = store.sessions.find((s) => s.id === input.id);
    if (existing) {
      const next: LocalSession = {
        ...existing,
        ...input,
        reservedCount: input.reservedCount ?? existing.reservedCount,
        updatedAt: now,
      };
      if (next.capacity < next.reservedCount) {
        throw new Error(
          'Pojemność nie może być mniejsza niż liczba zarezerwowanych miejsc.'
        );
      }
      Object.assign(existing, next);
      return existing;
    }
    const created: LocalSession = {
      ...input,
      reservedCount: input.reservedCount ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    store.sessions.push(created);
    return created;
  });
}

export async function cancelLocalSession(
  sessionId: string
): Promise<LocalSession> {
  return withStoreLock((store) => {
    const session = store.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Sesja nie istnieje');
    session.status = 'cancelled';
    session.published = false;
    session.updatedAt = new Date().toISOString();
    return session;
  });
}

export type BeginLocalBookingInput = {
  sessionId: string;
  quantity: number;
  purchaserEmail: string;
  purchaserFirstName: string;
  purchaserLastName: string;
  purchaserPhone: string;
  customerNotes?: string;
  marketingConsent: boolean;
  privacyPolicyVersion: string;
  participants: LocalParticipant[];
};

export type BeginLocalBookingResult =
  | {
      ok: true;
      booking: LocalBooking;
      session: LocalSession;
      reused: boolean;
    }
  | { ok: false; error: string; code: string };

export async function beginLocalBooking(
  input: BeginLocalBookingInput
): Promise<BeginLocalBookingResult> {
  return withStoreLock((store) => {
    const session = store.sessions.find((s) => s.id === input.sessionId);
    if (!session) {
      return { ok: false, error: 'Sesja nie istnieje.', code: 'not_found' };
    }
    if (!session.published || session.status === 'cancelled') {
      return {
        ok: false,
        error: 'Sesja nie jest dostępna do rezerwacji.',
        code: 'unpublished',
      };
    }
    if (session.status === 'completed') {
      return {
        ok: false,
        error: 'Sesja już się zakończyła.',
        code: 'past',
      };
    }
    if (new Date(session.startsAt).getTime() < Date.now()) {
      return {
        ok: false,
        error: 'Nie można rezerwować zakończonej sesji.',
        code: 'past',
      };
    }

    const idempotencyKey = buildIdempotencyKey({
      sessionId: input.sessionId,
      email: input.purchaserEmail,
      quantity: input.quantity,
      firstName: input.purchaserFirstName,
      lastName: input.purchaserLastName,
    });

    const existing = store.bookings.find(
      (b) =>
        b.idempotencyKey === idempotencyKey &&
        (b.status === 'confirmed' ||
          b.status === 'pending' ||
          b.status === 'awaiting_payment')
    );
    if (existing) {
      return {
        ok: true,
        booking: existing,
        session,
        reused: true,
      };
    }

    const remaining = session.capacity - session.reservedCount;
    if (input.quantity > remaining) {
      return {
        ok: false,
        error:
          remaining <= 0
            ? 'Brak wolnych miejsc na ten termin.'
            : `Pozostało tylko ${remaining} miejsc.`,
        code: remaining <= 0 ? 'sold_out' : 'capacity',
      };
    }

    const now = new Date().toISOString();
    const booking: LocalBooking = {
      id: randomUUID(),
      bookingReference: generateReference(),
      sessionId: session.id,
      quantity: input.quantity,
      status: 'confirmed',
      purchaserEmail: input.purchaserEmail.trim().toLowerCase(),
      purchaserFirstName: input.purchaserFirstName.trim(),
      purchaserLastName: input.purchaserLastName.trim(),
      purchaserPhone: input.purchaserPhone.trim(),
      customerNotes: input.customerNotes?.trim() ?? '',
      marketingConsent: input.marketingConsent,
      termsAcceptedAt: now,
      privacyPolicyVersion: input.privacyPolicyVersion,
      unitPriceGrossGrosz: session.priceGrossGrosz,
      totalPriceGrossGrosz: session.priceGrossGrosz * input.quantity,
      currency: session.currency || 'PLN',
      participants: input.participants,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
      cancelReason: null,
    };

    session.reservedCount += input.quantity;
    if (session.reservedCount >= session.capacity) {
      session.status = 'sold_out';
    }
    session.updatedAt = now;
    store.bookings.push(booking);

    return { ok: true, booking, session, reused: false };
  });
}

export async function listLocalBookings(): Promise<LocalBooking[]> {
  return withStoreLock((store) =>
    [...store.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function getLocalBookingByReference(
  reference: string
): Promise<LocalBooking | null> {
  return withStoreLock((store) => {
    return (
      store.bookings.find(
        (b) => b.bookingReference.toLowerCase() === reference.toLowerCase()
      ) ?? null
    );
  });
}

export async function updateLocalBookingStatus(
  bookingId: string,
  status: LocalBooking['status'],
  reason?: string
): Promise<LocalBooking> {
  return withStoreLock((store) => {
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error('Rezerwacja nie istnieje');
    const prev = booking.status;
    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    if (status === 'cancelled' && prev !== 'cancelled') {
      booking.cancelledAt = booking.updatedAt;
      booking.cancelReason = reason ?? null;
      const session = store.sessions.find((s) => s.id === booking.sessionId);
      if (session) {
        session.reservedCount = Math.max(
          0,
          session.reservedCount - booking.quantity
        );
        if (
          session.status === 'sold_out' &&
          session.reservedCount < session.capacity
        ) {
          session.status = 'scheduled';
        }
        session.updatedAt = booking.updatedAt;
      }
    }
    return booking;
  });
}

export async function appendLocalOutbox(
  email: Omit<LocalOutboxEmail, 'id' | 'createdAt' | 'status'> & {
    status?: LocalOutboxEmail['status'];
  }
): Promise<LocalOutboxEmail> {
  // Outbox writes are allowed in development even outside BOOKING_LOCAL_MODE
  // so Resend-less environments can still capture confirmation emails.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Local email outbox cannot be used in production');
  }

  const write = (store: LocalStore) => {
    const record: LocalOutboxEmail = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: email.status ?? 'sent',
      bookingId: email.bookingId,
      type: email.type,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      providerMessageId: email.providerMessageId ?? `local-${Date.now()}`,
      errorMessage: email.errorMessage ?? null,
    };
    store.outbox.push(record);
    return record;
  };

  if (isBookingLocalMode()) {
    return withStoreLock(write);
  }

  assertBookingLocalModeAllowed();
  const store = readStoreUnlocked();
  const record = write(store);
  writeStoreUnlocked(store);
  return record;
}

export async function listLocalOutbox(): Promise<LocalOutboxEmail[]> {
  return withStoreLock((store) =>
    [...store.outbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function replaceLocalSessions(
  sessions: LocalSession[]
): Promise<void> {
  await withStoreLock((store) => {
    store.sessions = sessions;
  });
}

export function getLocalStorePaths() {
  return { dir: STORE_DIR, store: STORE_PATH };
}
