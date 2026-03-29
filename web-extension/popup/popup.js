const BACKEND_URL = "https://13.235.99.232.nip.io";
const FRONTEND_URL = "https://13.235.99.232.nip.io";
const POOL_ID = "ap-south-1_ex2kwv017";
const CLIENT_ID = "652l3a735n8siojspepglnaid2";

// Views
const viewLogin = document.getElementById('view-login');
const viewMain = document.getElementById('view-main');
const errorMsg = document.getElementById('login-error');
const userEmailDisplay = document.getElementById('user-email-display');
const btnLogin = document.getElementById('btn-login');

const resultsView = document.getElementById('results-view');
const resultCard = document.getElementById('result-card');
const resultIconBox = document.getElementById('result-icon-box');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const resultActions = document.getElementById('result-actions');
let currentCredentialId = null;

// Event Listeners for Nav
document.getElementById('btn-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL}/dashboard` });
});

document.getElementById('btn-verify-page').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL}/verify` });
});

document.getElementById('btn-register').addEventListener('click', () => {
  chrome.tabs.create({ url: `${FRONTEND_URL}/register` });
});

document.getElementById('btn-logout').addEventListener('click', () => {
  chrome.storage.local.remove(['cvpa_token', 'cvpa_email'], () => {
    showView('login');
  });
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['cvpa_token', 'cvpa_email', 'cvpa_last_result'], (result) => {
    // Check credentials
    if (result.cvpa_token && result.cvpa_email) {
      userEmailDisplay.textContent = result.cvpa_email;
      showView('main');
    } else {
      showView('login');
    }
    
    // Check for pending results
    if (result.cvpa_last_result) {
      showResultCard(result.cvpa_last_result);
      chrome.action.setBadgeText({ text: '' }); // clear native badge
    }
  });

  // Listen for background tasks finishing while popup is actively open
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.cvpa_last_result) {
      const newVal = changes.cvpa_last_result.newValue;
      if (newVal) {
        showResultCard(newVal);
        chrome.action.setBadgeText({ text: '' });
      }
    }
  });
});

function showView(view) {
  if (view === 'login') {
    viewLogin.style.display = 'block';
    viewMain.style.display = 'none';
  } else {
    viewLogin.style.display = 'none';
    viewMain.style.display = 'block';
  }
}

function showResultCard(resObj) {
  resultsView.classList.remove('hidden');
  resultCard.className = `result-card ${resObj.type}`;
  resultTitle.textContent = resObj.title;
  resultMessage.textContent = resObj.message;
  currentCredentialId = resObj.credentialId || null;

  // Icons
  if (resObj.type === 'success') {
    resultIconBox.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
  } else if (resObj.type === 'warning') {
    resultIconBox.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
  } else {
    resultIconBox.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
  }

  // Show credential ID if present
  const credentialBox = document.getElementById('result-credential');
  const credentialIdEl = document.getElementById('result-credential-id');
  if (currentCredentialId && credentialBox && credentialIdEl) {
    credentialIdEl.textContent = currentCredentialId;
    credentialBox.classList.remove('hidden');
  } else if (credentialBox) {
    credentialBox.classList.add('hidden');
  }

  if (currentCredentialId) {
    resultActions.classList.remove('hidden');
  } else {
    resultActions.classList.add('hidden');
  }
}

document.getElementById('btn-dismiss-result').addEventListener('click', () => {
  chrome.storage.local.remove('cvpa_last_result', () => {
    resultsView.classList.add('hidden');
    currentCredentialId = null;
  });
});

document.getElementById('btn-download-manifest').addEventListener('click', async () => {
  if (!currentCredentialId) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/videos/${currentCredentialId}`);
    if (!res.ok) throw new Error("Failed to fetch full video record");
    const video = await res.json();
    
    const manifestData = {
        ...video.manifest,
        signature: video.signature,
        credential_id: video.credential_id,
        manifest_hash: video.manifest_hash,
        creator_email: video.creator_email || "N/A"
    };
    const blob = new Blob([JSON.stringify(manifestData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest-${video.credential_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Error downloading manifest: " + err.message);
  }
});

document.getElementById('btn-download-pdf').addEventListener('click', async () => {
  if (!currentCredentialId) return;
  try {
    document.getElementById('btn-download-pdf').disabled = true;
    document.getElementById('btn-download-pdf').textContent = "Generating...";
    const res = await fetch(`${BACKEND_URL}/api/videos/${currentCredentialId}`);
    if (!res.ok) throw new Error("Failed to fetch full video record");
    const video = await res.json();
    generateCVPA_PDF(video);
  } catch (err) {
    alert("Error generating PDF: " + err.message);
  } finally {
    document.getElementById('btn-download-pdf').disabled = false;
    document.getElementById('btn-download-pdf').innerHTML = `<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>Certificate`;
  }
});

// Login logic
document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  errorMsg.classList.add('hidden');
  btnLogin.disabled = true;
  btnLogin.textContent = "Signing In...";

  try {
    if (typeof AmazonCognitoIdentity === 'undefined') {
      throw new Error("AmazonCognitoIdentity SDK failed to load. Likely a CSP issue.");
    }

    const authenticationData = { Username: email, Password: password };
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);
    const poolData = { UserPoolId: POOL_ID, ClientId: CLIENT_ID };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: function (result) {
        const idToken = result.getIdToken().getJwtToken();
        
        // Initialize identity
        fetch(`${BACKEND_URL}/api/identity/me`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
        .then(res => res.ok ? res.json() : null)
        .then(() => {
          chrome.storage.local.set({ 
            'cvpa_token': idToken, 
            'cvpa_email': email 
          }, () => {
            userEmailDisplay.textContent = email;
            showView('main');
            btnLogin.disabled = false;
            btnLogin.textContent = "Sign In";
          });
        })
        .catch(err => {
          errorMsg.textContent = "Identity Init Error: " + err.message;
          errorMsg.classList.remove('hidden');
          btnLogin.disabled = false;
          btnLogin.textContent = "Sign In";
        });
      },
      onFailure: function (err) {
        errorMsg.textContent = "Cognito Auth Error: " + (err.message || JSON.stringify(err));
        errorMsg.classList.remove('hidden');
        btnLogin.disabled = false;
        btnLogin.textContent = "Sign In";
      }
    });

  } catch (err) {
    errorMsg.textContent = "Execution Error: " + err.message + "\nStack: " + err.stack;
    errorMsg.classList.remove('hidden');
    btnLogin.disabled = false;
    btnLogin.textContent = "Sign In";
  }
});

