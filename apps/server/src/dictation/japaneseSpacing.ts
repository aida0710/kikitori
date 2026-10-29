/**
 * 日本語の文の中の、英字・数字の前後の空白を取り除く。
 * 清書の指示でも頼んでいるが、モデルによっては空白を入れることがあるので、清書のあとに必ず通す。
 * 英字どうしのあいだの空白（"Claude Code" など）は残す。
 */
const JAPANESE = String.raw`[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆、。，．・「」『』（）！？]`;
const LATIN_OR_DIGIT = "[A-Za-z0-9]";
const SPACE_AFTER_JAPANESE = new RegExp(`(${JAPANESE})[ \\u3000]+(?=${LATIN_OR_DIGIT})`, "gu");
const SPACE_BEFORE_JAPANESE = new RegExp(`(${LATIN_OR_DIGIT})[ \\u3000]+(?=${JAPANESE})`, "gu");

export function removeSpacesAroundLatin(text: string): string {
  return text.replace(SPACE_AFTER_JAPANESE, "$1").replace(SPACE_BEFORE_JAPANESE, "$1");
}
