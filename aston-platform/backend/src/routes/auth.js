import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/login", (req, res) => {
  const { login, password } = req.body || {};

  if (login === process.env.ADMIN_LOGIN && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ login }, process.env.JWT_SECRET, { expiresIn: "12h" });
    return res.json({ token, login });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

router.get("/me", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ login: payload.login });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
