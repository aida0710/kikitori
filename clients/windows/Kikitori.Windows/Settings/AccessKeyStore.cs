using System.Runtime.InteropServices;
using System.Text;
using Kikitori.Windows.Native;

namespace Kikitori.Windows.Settings;

/// <summary>
/// アクセスキーを Windows の資格情報マネージャー（汎用資格情報 "Kikitori/AccessKey"）に置く。
/// 中身は cmdkey と同じ UTF-16 にする（cmdkey /generic:Kikitori/AccessKey /pass:… でも入れられるように）。
/// </summary>
internal static class AccessKeyStore
{
    private const string TargetName = "Kikitori/AccessKey";

    public static string? Read()
    {
        if (!NativeMethods.CredRead(TargetName, NativeMethods.CRED_TYPE_GENERIC, 0, out var pointer))
        {
            return null;
        }
        try
        {
            var credential = Marshal.PtrToStructure<NativeMethods.CREDENTIAL>(pointer);
            if (credential.CredentialBlobSize == 0)
            {
                return null;
            }
            var bytes = new byte[credential.CredentialBlobSize];
            Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
            return Encoding.Unicode.GetString(bytes);
        }
        finally
        {
            NativeMethods.CredFree(pointer);
        }
    }

    public static void Write(string accessKey)
    {
        var bytes = Encoding.Unicode.GetBytes(accessKey);
        var blob = Marshal.AllocHGlobal(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, blob, bytes.Length);
            var credential = new NativeMethods.CREDENTIAL
            {
                Type = NativeMethods.CRED_TYPE_GENERIC,
                TargetName = TargetName,
                CredentialBlobSize = (uint)bytes.Length,
                CredentialBlob = blob,
                Persist = NativeMethods.CRED_PERSIST_LOCAL_MACHINE,
                UserName = "kikitori",
            };
            if (!NativeMethods.CredWrite(ref credential, 0))
            {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            }
        }
        finally
        {
            Marshal.FreeHGlobal(blob);
        }
    }

    public static void Delete()
    {
        NativeMethods.CredDelete(TargetName, NativeMethods.CRED_TYPE_GENERIC, 0);
    }
}
