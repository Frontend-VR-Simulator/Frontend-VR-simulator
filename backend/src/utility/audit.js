import supabase from "../config/supabaseConfig.js";

// Audit writes never block or fail the request that triggered them.
export async function recordAudit({ event, category = "platform", actorId = null, actorLabel, outcome = "Successful" }) {
  try {
    const { error } = await supabase.from("audit_events").insert({
      event: String(event).slice(0, 300),
      category,
      actor_id: actorId,
      actor_label: actorLabel || "System",
      outcome,
    });
    if (error) console.error("Audit write failed:", error.message);
  } catch (error) {
    console.error("Audit write failed:", error.message);
  }
}
