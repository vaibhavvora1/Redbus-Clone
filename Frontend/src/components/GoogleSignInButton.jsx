import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
let googleScriptPromise;
let googleInitializationPromise;
let initializedClientId = "";
let nextCallbackId = 0;
let activeCallbackId = null;
const credentialCallbacks = new Map();

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const alreadyLoaded = Boolean(script?.dataset.loaded);
    if (alreadyLoaded) {
      reject(new Error("Google Identity Services did not initialize."));
      return;
    }

    const onLoad = () => {
      script.dataset.loaded = "true";
      if (window.google?.accounts?.id) resolve();
      else reject(new Error("Google Identity Services failed to load."));
    };
    const onError = () => reject(new Error("Google Identity Services failed to load."));
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
    }
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!script.isConnected) document.head.appendChild(script);
  });
  return googleScriptPromise;
}

function initializeGoogleIdentity(clientId) {
  if (initializedClientId && initializedClientId !== clientId) {
    return Promise.reject(new Error("Google Sign-In is already initialized with a different client ID."));
  }
  if (googleInitializationPromise) return googleInitializationPromise;

  googleInitializationPromise = loadGoogleIdentityScript().then(() => {
    if (initializedClientId) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        const callback = credentialCallbacks.get(activeCallbackId) ||
          [...credentialCallbacks.values()].at(-1);
        callback?.(response);
      },
    });
    initializedClientId = clientId;
  });
  return googleInitializationPromise;
}

export default function GoogleSignInButton({ onError, className = "" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef(null);
  const handleSuccessRef = useRef(null);
  const onErrorRef = useRef(onError);
  const navigateRef = useRef(navigate);
  const locationRef = useRef(location);
  const loginWithGoogleRef = useRef(loginWithGoogle);
  const handleSuccess = useCallback(async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      const error = "No credential received from Google.";
      setErrorMessage(error);
      onErrorRef.current?.(error);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const result = await loginWithGoogleRef.current(credentialResponse.credential);
      if (result.success) {
        const destination = locationRef.current.state?.from ||
          (result.user?.role === "ADMIN" ? "/admin" : "/");
        navigateRef.current(destination, { replace: true });
      } else {
        const error = result.error || "Google sign-in failed. Please try again.";
        setErrorMessage(error);
        onErrorRef.current?.(error);
      }
    } catch (requestError) {
      const error = requestError.message || "An unexpected error occurred during Google sign-in.";
      setErrorMessage(error);
      onErrorRef.current?.(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    onErrorRef.current = onError;
    navigateRef.current = navigate;
    locationRef.current = location;
    loginWithGoogleRef.current = loginWithGoogle;
  }, [onError, navigate, location, loginWithGoogle]);

  useEffect(() => {
    handleSuccessRef.current = handleSuccess;
  }, [handleSuccess]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;

    const callbackId = ++nextCallbackId;
    credentialCallbacks.set(callbackId, (response) => handleSuccessRef.current?.(response));
    const container = buttonRef.current;
    const activate = () => { activeCallbackId = callbackId; };
    container?.addEventListener("pointerdown", activate);
    container?.addEventListener("focusin", activate);
    let mounted = true;

    initializeGoogleIdentity(GOOGLE_CLIENT_ID)
      .then(() => {
        if (!mounted || !container) return;
        window.google.accounts.id.renderButton(container, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: "360",
        });
      })
      .catch((error) => {
        if (mounted) {
          setErrorMessage(error.message || "Google Sign-In could not be initialized.");
        }
      });

    return () => {
      mounted = false;
      credentialCallbacks.delete(callbackId);
      if (activeCallbackId === callbackId) activeCallbackId = null;
      container?.removeEventListener("pointerdown", activate);
      container?.removeEventListener("focusin", activate);
      container?.replaceChildren();
    };
  }, []);

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      {(errorMessage || !GOOGLE_CLIENT_ID) && (
        <div className="w-full mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2" role="alert">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMessage || "Google Client ID is not configured. Set VITE_GOOGLE_CLIENT_ID in Frontend/.env."}</span>
        </div>
      )}
      {!GOOGLE_CLIENT_ID ? (
        <button type="button" disabled
          className="w-full flex items-center justify-center gap-3 border border-gray-200 text-gray-500 font-semibold py-2.5 rounded-full text-xs shadow-xs">
          Google Sign-In unavailable
        </button>
      ) : (
        <div className={`relative w-full min-h-10 flex justify-center ${loading ? "pointer-events-none opacity-60" : ""}`}>
          <div ref={buttonRef} className="w-full flex justify-center" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs text-gray-500 font-medium" aria-live="polite">
              Signing in with Google...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
