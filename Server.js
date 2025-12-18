dotenv.config();
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "./supabaseClient.js"; // Import Supabase client
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const app = express();

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors());
app.use(express.json());

/* ---------------- JWT ---------------- */
const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

/* ---------------- ROOT ---------------- */
app.get("/", (req, res) => {
  res.json({ message: "Server running 🚀" });
});

/* ---------------- LOGIN ---------------- */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Missing credentials" });

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("password", password)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0)
      return res.status(401).json({ message: "Invalid login" });

    const user = users[0];
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- AUTH MIDDLEWARE ---------------- */
function authenticateToken(req, res, next) {
  const auth = req.headers["authorization"];
  const token = auth && auth.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

/* ---------------- MEMBERS ---------------- */
app.get("/members", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("members")
      .select("id, name, group_id, has_access_today, qr_code, entered")
      .order("id");

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/members/:id/enter", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  try {
    const { data: member, error } = await supabase
      .from("members")
      .select("has_access_today")
      .eq("id", id)
      .single();

    if (error) return res.status(404).json({ message: "Member not found" });
    if (!member.has_access_today)
      return res.status(403).json({ message: "No access today" });

    await supabase
      .from("members")
      .update({ entered: true })
      .eq("id", id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/hisenter/:id", async (req, res) => {
  const memberId = parseInt(req.params.id, 10);
  if (isNaN(memberId)) return res.status(400).json({ message: "Invalid id" });

  try {
    const { data, error } = await supabase
      .from("members")
      .select("entered")
      .eq("id", memberId)
      .single();

    if (error) return res.status(404).json({ message: "Member not found" });
    res.json({ entered: data.entered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- ACCESS ROUTES ---------------- */
app.post("/members/haveAccess/bulk", async (req, res) => {
  const { memberIds, accessStates } = req.body;
  if (!Array.isArray(memberIds) || !Array.isArray(accessStates) || memberIds.length !== accessStates.length) {
    return res.status(400).json({ message: "Invalid data" });
  }

  try {
    for (let i = 0; i < memberIds.length; i++) {
      await supabase
        .from("members")
        .update({ has_access_today: accessStates[i] })
        .eq("id", memberIds[i]);
    }
    res.json({ success: true, updated: memberIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Bulk update failed" });
  }
});

app.post("/members/haveAccess/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  try {
    const { data, error } = await supabase
      .from("members")
      .select("has_access_today, entered")
      .eq("id", id)
      .single();

    if (error) return res.status(404).json({ message: "Member not found" });

    const newAccess = !data.has_access_today;
    const newEntered = newAccess ? false : data.entered;

    await supabase
      .from("members")
      .update({ has_access_today: newAccess, entered: newEntered })
      .eq("id", id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
});

/* ---------------- GROUPS ---------------- */
app.get("/my-groups/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const { data: groups, error } = await supabase
      .from("groups")
      .select("*")
      .eq("leader_id", userId);

    if (error) throw error;

    const detailedGroups = await Promise.all(
      groups.map(async (group) => {
        const { data: members, error } = await supabase
          .from("members")
          .select("id, name, has_access_today, entered")
          .eq("group_id", group.id);
        if (error) throw error;
        return { ...group, members };
      })
    );

    res.json({ groups: detailedGroups });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/groups", async (req, res) => {
  try {
    const { data: groups, error } = await supabase
      .from("groups")
      .select("*")
      .order("id");

    if (error) throw error;

    const detailedGroups = await Promise.all(
      groups.map(async (group) => {
        const { data: members, error } = await supabase
          .from("members")
          .select("id, name, has_access_today, entered, qr_code")
          .eq("group_id", group.id);

        if (error) throw error;

        return {
          id: group.id,
          name: group.name,
          membersCount: members.length,
          accessToday: members.filter(m => m.has_access_today).length,
          entered: members.filter(m => m.entered).length,
          memberDetails: members
        };
      })
    );

    res.json(detailedGroups);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

app.get("/members/:id", async (req, res) => {
  const memberId = parseInt(req.params.id, 10);
  if (isNaN(memberId)) return res.status(400).json({ message: "Invalid ID" });

  try {
    const { data, error } = await supabase
      .from("members")
      .select("id, has_access_today, entered, group_id, name")
      .eq("id", memberId)
      .single();

    if (error) return res.status(404).json({ message: "Member not found" });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- GENERATE ALL QR CODES ---------------- */
app.post("/generate-all-qr", async (req, res) => {
  try {
    const { data: members, error } = await supabase.from("members").select("*");
    if (error) throw error;

    for (const member of members) {
      if (member.qr_code) continue;

      const qrData = {
        id: member.id,
        name: member.name,
        access: member.has_access_today || false,
        group_id: member.group_id
      };

      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrData));
      await supabase
        .from("members")
        .update({ qr_code: qrCodeBase64 })
        .eq("id", member.id);
    }
    res.json({ message: "All QR codes generated successfully ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error ❌" });
  }
});

/* ---------------- ADD / DELETE MEMBERS ---------------- */
app.post("/groups/addmembers", async (req, res) => {
  const { groupId, name } = req.body;
  if (!name) return res.status(400).json({ error: "Member name required" });

  try {
    const { data: newMember, error } = await supabase
      .from("members")
      .insert([{ name, group_id: groupId, has_access_today: false, entered: false }])
      .select()
      .single();

    if (error) throw error;

    const qrData = { id: newMember.id, name: newMember.name, access: newMember.has_access_today, group_id: newMember.group_id };
    const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrData));
    await supabase.from("members").update({ qr_code: qrCodeBase64 }).eq("id", newMember.id);

    res.json({ ...newMember, qr_code: qrCodeBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error adding member" });
  }
});

app.delete("/members/delete/:memberId", async (req, res) => {
  const { memberId } = req.params;
  try {
    const { error } = await supabase.from("members").delete().eq("id", memberId);
    if (error) throw error;
    res.json({ message: "Member deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting member" });
  }
});

/* ---------------- SERVE REACT FRONTEND ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../front/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../front/build", "index.html"));
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