// Drag and drop logic
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const btnBrowse = document.getElementById('btn-browse');
const uploadStatus = document.getElementById('upload-status');

btnBrowse.addEventListener('click', () => { fileInput.click(); });

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if (dt.files && dt.files.length > 0) processFile(dt.files[0]);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0]);
});

function processFile(file) {
  if (!file.type.startsWith('video/')) {
    uploadStatus.textContent = "Error: Please select a video file.";
    uploadStatus.className = "mt-3 text-center text-sm font-medium text-red-400";
    uploadStatus.classList.remove('hidden');
    return;
  }
  
  uploadStatus.textContent = "Reading file...";
  uploadStatus.className = "mt-3 text-center text-sm font-medium text-slate-300";
  uploadStatus.classList.remove('hidden');
  
  chrome.storage.local.get(['cvpa_token'], (result) => {
    if (!result.cvpa_token) {
      uploadStatus.textContent = "Not logged in.";
      return;
    }
    
    uploadStatus.textContent = "Uploading to CVPA...";
    
    const formData = new FormData();
    formData.append("file", file, file.name);

    fetch(`${BACKEND_URL}/api/intake/upload`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${result.cvpa_token}` },
      body: formData
    })
    .then(res => res.json().then(data => ({ status: res.status, ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (ok && data.task_id) {
        uploadStatus.textContent = "Processing and Signing in background...";
        pollStatus(data.task_id, result.cvpa_token);
      } else {
        uploadStatus.textContent = `Upload failed: ${data.detail || 'Error'}`;
        uploadStatus.className = "mt-3 text-center text-sm font-medium text-red-400";
      }
    })
    .catch(err => {
      uploadStatus.textContent = "Network error during upload.";
      uploadStatus.className = "mt-3 text-center text-sm font-medium text-red-400";
    });
  });
}

function pollStatus(taskId, token) {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/intake/status/${taskId}`);
      if (!res.ok) return;
      const statusData = await res.json();
      
      if (statusData.status === "complete") {
        clearInterval(interval);
        uploadStatus.textContent = "Finalizing signature...";
        
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
           uploadStatus.classList.add('hidden');
           // Pass result to storage natively mimicking background context
           const resObj = {
             type: 'success', title: 'Video Sealed', message: 'Digital signature finalized and registered!', credentialId: finalData.credential_id
           };
           chrome.storage.local.set({ cvpa_last_result: resObj });
           showResultCard(resObj);
        } else {
           const err = await sigRes.json();
           uploadStatus.textContent = `Signing failed: ${err.detail || 'Error'}`;
           uploadStatus.className = "mt-3 text-center text-sm font-medium text-red-400";
        }
      } else if (statusData.status === "error") {
        clearInterval(interval);
        uploadStatus.textContent = `Processing error: ${statusData.error || 'Failed'}`;
        uploadStatus.className = "mt-3 text-center text-sm font-medium text-red-400";
      } else {
        uploadStatus.textContent = `Processing: ${statusData.progress}% (${statusData.step})`;
      }
    } catch (e) {
      clearInterval(interval);
      uploadStatus.textContent = "Connection lost during polling.";
      uploadStatus.className = "mt-3 text-center text-sm font-medium text-red-400";
    }
  }, 1000);
}

