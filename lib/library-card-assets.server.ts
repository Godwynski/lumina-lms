import sharp from "sharp";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchImage } from "@/lib/fetch-image";
import {
  fileNamesFor,
  CARD_ASSET_BUCKET,
  AVATAR_BUCKET,
  cardPhotoPath,
  isDeterministicProfileUrl,
  resolveStudentId,
} from "./library-card-assets";

const PROFILE_SIZE = 300;
const PROFILE_QUALITY = 82;
const QR_URL_TTL_SECONDS = 60 * 60;

type ProfileRow = {
  id: string;
  email: string | null;
  student_id: string | null;
  avatar_url: string | null;
  role: string | null;
  status: string | null;
};

type LibraryCardRow = {
  card_number: string;
};

let bucketExistsChecked = false;

async function ensureBucketExists() {
  if (bucketExistsChecked) return;

  const admin = createAdminClient();
  const { error } = await admin.storage.getBucket(CARD_ASSET_BUCKET);

  if (!error) {
    bucketExistsChecked = true;
    return;
  }

  const isMissing =
    (error as { statusCode?: number }).statusCode === 404 ||
    /not found/i.test(error.message);

  if (!isMissing) {
    throw error;
  }

  // Private: a QR image is the library card, so it is only served through signed URLs.
  const { error: createError } = await admin.storage.createBucket(
    CARD_ASSET_BUCKET,
    {
      public: false,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    }
  );

  if (createError && !/already exists/i.test(createError.message)) {
    throw createError;
  }

  bucketExistsChecked = true;
}

async function ensureQrImage(opts: {
  cardNumber: string;
  force: boolean;
}) {
  const admin = createAdminClient();
  // Named after the card number, so a new number always gets a new image.
  const { qr } = fileNamesFor(opts.cardNumber);

  if (!opts.force) {
    const { data: existingList } = await admin.storage
      .from(CARD_ASSET_BUCKET)
      .list("", { limit: 1, search: qr });

    if (existingList && existingList.some((item) => item.name === qr)) {
      return qr;
    }
  }

  const qrBuffer = await QRCode.toBuffer(opts.cardNumber, {
    type: "png",
    width: PROFILE_SIZE,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const { error: uploadError } = await admin.storage
    .from(CARD_ASSET_BUCKET)
    .upload(qr, qrBuffer, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) throw uploadError;

  return qr;
}

async function uploadProfilePhoto(opts: {
  userId: string;
  sourceBuffer: Buffer;
}) {
  const admin = createAdminClient();
  const path = cardPhotoPath(opts.userId);

  const outputBuffer = await sharp(opts.sourceBuffer)
    .resize(PROFILE_SIZE, PROFILE_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: PROFILE_QUALITY })
    .toBuffer();

  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, outputBuffer, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) throw uploadError;

  // The path never changes, so bust caches when the photo is replaced.
  const { data } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

async function fetchAvatarBuffer(url: string) {
  // shortcut: card photos used to live in the (now private) library-cards bucket. Read those
  // with the service role so they move to the avatars bucket; remove once none are left.
  const legacyMarker = `/storage/v1/object/public/${CARD_ASSET_BUCKET}/`;
  if (url.includes(legacyMarker)) {
    const path = url.split(legacyMarker)[1].split("?")[0];
    const { data } = await createAdminClient().storage.from(CARD_ASSET_BUCKET).download(path);
    return data ? Buffer.from(await data.arrayBuffer()) : null;
  }

  try {
    return (await fetchImage(url)).buffer;
  } catch {
    return null;
  }
}

function newCardNumber() {
  // Same format as the handle_new_user trigger.
  return `LIB-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function ensureStaticLibraryCardAssets(opts: {
  userId: string;
  fallbackEmail?: string | null;
  fallbackAvatarUrl?: string | null;
  uploadedProfileBuffer?: Buffer;
  forceQrRegeneration?: boolean;
}) {
  const admin = createAdminClient();
  await ensureBucketExists();

  const { data: rawProfile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, student_id, avatar_url, role, status")
    .eq("id", opts.userId)
    .single();

  const profile = rawProfile as ProfileRow | null;

  if (profileError || !profile) {
    throw profileError || new Error("Profile not found");
  }

  const studentId = resolveStudentId({
    studentId: profile.student_id,
    email: profile.email,
    fallbackEmail: opts.fallbackEmail,
    userId: opts.userId,
    role: profile.role,
  });

  if (!studentId) {
    throw new Error("Unable to resolve student ID for card assets");
  }

  // Sync student_id in profiles to match the resolved (prefixed) format
  if (profile.student_id !== studentId) {
    await admin
      .from("profiles")
      .update({ student_id: studentId })
      .eq("id", opts.userId);
  }

  // The card number is a random LIB-… value, never the student ID: the QR encodes it, so it must
  // not be guessable from a student number (C5).
  const { data: rawLibraryCard } = await admin
    .from("library_cards")
    .select("card_number")
    .eq("user_id", opts.userId)
    .maybeSingle();

  let cardNumber = (rawLibraryCard as LibraryCardRow | null)?.card_number ?? null;
  if (!cardNumber) {
    cardNumber = newCardNumber();
    const { error: cardError } = await admin.from("library_cards").insert({
      user_id: opts.userId,
      card_number: cardNumber,
      status: profile.status || "PENDING",
      expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (cardError) throw cardError;
  }

  const qrFile = await ensureQrImage({
    cardNumber,
    force: Boolean(opts.forceQrRegeneration),
  });

  let profileUrlToSave: string | null = null;
  const candidateAvatarUrl = profile.avatar_url || opts.fallbackAvatarUrl || null;

  if (opts.uploadedProfileBuffer) {
    profileUrlToSave = await uploadProfilePhoto({
      userId: opts.userId,
      sourceBuffer: opts.uploadedProfileBuffer,
    });
  } else if (!isDeterministicProfileUrl(profile.avatar_url) && candidateAvatarUrl) {
    const remoteBuffer = await fetchAvatarBuffer(candidateAvatarUrl);
    if (remoteBuffer) {
      profileUrlToSave = await uploadProfilePhoto({
        userId: opts.userId,
        sourceBuffer: remoteBuffer,
      });
    }
  }

  if (profileUrlToSave && profileUrlToSave !== profile.avatar_url) {
    await admin
      .from("profiles")
      .update({
        avatar_url: profileUrlToSave,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.userId);
  }

  const profileUrl = profileUrlToSave || profile.avatar_url;
  const { data: signed, error: signError } = await admin.storage
    .from(CARD_ASSET_BUCKET)
    .createSignedUrl(qrFile, QR_URL_TTL_SECONDS);
  if (signError) throw signError;

  return {
    studentId,
    qrUrl: signed.signedUrl,
    profileUrl,
    qrExists: true,
    profileExists: isDeterministicProfileUrl(profileUrl),
  };
}
