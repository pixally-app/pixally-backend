export interface ZapfyImageMessage {
  url: string;
  mimetype: string;
  caption?: string;
}

export interface ZapfyDocumentMessage {
  url: string;
  mimetype: string;
  fileName?: string;
  caption?: string;
}

export interface ZapfyMessageContent {
  imageMessage?: ZapfyImageMessage;
  documentMessage?: ZapfyDocumentMessage;
  documentWithCaptionMessage?: ZapfyDocumentMessage;
}

export interface ZapfyMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  messageUuid?: string;
  participant?: string;
  senderPn?: string;
  jid?: string;
}

export interface ZapfyNewMessageData {
  key: ZapfyMessageKey;
  message: ZapfyMessageContent;
  messageTimestamp: number;
  status: number;
}

export interface ZapfyMessageUpdate {
  message: unknown;
  messageStubType: number;
  key?: ZapfyMessageKey;
}

export interface ZapfyMessageUpdateData {
  key: ZapfyMessageKey;
  update: ZapfyMessageUpdate;
}

export interface ZapfyNewMessagePayload {
  type: 'NEW-MESSAGE';
  instanceKey: string;
  id: string;
  data: ZapfyNewMessageData;
}

export interface ZapfyMessageUpdatedPayload {
  type: 'MESSAGE-UPDATED';
  instanceKey: string;
  id: string;
  data: ZapfyMessageUpdateData[];
}

export interface ZapfyInstanceStatusPayload {
  type: 'INSTANCE-CONNECTED' | 'INSTANCE-DISCONNECTED';
  instanceKey: string;
  data: null;
}

export type ZapfyWebhookPayload =
  | ZapfyNewMessagePayload
  | ZapfyMessageUpdatedPayload
  | ZapfyInstanceStatusPayload;
