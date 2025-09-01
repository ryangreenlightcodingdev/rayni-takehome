import React, { useEffect, useState } from "react";

const App: React.FC = () => {
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
  const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

  // Load gapi + picker
  useEffect(() => {
    const loadScript = () => {
      if ((window as any).gapi) {
        (window as any).gapi.load("client:auth2", async () => {
          await (window as any).gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            scope: SCOPES,
          });
          setGapiLoaded(true);
        });
      }

      if ((window as any).google) {
        setPickerLoaded(true);
      }
    };

    loadScript();
  }, []);

  const handleAuthClick = async () => {
    const GoogleAuth = (window as any).gapi.auth2.getAuthInstance();
    try {
      const user = await GoogleAuth.signIn();
      const token = user.getAuthResponse().access_token;
      console.log("✅ Google Access Token:", token);
      openPicker(token);
    } catch (err) {
      console.error("❌ Auth error", err);
    }
  };

  const openPicker = (accessToken: string) => {
    if (!(window as any).google || !(window as any).google.picker) {
      console.error("❌ Picker API not loaded");
      return;
    }

    const view = new (window as any).google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    const picker = new (window as any).google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setCallback(pickerCallback)
      .build();

    picker.setVisible(true);
  };

  const pickerCallback = (data: any) => {
    if (data.action === (window as any).google.picker.Action.PICKED) {
      const docs = data.docs;
      console.log("✅ Files selected:", docs);
      setSelectedFiles(docs);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">Google Drive Integration</h1>

      <button
        onClick={handleAuthClick}
        disabled={!gapiLoaded || !pickerLoaded}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
      >
        {gapiLoaded && pickerLoaded
          ? "Pick a File from Google Drive"
          : "Loading..."}
      </button>

      {selectedFiles.length > 0 && (
        <div className="mt-8 w-full max-w-lg">
          <h2 className="text-xl font-semibold mb-4">Selected Files</h2>
          <ul className="space-y-2">
            {selectedFiles.map((file, idx) => (
              <li
                key={idx}
                className="p-3 bg-white rounded shadow border border-gray-200"
              >
                📄 {file.name} <br />
                <span className="text-sm text-gray-500">{file.id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default App;
