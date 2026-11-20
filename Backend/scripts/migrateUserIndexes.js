import "dotenv/config";
import mongoose from "mongoose";
import { isValidIndianPhone, normalizeEmail, normalizeGoogleId, normalizePhone } from "../src/utils/userFields.js";

const apply = process.argv.includes("--apply");
const collectionName = "users";
const optionalUniqueFields = ["phone", "email", "googleId"];

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 2 ? `***${digits.slice(-2)}` : "***";
}

function maskEmail(value) {
  const [name = "", domain = ""] = String(value || "").split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

function groupDuplicates(users, field, normalize, mask) {
  const groups = new Map();
  for (const user of users) {
    const rawValue = field === "phone" ? user.phone || user.mobile : user[field];
    if (typeof rawValue !== "string" || !rawValue.trim()) continue;
    const normalized = normalize(rawValue);
    if (!normalized) continue;
    const entries = groups.get(normalized) || [];
    entries.push({
      id: String(user._id),
      name: user.name || "",
      email: user.email ? maskEmail(user.email) : "",
    });
    groups.set(normalized, entries);
  }
  return [...groups.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([value, entries]) => ({
      value: mask(value),
      users: entries,
    }));
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.db.collection(collectionName);
  const [indexes, nullPhoneCount, emptyPhoneCount, missingPhoneCount, nullEmailCount, emptyEmailCount, nullGoogleIdCount, emptyGoogleIdCount, userRows] = await Promise.all([
    users.indexes(),
    users.countDocuments({ phone: { $type: 10 } }),
    users.countDocuments({ phone: { $type: "string", $regex: /^\s*$/ } }),
    users.countDocuments({ phone: { $exists: false } }),
    users.countDocuments({ email: { $type: 10 } }),
    users.countDocuments({ email: { $type: "string", $regex: /^\s*$/ } }),
    users.countDocuments({ googleId: { $type: 10 } }),
    users.countDocuments({ googleId: { $type: "string", $regex: /^\s*$/ } }),
    users.find(
      { $or: [{ phone: { $exists: true } }, { mobile: { $exists: true } }, { email: { $exists: true } }, { googleId: { $exists: true } }] },
      { projection: { name: 1, email: 1, phone: 1, mobile: 1, googleId: 1 } }
    ).toArray(),
  ]);

  const duplicatePhoneGroups = groupDuplicates(userRows, "phone", normalizePhone, maskPhone);
  const duplicateEmailGroups = groupDuplicates(userRows, "email", normalizeEmail, maskEmail);
  const duplicateGoogleIdGroups = groupDuplicates(userRows, "googleId", normalizeGoogleId, (value) => `${String(value).slice(0, 3)}***`);
  const invalidPhoneUsers = userRows
    .filter((user) => {
      const phone = normalizePhone(user.phone || user.mobile);
      return phone && !isValidIndianPhone(phone);
    })
    .map((user) => ({ id: String(user._id), name: user.name || "", email: user.email ? maskEmail(user.email) : "" }));

  const legacyIndexes = indexes.filter((index) =>
    optionalUniqueFields.some((field) =>
      index.key?.[field] === 1 &&
      index.unique &&
      !index.partialFilterExpression
    ) && index.name !== "_id_"
  );
  const report = {
    mode: apply ? "apply" : "dry-run",
    database: mongoose.connection.name,
    phoneNullCount: nullPhoneCount,
    phoneEmptyOrWhitespaceCount: emptyPhoneCount,
    phoneMissingCount: missingPhoneCount,
    emailNullCount: nullEmailCount,
    emailEmptyOrWhitespaceCount: emptyEmailCount,
    googleIdNullCount: nullGoogleIdCount,
    googleIdEmptyOrWhitespaceCount: emptyGoogleIdCount,
    legacyUniqueIndexesToDrop: legacyIndexes.map(({ name, key, sparse }) => ({ name, key, sparse: !!sparse })),
    duplicatePhoneGroups,
    duplicateEmailGroups,
    duplicateGoogleIdGroups,
    invalidPhoneUsers,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!apply) return;
  if (duplicatePhoneGroups.length || duplicateEmailGroups.length || duplicateGoogleIdGroups.length) {
    throw new Error("Apply stopped: resolve the duplicate users listed above before migrating unique indexes.");
  }
  if (invalidPhoneUsers.length) {
    throw new Error("Apply stopped: correct the invalid phone values listed above before migrating.");
  }

  const operations = [];
  for (const user of userRows) {
    const set = {};
    const unset = {};
    const rawPhone = user.phone || user.mobile;
    const phone = normalizePhone(rawPhone);
    if (phone) {
      set.phone = phone;
      set.mobile = phone;
    } else {
      unset.phone = "";
      unset.mobile = "";
    }

    const email = normalizeEmail(user.email);
    if (email) set.email = email;
    else unset.email = "";

    const googleId = normalizeGoogleId(user.googleId);
    if (googleId) set.googleId = googleId;
    else unset.googleId = "";

    operations.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          ...(Object.keys(set).length ? { $set: set } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
      },
    });
  }
  if (operations.length) await users.bulkWrite(operations, { ordered: true });

  for (const index of legacyIndexes) {
    await users.dropIndex(index.name);
  }
  for (const field of optionalUniqueFields) {
    await users.createIndex(
      { [field]: 1 },
      {
        unique: true,
        partialFilterExpression: { [field]: { $type: "string" } },
        name: `${field}_partial_unique`,
      }
    );
  }
  console.log("User contact fields and partial unique indexes migrated successfully.");
}

main()
  .catch((error) => {
    console.error("User index migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
