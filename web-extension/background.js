const BACKEND_URL = "http://localhost:8000";
const FRONTEND_URL = "http://localhost:3000";

// Register context menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cvpa-verify",
    title: "CVPA: Verify Specific Video File",
    contexts: ["video", "link"]
  });

  chrome.contextMenus.create({
    id: "cvpa-verify-page",
    title: "CVPA: Verify Page Video (YouTube/LinkedIn)",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "cvpa-upload",
    title: "CVPA: Upload & Sign Video File",
    contexts: ["video", "link"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "cvpa-verify-page") {
    let pageUrl = info.pageUrl;
    if (pageUrl) {
      handleVerifyUrl(pageUrl);
    } else {
      notifyPopup("error", "Error", "Could not capture the page URL.");
    }
    return;
  }

  let videoUrl = info.srcUrl || info.linkUrl;

  if (!videoUrl) {
    notifyPopup("error", "Error", "Could not determine video file location.");
    return;
  }

  if (videoUrl.startsWith('blob:')) {
    notifyPopup("error", "Unsupported", "Blob URLs are unsupported. Right-click the page background and select 'Verify Page Video' instead.");
    return;
  }

  if (info.menuItemId === "cvpa-verify") {
    handleVerify(videoUrl);
  } else if (info.menuItemId === "cvpa-upload") {
    handleUpload(videoUrl);
  }
});

async function handleVerify(videoUrl) {
  notifyPopup("loading", "Verifying", "Fetching and verifying video securely...");

  try {
    const fileBlob = await fetchVideoBlob(videoUrl);

    const formData = new FormData();
    const filename = videoUrl.split('/').pop().split('?')[0] || 'video.mp4';
    formData.append("file", fileBlob, filename);

    const response = await fetch(`${BACKEND_URL}/api/verify`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (response.ok) {
      if (result.status === "verified" || result.status === "warning") {
        const type = result.status === "verified" ? "success" : "warning";
        const msg = result.message || `Verified (${result.match_type})`;
        const creator = result.creator_info ? result.creator_info.name || 'Creator' : 'Unknown';
        notifyPopup(type, "Verification Complete", `${msg} | Signed by ${creator}`, result.credential_id);
      } else {
        notifyPopup("error", "Unverified", result.message || "Video is not authenticated.");
      }
    } else {
      notifyPopup("error", "Verification Failed", `Error: ${result.detail || 'Internal Error'}`);
    }
  } catch (error) {
    console.error("Verification error:", error);
    notifyPopup("error", "Verification Failed", "Network error. See background console.");
  }
}

async function handleVerifyUrl(url) {
  notifyPopup("loading", "Extracting Stream", "Connecting to social media server to verify video stream...");

  try {
    const response = await fetch(`${BACKEND_URL}/api/verify/url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url: url })
    });

    const result = await response.json();

    if (response.ok) {
      if (result.status === "verified" || result.status === "warning") {
        const type = result.status === "verified" ? "success" : "warning";
        const msg = result.message || `Verified (${result.match_type})`;
        const creator = result.creator_info ? result.creator_info.name || 'Creator' : 'Unknown';
        notifyPopup(type, "Verification Complete", `${msg} | Signed by ${creator}`, result.credential_id);
      } else {
        notifyPopup("error", "Unverified", result.message || "Video stream is not authenticated.");
      }
    } else {
      notifyPopup("error", "Verification Failed", `Error: ${result.detail || 'Internal Error'}`);
    }
  } catch (error) {
    console.error("URL Verification error:", error);
    notifyPopup("error", "Verification Failed", "Network error computing social stream.");
  }
}

async function handleUpload(videoUrl) {
  const data = await chrome.storage.local.get(['cvpa_token']);
  if (!data.cvpa_token) {
    notifyPopup("error", "Authentication Required", "Please open the CVPA extension and sign in first.");
    return;
  }
  const token = data.cvpa_token;

  notifyPopup("loading", "Uploading", "Fetching and securely uploading video to CVPA...");

  try {
    const fileBlob = await fetchVideoBlob(videoUrl);

    const formData = new FormData();
    const filename = videoUrl.split('/').pop().split('?')[0] || 'video.mp4';
    formData.append("file", fileBlob, filename);

    const response = await fetch(`${BACKEND_URL}/api/intake/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });

    const result = await response.json();

    if (response.ok && result.task_id) {
      notifyPopup("loading", "Processing", "Background processing and signing sequence initiated...");
      pollStatusBackground(result.task_id, token);
    } else {
      notifyPopup("error", "Upload Failed", `Error: ${result.detail || 'Failed'}`);
    }
  } catch (error) {
    console.error("Upload error:", error);
    notifyPopup("error", "Upload Failed", "Network error during upload.");
  }
}

function pollStatusBackground(taskId, token) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/intake/status/${taskId}`);
      if (!res.ok) return;
      const statusData = await res.json();
      
      if (statusData.status === "complete") {
        clearInterval(interval);
        notifyPopup("loading", "Finalizing", "Applying digital signature...");
        
        const sigRes = await fetch(`${BACKEND_URL}/api/intake/finalize-signature`, {
           method: "POST",
           headers: {
             "Authorization": `Bearer ${token}`,
             "Content-Type": "application/json"
           },
           body: JSON.stringify({ task_id: taskId })
        });
        
        if (sigRes.ok) {
           const finalData = await sigRes.json();
           notifyPopup("success", "Video Sealed", "Digital signature finalized and registered!", finalData.credential_id);
        } else {
           const err = await sigRes.json();
           notifyPopup("error", "Signing Failed", `Error: ${err.detail || 'Failed signature attachment'}`);
        }
      } else if (statusData.status === "error") {
        clearInterval(interval);
        notifyPopup("error", "Processing Failed", `Error: ${statusData.error || 'Failed task'}`);
      }
    } catch (e) {
      clearInterval(interval);
      notifyPopup("error", "Connection Error", "Connection lost during background processing.");
    }
  }, 1000);
}

async function fetchVideoBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch video from remote server");
  return await res.blob();
}

// Stores result in local storage and alerts user via extension badge
function notifyPopup(type, title, message, credentialId = null) {
  const resultObj = {
    type,
    title,
    message,
    credentialId,
    timestamp: Date.now()
  };
  
  chrome.storage.local.set({ cvpa_last_result: resultObj });

  // Only badge on completion or error, not intermediate loading steps
  if (type !== 'loading') {
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ 
      color: (type === 'success' || type === 'warning') ? '#10b981' : '#ef4444' 
    });
  }
}
