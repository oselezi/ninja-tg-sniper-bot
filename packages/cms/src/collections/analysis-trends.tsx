import { buildCollection } from "firecms";

export const analysisTrendsCollection = buildCollection({
  name: "Analysis Trends",
  path: "analysis-trends",
  group: "Main",
  icon: "TrendingUp",
  properties: {
    headline: {
      name: "Headline",
      dataType: "string",
    },
    description: {
      name: "Description",
      dataType: "string",
    },
    notes: {
      name: "Notes",
      dataType: "string",
      multiline: true,
      markdown: false,
    },
    createdAt: {
      name: "Created At",
      dataType: "date",
      readOnly: true,
      mode: "date_time",
      autoValue: "on_create",
    },
    updateAt: {
      name: "Updated At",
      dataType: "date",
      readOnly: true,
      mode: "date_time",
      autoValue: "on_update",
    },
  },
  permissions: {
    create: true,
    delete: true,
  },
  initialSort: ["createdAt", "desc"],
});
