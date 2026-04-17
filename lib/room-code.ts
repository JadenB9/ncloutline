import { customAlphabet } from "nanoid";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@/lib/constants";

const generator = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

export function generateRoomCode() {
  return generator();
}

export function isValidRoomCode(code: string) {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}
