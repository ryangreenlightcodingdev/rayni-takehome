import React, { useEffect, useState } from "react";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

// Removing unused ErrorResponse interface to satisfy linter

const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenDetails, setTokenDetails] = useState<TokenResponse | null>(null);

  // Prefer values from backend to avoid mismatch
  const [clientId, setClientId] = useState<string | null>(null);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  // Scopes we want from Google Drive
  const scope = "https://www.googleapis.com/auth/drive.readonly";

  // Fetch OAuth config from backend on mount
  useEffect(() => {
    fetch("http://localhost:4000/auth/config")
      .then((r) => r.json())
      .then((cfg) => {
        const computedRedirect = `${window.location.origin}/`;
        setClientId(cfg.client_id || import.meta.env.VITE_GOOGLE_CLIENT_ID || null);
        setRedirectUri(cfg.redirect_uri || computedRedirect);
      })
      .catch(() => {
        const fallbackRedirect = `${window.location.origin}/`;
        setClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID || null);
        setRedirectUri(import.meta.env.VITE_GOOGLE_REDIRECT_URI || fallbackRedirect);
      });
  }, []);

  // Redirect user to Google OAuth login
  const handleLogin = () => {
    setError(null);
    if (!clientId || !redirectUri) {
      setError("OAuth config not loaded");
      return;
    }
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&access_type=offline&prompt=consent`;
    window.location.href = authUrl;
  };

  // Handle the redirect back to our app
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const errorParam = urlParams.get("error");

    // Handle OAuth errors from Google
    if (errorParam) {
      setError(`Google OAuth error: ${errorParam}`);
      return;
    }

    if (code && !accessToken && !isLoading) {
      if (!clientId || !redirectUri) {
        setError("Missing Vite env vars: VITE_GOOGLE_CLIENT_ID or VITE_GOOGLE_REDIRECT_URI");
        return;
      }
      setIsLoading(true);
      setError(null);
      
      console.log("Exchanging authorization code for tokens...");
      
      // Send code to backend
      fetch(`http://localhost:4000/auth/callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
        method: "GET",
        headers: { 
          "Content-Type": "application/json" 
        },
      })
        .then(async (res) => {
          const data = await res.json();
          
          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
          }
          
          return data;
        })
        .then((data: TokenResponse) => {
          console.log("Token exchange successful:", data);
          setAccessToken(data.access_token);
          setTokenDetails(data);
          setError(null);
          
          // Clear the URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          console.error("Token exchange failed:", err);
          setError(`Failed to exchange code for tokens: ${err.message}`);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [accessToken, isLoading]);

  const handleLogout = () => {
    setAccessToken(null);
    setTokenDetails(null);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Google Drive Integration
        </h1>

        {isLoading && (
          <div className="text-center mb-6">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Exchanging authorization code...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Authentication Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!accessToken ? (
          <div className="text-center">
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Connect Google Drive
            </button>
            <p className="mt-4 text-sm text-gray-600">
              Click to authenticate with your Google account
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Successfully Connected!</h3>
                <p className="text-sm text-gray-500">Your Google Drive is now accessible</p>
              </div>
            </div>

            {tokenDetails && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Token Details:</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <p><span className="font-medium">Access Token:</span> {tokenDetails.access_token.substring(0, 20)}...</p>
                  {tokenDetails.refresh_token && (
                    <p><span className="font-medium">Refresh Token:</span> {tokenDetails.refresh_token.substring(0, 20)}...</p>
                  )}
                  {tokenDetails.expires_in && (
                    <p><span className="font-medium">Expires In:</span> {tokenDetails.expires_in} seconds</p>
                  )}
                  {tokenDetails.token_type && (
                    <p><span className="font-medium">Token Type:</span> {tokenDetails.token_type}</p>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
