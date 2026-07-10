// aurelius/router/proposalsRouter.ts — the review surface's backend.
// Mounted at /api/proposals. This is where Cole rules on what Aurelius
// proposed: nothing enters Living Knowledge without passing through here
// (or an explicit in-chat confirmation).

import { Router, type Request, type Response } from "express";
import { getAllPendingProposals, resolveProposal } from "../knowledge/proposals.ts";
import { prisma } from "../core/db/prisma.ts";

export const proposalsRouter = Router();

proposalsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    res.json({ proposals: await getAllPendingProposals() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

proposalsRouter.post("/:id/resolve", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { decision, correctedValue, note } = req.body ?? {};
    if (!["confirmed", "denied", "corrected"].includes(decision)) {
      return res.status(400).json({ error: "decision must be confirmed | denied | corrected" });
    }
    if (decision === "corrected" && correctedValue === undefined) {
      return res.status(400).json({ error: "corrected requires correctedValue" });
    }
    const row = await prisma.knowledgeProposal.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: "not found" });

    const resolved = await resolveProposal({
      operatorId: row.operatorId,
      proposalId: id,
      decision,
      coleResponseText: note ?? `${decision} via review surface`,
      correctedValue,
    });
    res.json({ proposal: resolved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});
