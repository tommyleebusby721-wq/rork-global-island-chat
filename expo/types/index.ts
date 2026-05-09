export interface UserProfile {
  id: string;
  username: string;
  avatarEmoji: string;
  islandId?: string;
  createdAt: string;
  hasRecovery?: boolean;
  dmPushEnabled?: boolean;
}

export type MessageKind = 'text' | 'image' | 'voice';

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarEmoji: string;
  kind: MessageKind;
  text?: string;
  imageUri?: string;
  voiceUri?: string;
  voiceDuration?: number;
  createdAt: number;
  expiresAt: number;
  mentions?: string[];
  reactions?: Reaction[];
}

export type RoomKind = 'island' | 'dm';
