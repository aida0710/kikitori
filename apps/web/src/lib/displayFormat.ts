/** 日時を、表示言語の書き方で年月日と時分まで出す。 */
export function formatDateTime(value: string, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** 音声の長さ（ミリ秒）を「1:05」の形にする。 */
export function formatAudioLength(milliseconds: number): string {
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
