import { Router } from "express";
import { LEVELS } from "../aggregate.js";
import { findBest, findWeak, spendWithoutResults } from "../analytics.js";
import { buildDataset, parseFilters } from "./metrics.js";

const router = Router();

router.get("/", (req, res) => {
  const { level = "projects", from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from and to required" });
  if (!LEVELS[level]) return res.status(400).json({ error: "Unknown level" });

  const filters = parseFilters(req.query);
  const { data, totals } = buildDataset(level, from, to, filters);
  const best = findBest(data);
  const weak = findWeak(data);
  const wastedSpend = spendWithoutResults(data);

  res.json({
    level,
    from,
    to,
    totals,
    best,
    weak: {
      ...weak,
      spendNoResults: weak.spendNoResults.slice(0, 50),
    },
    spendWithoutResults: {
      total: wastedSpend,
      count: weak.spendNoResults.length,
      items: weak.spendNoResults.slice(0, 50),
    },
  });
});

export default router;
