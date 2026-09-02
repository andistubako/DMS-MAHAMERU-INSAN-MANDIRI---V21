import fetch from "node-fetch";

async function run() {
  try {
    // Generate a valid token
    const tokenPayload = {
      _id: "usr-owner-1",
      role: "OWNER",
      email: "owner@example.com"
    };
    const jwt = (await import("jsonwebtoken")).default;
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "SUPER_SECRET_KEY");

    const r = await fetch('http://localhost:3000/api/dashboard/owner', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const d = await r.json();
    console.log(JSON.stringify(d).substring(0, 500));
  } catch (e) { console.error(e); }
}
run();
