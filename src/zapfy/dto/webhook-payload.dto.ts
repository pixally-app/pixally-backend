export interface EvolutionMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  participant?: string;
}

export interface EvolutionMediaMessage {
  mimetype: string;
  caption?: string;
  url?: string;
  mediaKey?: string;
  directPath?: string;
}

export interface EvolutionDocumentWithCaption {
  message?: {
    documentMessage?: EvolutionMediaMessage;
  };
}

export interface EvolutionMessageContent {
  imageMessage?: EvolutionMediaMessage;
  documentMessage?: EvolutionMediaMessage;
  documentWithCaptionMessage?: EvolutionDocumentWithCaption;
}

export interface EvolutionMessagesUpsertData {
  key: EvolutionMessageKey;
  message: EvolutionMessageContent;
  messageTimestamp: number;
  pushName?: string;
}

export interface EvolutionConnectionUpdateData {
  state: 'open' | 'close' | 'connecting' | 'refused';
  statusReason?: number;
}

export interface EvolutionMessagesUpsertPayload {
  event: 'messages.upsert';
  instance: string;
  data: EvolutionMessagesUpsertData;
}

export interface EvolutionConnectionUpdatePayload {
  event: 'connection.update';
  instance: string;
  data: EvolutionConnectionUpdateData;
}

export interface EvolutionGenericPayload {
  event: string;
  instance: string;
  data: unknown;
}

export type EvolutionWebhookPayload =
  | EvolutionMessagesUpsertPayload
  | EvolutionConnectionUpdatePayload
  | EvolutionGenericPayload;