// -------------------------------------------------------------
// PDF Generator (Ported from Frontend)
// -------------------------------------------------------------
function generateCVPA_PDF(video) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const formatFileSize = (bytes) => {
      if (bytes === 0) return "0 B";
      const k = 1024, sizes = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const W = 210, M = 16, CW = W - M * 2;
  const NAVY = [12, 35, 75], BLUE = [28, 78, 158], LTBLUE = [232, 238, 250];
  const BLACK = [18, 18, 28], DKGRAY = [55, 65, 80], MIDGRAY = [100, 110, 125];
  const FGRAY = [160, 168, 180], WHITE = [255, 255, 255], GREEN = [22, 115, 65];

  const m = video.manifest || {};
  const iden = m.identity || {};
  const ast = m.asset || {};
  const ps = m.perceptual_signature || {};
  const hashSeq = ps.hash_sequence || [];
  const frameCount = ps.frame_count ?? hashSeq.length;
  const creatorName = iden.creator_name || video.creator_name || "Author";
  const creatorEmail = video.creator_email || iden.creator_email || "N/A";
  const sealedAt = video.sealed_at ? new Date(video.sealed_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : "N/A";
  const genDate = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

  const sf = (style, size, color) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color); };

  const drawFooter = (pageLabel) => {
      doc.setDrawColor(...FGRAY); doc.setLineWidth(0.3); doc.line(M, 280, W - M, 280);
      sf("normal", 8, FGRAY); doc.text(`CVPA Certificate  |  ${pageLabel}`, M, 286);
      sf("normal", 8, FGRAY); doc.text(`Generated: ${genDate}`, W - M, 286, { align: "right" });
  };

  const sectionTitle = (title, y) => {
      doc.setFillColor(...BLUE); doc.rect(M, y - 3, 3, 7, "F");
      sf("bold", 10, NAVY); doc.text(title.toUpperCase(), M + 6, y + 1);
      doc.setDrawColor(...LTBLUE); doc.setLineWidth(0.4); doc.line(M + 6, y + 2.5, W - M, y + 2.5);
      return y + 10;
  };

  const detailRow = (label, value, y, labelW = 46) => {
      sf("bold", 10, DKGRAY); doc.text(label, M, y);
      sf("normal", 10, BLACK); const lines = doc.splitTextToSize(value, CW - labelW);
      doc.text(lines, M + labelW, y);
      return y + 5.5 * lines.length + 1.5;
  };

  const techRow = (label, value, y, labelW = 46) => {
      sf("bold", 9, DKGRAY); doc.text(label, M, y);
      doc.setFont("courier", "normal"); doc.setFontSize(8.5); doc.setTextColor(...BLACK);
      const lines = doc.splitTextToSize(value || "N/A", CW - labelW); doc.text(lines, M + labelW, y);
      return y + 4.5 * lines.length + 2;
  };

  const PAGE_BOTTOM = 268;
  const checkPageBreak = (y, neededHeight = 16) => {
      if (y + neededHeight > PAGE_BOTTOM) {
          drawFooter("Technical Evidence (cont.)");
          doc.addPage();
          doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F");
          sf("bold", 14, WHITE); doc.text("CVPA Technical Evidence Report (cont.)", M, 20);
          return 48;
      }
      return y;
  };

  // PAGE 1
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F");
  sf("bold", 18, WHITE); doc.text("CVPA Content Authenticity Certificate", M, 16);
  doc.setDrawColor(60, 90, 140); doc.setLineWidth(0.3); doc.line(M, 19, W - M, 19);
  sf("normal", 9, [160, 180, 210]); doc.text(`Issued: ${sealedAt}`, M, 27);

  const badgeW = 38, badgeH = 14, badgeX = W - M - badgeW, badgeY = 10;
  doc.setFillColor(...GREEN); doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, "F");
  doc.setDrawColor(...WHITE); doc.setLineWidth(0.4); doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, "S");
  sf("bold", 10, WHITE); doc.text("SEALED", badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.5, { align: "center" });

  sf("normal", 8, MIDGRAY); doc.text("Page 1 of 2  —  Overview for Content Owners, Journalists & Legal Teams", M, 40);

  let y = 47;
  const introText = "This certificate proves that the video listed below was created and digitally signed by its author using the CVPA system.";
  const introLines = doc.splitTextToSize(introText, CW - 10);
  const introPadV = 7;
  const introBoxH = introLines.length * 5.5 + introPadV * 2;
  doc.setFillColor(...LTBLUE); doc.roundedRect(M, y, CW, introBoxH, 2, 2, "F");
  sf("normal", 10, NAVY); doc.text(introLines, M + 5, y + introPadV + 3.5);
  y += introBoxH + 6;

  y = sectionTitle("Video Details", y);
  y = detailRow("File Name", video.filename || "N/A", y);
  y = detailRow("File Size", formatFileSize(video.file_size || 0), y);
  y = detailRow("Date Sealed", sealedAt, y);
  y = detailRow("Author", creatorName, y);
  y = detailRow("Author Email", creatorEmail, y);
  y = detailRow("Credential ID", video.credential_id || "N/A", y);
  y += 6;

  y = sectionTitle("How CVPA Protects This Video", y);
  const cardW = (CW - 8) / 3, cardH = 56;
  const cards = [
      { num: "01", title: "SHA-256 Fingerprint", body: "A unique mathematical fingerprint of every byte in the video. If even one pixel changes, this fingerprint changes — making tampering instantly detectable." },
      { num: "02", title: "Perceptual Hash (pHash)", body: "A visual fingerprint sampled from frames across the video. Catches the same content even after re-encoding, compression, or platform re-upload." },
      { num: "03", title: "Ed25519 Signature", body: "The author's private key — which never leaves their device — signs the entire evidence package. Only the matching public key can confirm authenticity." }
  ];
  cards.forEach((c, i) => {
      const cx = M + i * (cardW + 4);
      doc.setFillColor(...LTBLUE); doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
      doc.setFillColor(...BLUE); doc.roundedRect(cx, y, 3, cardH, 1, 1, "F");
      sf("bold", 20, BLUE); doc.text(c.num, cx + 8, y + 14);
      sf("bold", 9.5, NAVY); const titleLines = doc.splitTextToSize(c.title, cardW - 12); doc.text(titleLines, cx + 8, y + 22);
      sf("normal", 8.5, DKGRAY); const bodyLines = doc.splitTextToSize(c.body, cardW - 12); doc.text(bodyLines, cx + 8, y + 22 + titleLines.length * 5.5 + 3);
  });
  y += cardH + 8;

  y = sectionTitle("How to Verify This Video", y);
  const verifySteps = [
      ["1", "Visit the CVPA Verification page in your browser."],
      ["2", "Upload the video file you received."],
      ["3", "CVPA computes the SHA-256 and pHash of the uploaded file and compares them against the registry."],
      ["4", "A green Authenticated result confirms the video is original and the signature is valid."]
  ];
  verifySteps.forEach(([num, text]) => {
      doc.setFillColor(...BLUE); doc.circle(M + 4, y - 1, 4, "F");
      sf("bold", 9, WHITE); doc.text(num, M + 4, y + 0.5, { align: "center" });
      sf("normal", 10, BLACK); const lines = doc.splitTextToSize(text, CW - 14); doc.text(lines, M + 12, y);
      y += 6.5 * lines.length + 3;
  });

  drawFooter("Page 1 of 2");

  // PAGE 2
  doc.addPage();
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F");
  sf("bold", 18, WHITE); doc.text("CVPA Technical Evidence Report", M, 16);
  doc.setDrawColor(60, 90, 140); doc.setLineWidth(0.3); doc.line(M, 19, W - M, 19);
  sf("normal", 9, [160, 180, 210]); doc.text("Cryptographic hashes, digital signature & perceptual fingerprint data", M, 27);
  sf("normal", 8, MIDGRAY); doc.text("Page 2 of 2  —  For Technical Verification, DMCA Filings & Legal Audit", M, 40);

  y = 48;
  y = sectionTitle("Hard Binding — SHA-256 File Fingerprint", y);
  y = techRow("SHA-256 Hash", ast.sha256 || video.sha256 || "N/A", y);
  y = techRow("Manifest Hash", video.manifest_hash || "N/A", y);
  y += 5;

  y = checkPageBreak(y, 50);
  y = sectionTitle("Digital Signature — Ed25519", y);
  y = techRow("Algorithm", "Ed25519", y);
  y = techRow("Signature", video.signature || "N/A", y);
  y = techRow("Public Key", video.public_key || iden.creator_pub_key || "N/A", y);
  y = techRow("Key Fingerprint", video.key_fingerprint || iden.key_fingerprint || "N/A", y);
  y += 5;

  y = checkPageBreak(y, 40);
  y = sectionTitle("Soft Binding — Perceptual Hash Sequence (dHash)", y);
  y = techRow("Algorithm", "dHash — difference hash of sampled frames", y);
  y = techRow("Sampling Rate", ps.sampling_rate || "1 frame per 2 seconds", y);
  y = techRow("Frames Processed", String(frameCount), y);

  if (hashSeq.length > 0) {
      y += 2;
      y = checkPageBreak(y, 20);
      sf("bold", 9, DKGRAY); doc.text("Hash Sequence", M, y); y += 5;

      const rowH = 5.5;
      const colW = CW / 2 - 4;
      const rowsNeeded = Math.ceil(hashSeq.length / 2);
      let rowStart = 0;

      while (rowStart < rowsNeeded) {
          const availableH = PAGE_BOTTOM - y - 6;
          const rowsFit = Math.max(1, Math.floor(availableH / rowH));
          const rowsThisPage = Math.min(rowsFit, rowsNeeded - rowStart);
          const boxH = rowsThisPage * rowH + 6;

          doc.setFillColor(240, 244, 252);
          doc.roundedRect(M, y, CW, boxH, 2, 2, "F");
          doc.setDrawColor(...LTBLUE); doc.setLineWidth(0.3);
          doc.roundedRect(M, y, CW, boxH, 2, 2, "S");
          doc.setFont("courier", "normal"); doc.setFontSize(8); doc.setTextColor(...BLACK);

          for (let r = 0; r < rowsThisPage; r++) {
              const globalRow = rowStart + r;
              for (let col = 0; col < 2; col++) {
                  const idx = globalRow * 2 + col;
                  if (idx >= hashSeq.length) break;
                  const hx = M + 4 + col * (colW + 8);
                  const hy = y + 5 + r * rowH;
                  doc.setTextColor(...BLUE); doc.setFontSize(7.5);
                  doc.text(`[${String(idx + 1).padStart(2, "0")}]`, hx, hy);
                  doc.setTextColor(...BLACK); doc.setFontSize(8);
                  doc.text(hashSeq[idx], hx + 10, hy);
              }
          }

          y += boxH + 4;
          rowStart += rowsThisPage;

          if (rowStart < rowsNeeded) {
              drawFooter("Technical Evidence (cont.)");
              doc.addPage();
              doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F");
              sf("bold", 14, WHITE); doc.text("CVPA Technical Evidence Report (cont.)", M, 20);
              y = 48;
              sf("bold", 9, DKGRAY); doc.text("Hash Sequence (cont.)", M, y); y += 5;
          }
      }
      y += 2;
  }

  y = checkPageBreak(y, 60);
  y = sectionTitle("Manifest Metadata", y);
  y = techRow("Manifest Version", m.manifest_version || m.version || "1.1", y);
  y = techRow("Timestamp (UTC)", m.timestamp || video.sealed_at || "N/A", y);
  y = techRow("Credential ID", video.credential_id || "N/A", y);
  y = techRow("Creator", creatorName, y);
  y = techRow("Creator Email", creatorEmail, y);
  y = techRow("File Name", video.filename || "N/A", y);
  y = techRow("File Size", `${video.file_size || 0} bytes  (${formatFileSize(video.file_size || 0)})`, y);
  y = techRow("Producer", m.producer || "CVPA Provenance System", y);

  drawFooter("Page 2 of 2");

  doc.save(`cvpa-certificate-${(video.credential_id || "unknown").slice(0, 12)}.pdf`);
}
