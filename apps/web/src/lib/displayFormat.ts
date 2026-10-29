// 表の中で桁がそろうように、月日と時分は 2 桁にする（2026/10/28 09:12）
const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

/** 日時を、表示言語の書き方で年月日と時分まで出す。 */
export function formatDateTime(value: string, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, DATE_TIME_FORMAT).format(new Date(value));
}

/** 音声の長さ（ミリ秒）を「1:05」の形にする。 */
export function formatAudioLength(milliseconds: number): string {
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
