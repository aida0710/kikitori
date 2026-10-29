/**
 * 文字をクリップボードへ写す。HTTP の LAN（安全な接続でない）では navigator.clipboard が無いので、
 * 見えない textarea を選んで execCommand で写す。
 */
export async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // 許可されなかったときは下の方法を試す
    }
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  // ダイアログ（<dialog>）の外に置くと、モーダルの間は選べないので、開いているダイアログの中に置く
  (document.querySelector("dialog[open]") ?? document.body).appendChild(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  return copied;
}
