import { buildCollection } from "firecms";


// title: title,
// category: category,
// rating: interestLevel,
// headline: headline,
// tags: similarTokensSlugs,
// message: message,
// data: JSON.parse(text),

export const analysisMetaCollection = buildCollection({
  name: "Analysis Meta",
  path: "analysis-meta",
  group: "Main",
  icon: "Analytics",
  properties: {
    tokenAddress: {
      name: "Token Address",
      dataType: "string",
    },
    headline: {
      name: "headline",
      dataType: "string",
    },
    tags: {
      name: "tags",
      dataType: "string",
    },
    message: {
      name: "message",
      dataType: "string",
    },

    title: {
      name: "title",
      dataType: "string",
    },
    category: {
      name: "category",
      dataType: "string",
    },
    rating: {
      name: "Rating",
      dataType: "number",
    },
    reasoning: {
      name: "reasoning",
      dataType: "string",
    },
    data: {
      name: "data",
      dataType: "string",
    },
    createdAt: {
      name: "Created At",
      dataType: "date",
      readOnly: true,
      mode: 'date_time',
      autoValue: "on_create"
    },
    updateAt: {
      name: "Updated At",
      dataType: "date",
      readOnly: true,
      mode: 'date_time',
      autoValue: "on_update"
    },
  },
  permissions: {
    create: true,
    delete: true,
  },
  initialSort: ["createdAt", "desc"]
})