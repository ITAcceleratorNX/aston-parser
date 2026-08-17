export const ENTITIES = {
  profile: {
    name: "profile",
    kind: "get",
    path: "user/profile",
    sprint: 1,
    description: "Current user profile",
  },
  workspaces: {
    name: "workspaces",
    kind: "get",
    path: "workspaces",
    sprint: 1,
    description: "Accessible workspaces",
  },
  workspace: {
    name: "workspace",
    kind: "get",
    path: "workspaces/{workspace_id}",
    sprint: 1,
    description: "Workspace details and members",
  },
  projects: {
    name: "projects",
    kind: "get",
    path: "workspaces/{workspace_id}/projects",
    sprint: 1,
    description: "Projects inside a workspace",
  },
  metrics: {
    name: "metrics",
    kind: "dashboard",
    path: "workspaces/{workspace_id}/dashboards/byProjects",
    sprint: 1,
    description: "Core advertising metrics grouped by project",
  },
  leads: {
    name: "leads",
    kind: "dashboard",
    path: "workspaces/{workspace_id}/dashboards/leads",
    sprint: 1,
    description: "Leads",
  },
  qleads: {
    name: "qleads",
    kind: "dashboard",
    path: "workspaces/{workspace_id}/dashboards/qLeads",
    sprint: 1,
    description: "Qualified leads",
  },
  campaigns: {
    name: "campaigns",
    kind: "dashboard",
    path: "workspaces/{workspace_id}/dashboards/byAdCampaigns",
    sprint: 2,
    description: "Campaign metrics",
  },
  adsets: {
    name: "adsets",
    kind: "dashboard",
    path: "workspaces/{workspace_id}/dashboards/byAdSets",
    sprint: 2,
    description: "Ad set metrics",
  },
  ads: {
    name: "ads",
    kind: "dashboard",
    path: "workspaces/{workspace_id}/dashboards/byAds",
    sprint: 2,
    description: "Ad metrics",
  },
  sales: {
    name: "sales",
    kind: "dashboard",
    path: "workspaces/{workspace_id}/dashboards/sales",
    sprint: 2,
    description: "Sales / deals",
  },
};

export const ALL_ENTITIES = Object.keys(ENTITIES);
export const SPRINT1_ENTITIES = ALL_ENTITIES.filter((name) => ENTITIES[name].sprint === 1);
export const SPRINT2_ENTITIES = ALL_ENTITIES.filter((name) => ENTITIES[name].sprint === 2);
export const METRIC_ENTITIES = new Set(["metrics", "campaigns", "adsets", "ads"]);
export const LEAD_LIKE_ENTITIES = new Set(["leads", "qleads", "sales"]);

export function resolveEntities(selection) {
  if (!selection || selection === "all" || selection === "*") return [...ALL_ENTITIES];
  if (selection === "sprint1") return [...SPRINT1_ENTITIES];
  if (selection === "sprint2") return [...SPRINT2_ENTITIES];
  const names = selection.split(",").map((item) => item.trim()).filter(Boolean);
  const unknown = names.filter((name) => !ENTITIES[name]);
  if (unknown.length) throw new Error(`Unknown entities: ${unknown.join(", ")}`);
  return names;
}

export function fillPath(template, workspaceId) {
  return template.replaceAll("{workspace_id}", workspaceId);
}
