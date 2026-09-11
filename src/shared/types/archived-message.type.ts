export type ArchivedMessage = {
  createdAt: Date;
  content: string;
  authorTag: string;
  attachments: readonly string[];
};
