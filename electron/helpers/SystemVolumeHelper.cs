using System;
using System.Globalization;
using System.Runtime.InteropServices;

namespace MovieScheduleAlarmAudio
{
    internal enum EDataFlow { eRender, eCapture, eAll }
    internal enum ERole { eConsole, eMultimedia, eCommunications }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceEnumerator
    {
        int NotImplemented();
        [PreserveSig] int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDevice
    {
        [PreserveSig] int Activate(ref Guid interfaceId, int classContext, IntPtr activationParameters, [MarshalAs(UnmanagedType.IUnknown)] out object instance);
    }

    [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioEndpointVolume
    {
        int RegisterControlChangeNotify(IntPtr notify);
        int UnregisterControlChangeNotify(IntPtr notify);
        int GetChannelCount(out uint count);
        int SetMasterVolumeLevel(float levelDb, Guid context);
        int SetMasterVolumeLevelScalar(float level, Guid context);
        int GetMasterVolumeLevel(out float levelDb);
        int GetMasterVolumeLevelScalar(out float level);
        int SetChannelVolumeLevel(uint channel, float levelDb, Guid context);
        int SetChannelVolumeLevelScalar(uint channel, float level, Guid context);
        int GetChannelVolumeLevel(uint channel, out float levelDb);
        int GetChannelVolumeLevelScalar(uint channel, out float level);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid context);
        int GetMute(out bool mute);
    }

    internal static class SystemVolume
    {
        private static readonly Guid EndpointVolumeId = typeof(IAudioEndpointVolume).GUID;

        // 取得 Windows 預設多媒體播放裝置的 Core Audio 主音量介面。
        private static IAudioEndpointVolume GetEndpoint()
        {
            Type enumeratorType = Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"));
            IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(enumeratorType);
            try
            {
                IMMDevice device;
                Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device));
                try
                {
                    object endpointObject;
                    Guid endpointVolumeId = EndpointVolumeId;
                    Marshal.ThrowExceptionForHR(device.Activate(ref endpointVolumeId, 23, IntPtr.Zero, out endpointObject));
                    return (IAudioEndpointVolume)endpointObject;
                }
                finally
                {
                    Marshal.FinalReleaseComObject(device);
                }
            }
            finally
            {
                Marshal.FinalReleaseComObject(enumerator);
            }
        }

        // 讀取 Windows 主音量並轉換為 0 至 100 的整數百分比。
        internal static int GetVolume()
        {
            IAudioEndpointVolume endpoint = GetEndpoint();
            try
            {
                float level;
                Marshal.ThrowExceptionForHR(endpoint.GetMasterVolumeLevelScalar(out level));
                return (int)Math.Round(Math.Max(0, Math.Min(1, level)) * 100, MidpointRounding.AwayFromZero);
            }
            finally
            {
                Marshal.FinalReleaseComObject(endpoint);
            }
        }

        // 將 0 至 100 的整數百分比寫入 Windows 主音量，並回讀實際結果。
        internal static int SetVolume(int volume)
        {
            IAudioEndpointVolume endpoint = GetEndpoint();
            try
            {
                float level = Math.Max(0, Math.Min(100, volume)) / 100f;
                Marshal.ThrowExceptionForHR(endpoint.SetMasterVolumeLevelScalar(level, Guid.Empty));
            }
            finally
            {
                Marshal.FinalReleaseComObject(endpoint);
            }
            return GetVolume();
        }
    }

    internal static class Program
    {
        // 逐行處理受限的 get／set 命令，讓 Electron 重用單一 Helper 程序。
        private static void Main()
        {
            string line;
            while ((line = Console.ReadLine()) != null)
            {
                ProcessRequest(line);
            }
        }

        // 驗證命令格式與音量範圍，再輸出可由 Main Process 配對的單行結果。
        private static void ProcessRequest(string line)
        {
            string[] parts = line.Split('|');
            string requestId = parts.Length > 0 ? parts[0] : "0";
            try
            {
                int volume;
                if (parts.Length == 2 && parts[1] == "get")
                {
                    volume = SystemVolume.GetVolume();
                }
                else if (parts.Length == 3 && parts[1] == "set")
                {
                    int requestedVolume;
                    if (!int.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out requestedVolume) || requestedVolume < 0 || requestedVolume > 100)
                    {
                        throw new ArgumentOutOfRangeException("volume", "系統音量必須是 0 至 100 的整數");
                    }
                    volume = SystemVolume.SetVolume(requestedVolume);
                }
                else
                {
                    throw new InvalidOperationException("不支援的系統音量命令");
                }
                Console.WriteLine(requestId + "|ok|" + volume.ToString(CultureInfo.InvariantCulture));
            }
            catch (Exception error)
            {
                string safeMessage = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(error.Message));
                Console.WriteLine(requestId + "|error|" + safeMessage);
            }
            Console.Out.Flush();
        }
    }
}
