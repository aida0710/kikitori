/** 言い淀みだけの区切りかどうか。こうした区切りは清書に回さず、空の文として返す（Claude を呼ぶ 1 秒を省く）。 */

// 文字起こしが言い淀みとして書くことの多い語。これ以外の語が 1 つでもあれば、清書に回す
const FILLER_ONLY = /^(?:[\s、。,.!?！？ー〜~]|えー?と?|ええ|えっと|あー?|あの|あのー|うー?ん|うん|その|まあ|まー|んー?|ふーん|はい)+$/u;

export function isFillerOnly(text: string): boolean {
  return FILLER_ONLY.test(text.trim());
}
