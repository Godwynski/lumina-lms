import sharp from "sharp";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  sanitizeStudentId, 
  fileNamesFor, 
  CARD_ASSET_BUCKET, 
  getDeterministicQrUrl, 
  getDeterministicProfileUrl,
  publicObjectUrl,
  isDeterministicProfileUrl,
  resolveStudentId
} from "./library-card-assets";

const PROFILE_SIZE = 300;
const PROFILE_QUALITY = 82;

type ProfileRow = {
  id: string;
  email: string | null;
  student_id: string | null;
  avatar_url: string | null;
};

type LibraryCardRow = {
  card_number: string;
};

export async function checkStaticLibraryCardAssets(opts: {
  studentId: string;
}) {
  const admin = createAdminClient();
  const { qr, profile } = fileNamesFor(opts.studentId);

  const [qrList, profileList] = await Promise.all([
    admin.storage.from(CARD_ASSET_BUCKET).list("", { limit: 1, search: qr }),
    admin.storage.from(CARD_ASSET_BUCKET).list("", { limit: 1, search: profile }),
  ]);

  const qrExists = Boolean(qrList.data?.some((item) => item.name === qr));
  const profileExists = Boolean(
    profileList.data?.some((item) => item.name === profile)
  );

  return {
    studentId: sanitizeStudentId(opts.studentId),
    qrExists,
    profileExists,
    qrUrl: getDeterministicQrUrl(opts.studentId),
    profileUrl: getDeterministicProfileUrl(opts.studentId),
  };
}

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

  const { error: createError } = await admin.storage.createBucket(
    CARD_ASSET_BUCKET,
    {
      public: true,
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
  studentId: string;
  qrPayload: string;
  force: boolean;
}) {
  const admin = createAdminClient();
  const { qr } = fileNamesFor(opts.studentId);

  if (!opts.force) {
    const { error: existingError } = await admin.storage
      .from(CARD_ASSET_BUCKET)
      .download(qr);

    if (!existingError) {
      return qr;
    }
  }

  const qrBuffer = await QRCode.toBuffer(opts.qrPayload, {
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
  studentId: string;
  sourceBuffer: Buffer;
}) {
  const admin = createAdminClient();
  const { profile } = fileNamesFor(opts.studentId);

  const outputBuffer = await sharp(opts.sourceBuffer)
    .resize(PROFILE_SIZE, PROFILE_SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: PROFILE_QUALITY, mozjpeg: true })
    .toBuffer();

  const { error: uploadError } = await admin.storage
    .from(CARD_ASSET_BUCKET)
    .upload(profile, outputBuffer, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) throw uploadError;

  const { data } = admin.storage.from(CARD_ASSET_BUCKET).getPublicUrl(profile);
  return data.publicUrl || publicObjectUrl(profile);
}

async function fetchRemoteAvatarBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) return null;

  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
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
    .select("id, email, student_id, avatar_url")
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
  });

  if (!studentId) {
    throw new Error("Unable to resolve student ID for card assets");
  }

  if (!profile.student_id) {
    await admin
      .from("profiles")
      .update({ student_id: studentId })
      .eq("id", opts.userId);
  }

  const { data: rawLibraryCard } = await admin
    .from("library_cards")
    .select("card_number")
    .eq("user_id", opts.userId)
    .maybeSingle();

  const libraryCard = rawLibraryCard as LibraryCardRow | null;

  await ensureQrImage({
    studentId,
    qrPayload: libraryCard?.card_number || studentId,
    force: Boolean(opts.forceQrRegeneration),
  });

  let profileUrlToSave: string | null = null;
  const deterministicExists = isDeterministicProfileUrl(profile.avatar_url);
  const candidateAvatarUrl = profile.avatar_url || opts.fallbackAvatarUrl || null;

  if (opts.uploadedProfileBuffer) {
    profileUrlToSave = await uploadProfilePhoto({
      studentId,
      sourceBuffer: opts.uploadedProfileBuffer,
    });
  } else if (!deterministicExists && candidateAvatarUrl) {
    const remoteBuffer = await fetchRemoteAvatarBuffer(candidateAvatarUrl);
    if (remoteBuffer) {
      profileUrlToSave = await uploadProfilePhoto({
        studentId,
        sourceBuffer: remoteBuffer,
      });
    }
  }

  if (profileUrlToSave && profileUrlToSave !== profile.avatar_url) {
    await admin
      .from("profiles")
      .update({ avatar_url: profileUrlToSave })
      .eq("id", opts.userId);
  }

  const { qr } = fileNamesFor(studentId);
  const { data: qrData } = admin.storage.from(CARD_ASSET_BUCKET).getPublicUrl(qr);

  return {
    studentId,
    qrUrl: qrData.publicUrl || publicObjectUrl(qr),
    profileUrl: profileUrlToSave || profile.avatar_url,
  };
}
