import { Platform } from 'react-native';

export const AVATAR_EMOJIS: string[] = [
  '😝', '🥶', '😆', '😍',
  '🤑', '😂', '😡', '😘',
  '😭', '😈', '🤩', '😵',
  '🥳', '🤯', '🤠', '🥸',
  '😎', '🤗', '🙃', '😇',
  '🤖', '👻', '👽', '🎃',
];

export const EMOJI_FONT_FAMILY: string | undefined = Platform.select({
  web: '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color","Android Emoji",sans-serif',
  default: undefined,
});
