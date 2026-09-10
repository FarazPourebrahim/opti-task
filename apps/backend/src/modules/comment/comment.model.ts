export type CreateCommentInput = {
  body: string;
  parentCommentId?: string | null;
  mentionedUserIds?: string[];
};

export type UpdateCommentInput = {
  body: string;
};

export type AddAttachmentInput = {
  filename: string;
  contentType?: string | null;
  sizeBytes?: number | null;
};
