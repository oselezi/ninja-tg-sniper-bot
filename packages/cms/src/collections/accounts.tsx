import { buildCollection } from "firecms";

export const accountsCollection = buildCollection({
  name: "Accounts",
  path: "accounts",
  group: "Main",
  icon: "People",
  properties: {
    username: {
      name: "Username",
      dataType: "string",
      readOnly: true,
    },
    walletPubKey: {
      name: "Wallet",
      dataType: "string",
      readOnly: true,
    },
    createdAt: {
      name: "Created At",
      dataType: "date",
      readOnly: true,
      mode: 'date_time'
    },
    enabledAccount: {
      name: "Enabled",
      dataType: "boolean",
    },
    enabledAccountAt: {
      name: "Enabled At",
      dataType: "date",
      mode: 'date_time',
      readOnly: true,
    },
    waitlistPosition: {
      name: "Waitlist Position",
      dataType: "number",
      readOnly: true,
    }
  },
  permissions: {
    create: false,
    delete: false,
  },
  callbacks: {
    onPreSave: async ({ values }) => {
      if (values.enabledAccount) {
        values.enabledAccountAt = new Date();
      }

      if (!values.enabledAccount) {
        values.enabledAccountAt = null;
      }

      return values;
    },
    onFetch: async ({ entity }) => {
      entity.values.enabledAccount = entity.values.enabledAccount === undefined || entity.values.enabledAccount;

      return entity;
    }
  }
})