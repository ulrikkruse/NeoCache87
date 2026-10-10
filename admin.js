const config = window.NEOCACHE_CONFIG || {};
const projectUrl = (config.SUPABASE_URL || "").replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
const publicKey = config.SUPABASE_PUBLIC_KEY || "";

const loginPanel = document.querySelector("#login-panel");
const editorPanel = document.querySelector("#editor-panel");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const itemForm = document.querySelector("#item-form");
const saveButton = document.querySelector("#save-button");
const saveStatus = document.querySelector("#save-status");
const logoutButton = document.querySelector("#logout-button");
const operatorEmail = document.querySelector("#operator-email");
const filesInput = document.querySelector("#image-files");
const fileDrop = document.querySelector("#file-drop");
const previews = document.querySelector("#image-previews");
const tagsInput = document.querySelector("#item-tags");
const knownTagsElement = document.querySelector("#known-tags");
const typeOptions = document.querySelector("#type-options");
const categoryOptions = document.querySelector("#category-options");
const folderInput = document.querySelector("#storage-folder");
const folderOptions = document.querySelector("#folder-options");
const folderStatus = document.querySelector("#folder-status");
let folderRefresh = null;
const editTagsForm = document.querySelector("#edit-tags-form");
const existingItemSelect = document.querySelector("#existing-item");
const existingItemTagsInput = document.querySelector("#existing-item-tags");
const maintenanceKnownTags = document.querySelector("#maintenance-known-tags");
const updateTagsButton = document.querySelector("#update-tags-button");
const editTagsStatus = document.querySelector("#edit-tags-status");

const recordKind = document.querySelector("#record-kind");
const musicFields = document.querySelector("#music-fields");
function syncRecordKind() {
  document.querySelector("#personal-story-field").hidden = recordKind.value !== "artifact";
  itemForm.elements.personal_story.disabled = recordKind.value !== "artifact";
  const music = recordKind.value === "music";
  const publication = ["books", "comics"].includes(recordKind.value);
  const publicationFields = document.querySelector("#publication-fields");
  publicationFields.hidden = !publication;
  publicationFields.disabled = !publication;
  musicFields.hidden = !music;
  musicFields.disabled = !music;
  for (const field of ["manufacturer", "model", "type", "category"]) {
    itemForm.elements[field].closest("label").hidden = music || publication;
    itemForm.elements[field].disabled = music || publication;
  }
}
recordKind.addEventListener("change", syncRecordKind);
syncRecordKind();

let session = null;
let knownTags = [];
let existingItems = [];
let previewUrls = [];

function setStatus(element, message, state = "") {
  element.textContent = message;
  element.className = element === saveStatus || element === editTagsStatus ? "save-status" : "form-status";
  if (state) element.classList.add(state);
}

function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem("neocache-admin-session"));
  } catch (error) {
    return null;
  }
}

function storeSession(value) {
  session = value;
  try {
    if (value) sessionStorage.setItem("neocache-admin-session", JSON.stringify(value));
    else sessionStorage.removeItem("neocache-admin-session");
  } catch (error) {
    // Session remains available for this page load if storage is blocked.
  }
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.msg || payload?.error_description || payload?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function authRequest(path, options = {}) {
  const response = await fetch(`${projectUrl}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: publicKey,
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers
    }
  });
  return parseResponse(response);
}

async function restRequest(path, options = {}) {
  const response = await fetch(`${projectUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  return parseResponse(response);
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `artifact-${Date.now()}`;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "en"));
}

function renderDatalist(element, values) {
  element.replaceChildren(...uniqueValues(values).map((value) => {
    const option = document.createElement("option");
    option.value = value;
    return option;
  }));
}

function addTagToInput(input, tag) {
  const current = input.value.split(",").map((value) => value.trim()).filter(Boolean);
  if (!current.some((value) => value.toLowerCase() === tag.toLowerCase())) current.push(tag);
  input.value = current.join(", ");
  input.focus();
}

function createKnownTagButtons(input) {
  return knownTags.map((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = input.disabled;
    button.textContent = `+ ${tag.name}`;
    button.addEventListener("click", () => addTagToInput(input, tag.name));
    return button;
  });
}

function renderKnownTags() {
  knownTagsElement.replaceChildren(...createKnownTagButtons(tagsInput));
  maintenanceKnownTags.replaceChildren(...createKnownTagButtons(existingItemTagsInput));
}

function renderExistingItems() {
  const currentValue = existingItemSelect.value;
  existingItemSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "CHOOSE ARCHIVE RECORD…";
  existingItemSelect.append(placeholder);
  existingItems.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = [item.title || "Untitled", item.manufacturer || item.model].filter(Boolean).join(" // ");
    existingItemSelect.append(option);
  });
  if (existingItems.some((item) => item.id === currentValue)) existingItemSelect.value = currentValue;
}

async function readEditorPages(query) {
  const rows = [];
  for (let offset = 0; ; ) {
    const page = await restRequest(`${query}&limit=100&offset=${offset}`);
    if (!page.length) return rows;
    rows.push(...page);
    offset += page.length;
  }
}

async function loadEditorData() {
  const currentSession = session;
  const [items, tags] = await Promise.all([
    readEditorPages(`items?select=${encodeURIComponent("*,item_tags(tag_id,tags(id,name)),music_details(*),publication_details(*)")}&order=title,id`),
    readEditorPages("tags?select=id,name&order=name,id")
  ]);
  if (session !== currentSession) return;
  existingItems = items;
  knownTags = tags;
  renderDatalist(typeOptions, items.map((item) => item.type));
  renderDatalist(categoryOptions, items.map((item) => item.category));
  renderKnownTags();
  renderExistingItems();
}

function refreshStorageFolders() {
  if (!session?.access_token || editorPanel.hidden || document.hidden) return Promise.resolve();
  if (folderRefresh) return folderRefresh;
  const currentSession = session;
  folderRefresh = (async () => {
    try {
      const folders = [];
      const limit = 100;
      for (let offset = 0; ; offset += limit) {
        const response = await fetch(`${projectUrl}/storage/v1/object/list/images`, {
          method: "POST",
          cache: "no-store",
          headers: {
            apikey: publicKey,
            Authorization: `Bearer ${currentSession.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ prefix: "", limit, offset, sortBy: { column: "name", order: "asc" } })
        });
        const entries = await parseResponse(response);
        if (session !== currentSession) return;
        folders.push(...entries.filter((entry) => entry.id === null && entry.metadata === null).map((entry) => entry.name));
        if (entries.length < limit) break;
      }
      renderDatalist(folderOptions, folders);
      folderStatus.textContent = "";
    } catch (error) {
      if (session !== currentSession) return;
      folderOptions.replaceChildren();
      folderStatus.textContent = `FOLDER LIST UNAVAILABLE // ${error.message}`;
    } finally {
      folderRefresh = null;
    }
  })();
  return folderRefresh;
}

folderInput.addEventListener("focus", refreshStorageFolders);
window.addEventListener("focus", refreshStorageFolders);
document.addEventListener("visibilitychange", refreshStorageFolders);
window.setInterval(refreshStorageFolders, 30000);

async function showEditor(user) {
  operatorEmail.textContent = user.email || user.id;
  loginPanel.hidden = true;
  editorPanel.hidden = false;
  void refreshStorageFolders();
  window.dispatchEvent(new Event("neocache-admin-ready"));
  try {
    await loadEditorData();
  } catch (error) {
    setStatus(saveStatus, `REFERENCE DATA OFFLINE // ${error.message}`, "error");
  }
}

async function restoreSession() {
  const saved = readSession();
  if (!saved?.access_token) return;
  storeSession(saved);
  try {
    const user = await authRequest("user", { method: "GET" });
    await showEditor(user);
  } catch (error) {
    storeSession(null);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector("button");
  submitButton.disabled = true;
  setStatus(loginStatus, "AUTHENTICATING…");
  try {
    const payload = await authRequest("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#login-email").value.trim(),
        password: document.querySelector("#login-password").value
      })
    });
    storeSession(payload);
    await showEditor(payload.user);
    loginForm.reset();
  } catch (error) {
    setStatus(loginStatus, `ACCESS DENIED // ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await authRequest("logout", { method: "POST" });
  } catch (error) {
    // Clear the local session even if the remote logout request fails.
  }
  storeSession(null);
  window.dispatchEvent(new Event("neocache-admin-logout"));
  folderOptions.replaceChildren();
  folderStatus.textContent = "";
  editorPanel.hidden = true;
  loginPanel.hidden = false;
});

function clearPreviews() {
  previewUrls.forEach(URL.revokeObjectURL);
  previewUrls = [];
  previews.replaceChildren();
}

function renderPreviews() {
  clearPreviews();
  const files = [...filesInput.files];
  files.forEach((file, index) => {
    const figure = document.createElement("figure");
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const image = document.createElement("img");
    image.src = url;
    image.alt = `Selected upload ${index + 1}`;
    const caption = document.createElement("figcaption");
    caption.textContent = `${index === 0 ? "PRIMARY // " : ""}${file.name}`;
    figure.append(image, caption);
    previews.append(figure);
  });
  fileDrop.classList.toggle("has-files", Boolean(files.length));
}

filesInput.addEventListener("change", renderPreviews);
for (const eventName of ["dragenter", "dragover"]) {
  fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    fileDrop.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  fileDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    fileDrop.classList.remove("dragging");
  });
}
fileDrop.addEventListener("drop", (event) => {
  const imageFiles = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
  const transfer = new DataTransfer();
  imageFiles.forEach((file) => transfer.items.add(file));
  filesInput.files = transfer.files;
  renderPreviews();
});

itemForm.elements.type.addEventListener("change", (event) => {
  if (folderInput.value) return;
  const folderByType = {
    "computer": "computers",
    "home console": "consoles",
    "handheld console": "handhelds",
    "game": "games",
    "merchandise": "merch"
  };
  const suggestedFolder = folderByType[event.target.value.trim().toLowerCase()];
  if ([...folderOptions.options].some((option) => option.value === suggestedFolder)) {
    folderInput.value = suggestedFolder;
  }
});

existingItemSelect.addEventListener("change", () => {
  const item = existingItems.find((entry) => entry.id === existingItemSelect.value);
  const tags = item?.item_tags
    ?.map((relation) => relation.tags?.name)
    .filter(Boolean) || [];
  document.querySelector("#existing-story-editor").hidden = !canHaveStory(item);
  document.querySelector("#existing-personal-story").value = item?.personal_story || "";
  document.querySelector("#story-status").textContent = "";
  existingItemTagsInput.value = tags.join(", ");
  existingItemTagsInput.disabled = !item;
  updateTagsButton.disabled = !item;
  maintenanceKnownTags.querySelectorAll("button").forEach((button) => {
    button.disabled = !item;
  });
  setStatus(editTagsStatus, "");
});

function canHaveStory(item) {
  if (!item || ["books", "comics"].includes(String(item.category).toLowerCase())) return false;
  if (item.publication_details) return false;
  const type = String(item.type || "").trim().toLowerCase();
  if (item.music_details && !["merch", "merchandise"].includes(type)) return false;
  if (/^(lp|vinyl|cd|sacd|cassette|audio cassette|tape|minidisc|7-inch single|12-inch single|ep|vinyl record|record|shellac|reel-to-reel)$/.test(type)) return false;
  return !(item.item_tags || []).some(relation => ["80s-room", "home-cinema", "house"].includes(String(relation.tags?.name).toLowerCase()));
}

document.querySelector("#save-story-button").addEventListener("click", async () => {
  const item = existingItems.find(entry => entry.id === existingItemSelect.value);
  if (!canHaveStory(item)) return;
  const button = document.querySelector("#save-story-button");
  const status = document.querySelector("#story-status");
  const story = document.querySelector("#existing-personal-story").value.trim();
  button.disabled = true;
  existingItemSelect.disabled = true;
  try {
    const updated = await restRequest(`items?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH", headers: {Prefer: "return=representation"},
      body: JSON.stringify({personal_story: story || null})
    });
    if (!updated.length) throw new Error("Record was not updated. Check permissions.");
    item.personal_story = story || null;
    setStatus(status, "PERSONAL STORY SAVED", "success");
  } catch (error) {
    setStatus(status, `STORY UPDATE INTERRUPTED // ${error.message}`, "error");
  } finally {
    button.disabled = false;
    existingItemSelect.disabled = false;
  }
});

async function uploadImage(file, storagePath) {
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${projectUrl}/storage/v1/object/images/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false"
    },
    body: file
  });
  return parseResponse(response);
}

async function deleteUploadedImage(storagePath) {
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${projectUrl}/storage/v1/object/images/${encodedPath}`, {
    method: "DELETE",
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${session.access_token}`
    }
  });
  return parseResponse(response);
}

async function discardIncompleteItem(itemId) {
  if (!itemId) return;
  await restRequest(`images?item_id=eq.${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  await restRequest(`item_tags?item_id=eq.${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  await restRequest(`items?id=eq.${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
}

async function ensureTags(tagNames) {
  const tagMap = new Map(knownTags.map((tag) => [tag.name.toLowerCase(), tag]));
  const selectedTags = [];
  for (const name of tagNames) {
    let tag = tagMap.get(name.toLowerCase());
    if (!tag) {
      const created = await restRequest("tags", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ name })
      });
      tag = created[0];
      knownTags.push(tag);
      tagMap.set(name.toLowerCase(), tag);
    }
    selectedTags.push(tag);
  }
  return selectedTags;
}

async function linkTags(itemId, selectedTags) {
  if (selectedTags.length) {
    await restRequest("item_tags", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(selectedTags.map((tag) => ({ item_id: itemId, tag_id: tag.id })))
    });
  }
}

async function createTags(itemId, tagNames) {
  const selectedTags = await ensureTags(tagNames);
  await linkTags(itemId, selectedTags);
}

async function replaceItemTags(itemId, tagNames) {
  // Create new tag definitions before changing any existing item relations.
  const selectedTags = await ensureTags(tagNames);
  await restRequest(`item_tags?item_id=eq.${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  await linkTags(itemId, selectedTags);
}

editTagsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const itemId = existingItemSelect.value;
  const item = existingItems.find((entry) => entry.id === itemId);
  if (!item) return;
  const tagNames = uniqueValues(existingItemTagsInput.value.split(",").map((value) => value.trim()));
  updateTagsButton.disabled = true;
  setStatus(editTagsStatus, "RETUNING TAG MATRIX…", "working");
  try {
    await replaceItemTags(itemId, tagNames);
    await loadEditorData();
    existingItemSelect.value = itemId;
    existingItemSelect.dispatchEvent(new Event("change"));
    setStatus(editTagsStatus, `TAG MATRIX UPDATED // ${(item.title || "UNTITLED").toUpperCase()}`, "success");
  } catch (error) {
    setStatus(editTagsStatus, `TAG UPDATE INTERRUPTED // ${error.message}`, "error");
  } finally {
    updateTagsButton.disabled = false;
  }
});

itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...filesInput.files];
  if (!files.length) {
    setStatus(saveStatus, "SELECT AT LEAST ONE IMAGE FILE", "error");
    return;
  }
  if (files.some((file) => !file.type.startsWith("image/"))) {
    setStatus(saveStatus, "ONLY IMAGE FILES CAN BE UPLOADED", "error");
    return;
  }

  saveButton.disabled = true;
  const formData = new FormData(itemForm);
  const title = String(formData.get("title")).trim();
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const folder = String(formData.get("folder")).trim().replace(/^\/+|\/+$/g, "");
  const item = { title, slug, owner_id: session.user.id };
  for (const field of ["manufacturer", "model", "type", "category", "condition", "location", "status", "notes"]) {
    const value = String(formData.get(field) || "").trim();
    if (value) item[field] = value;
  }
  if (formData.get("record_kind") === "artifact") {
    const story = String(formData.get("personal_story") || "").trim();
    if (story) item.personal_story = story;
  }
  const music = formData.get("record_kind") === "music" ? {} : null;
  if (music) {
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("music_") && String(value).trim()) music[key.slice(6)] = String(value).trim();
    }
    item.type = music.format;
    item.category = "Music";
  }
  const publication = ["books", "comics"].includes(formData.get("record_kind")) ? {kind: formData.get("record_kind")} : null;
  if (publication) {
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("publication_") && String(value).trim()) publication[key.slice(12)] = String(value).trim();
    }
    if (publication.isbn) {
      publication.isbn = window.NeoCacheISBN.normalize(publication.isbn);
      if (!window.NeoCacheISBN.valid(publication.isbn)) {
        setStatus(saveStatus, "INVALID ISBN // Check the digits or leave ISBN blank", "error");
        saveButton.disabled = false;
        return;
      }
    }
    item.type = publication.format;
    item.category = publication.kind === "books" ? "Books" : "Comics";
  }
  const year = Number.parseInt(formData.get("year"), 10);
  if (Number.isFinite(year)) item.year = year;
  const tagNames = uniqueValues(String(formData.get("tags") || "").split(",").map((value) => value.trim()));
  const room = String(formData.get("room") || "");
  if (["80s-room", "home-cinema", "house"].includes(room) && !tagNames.includes(room)) tagNames.push(room);
  const uploadedPaths = [];
  let createdItemId = null;

  try {
    if (typeof window !== "undefined" && window.NeoCacheDuplicates?.beforeSave &&
        !await window.NeoCacheDuplicates.beforeSave(Object.fromEntries(formData))) {
      setStatus(saveStatus, "CHECK DUPLICATE WARNING // Nothing has been uploaded or saved", "error");
      return;
    }
    if (publication) await restRequest("publication_details?select=item_id&limit=0");
    if (music) {
      // Verify the migration is installed before uploading any files.
      await restRequest("music_details?select=item_id&limit=0");
    }
    // Upload every file before creating database records. Storage validation (for
    // example the bucket's file-size limit) can then fail without leaving an item.
    setStatus(saveStatus, `01 / 04 // VALIDATING ${files.length} IMAGE SIGNAL${files.length === 1 ? "" : "S"}…`, "working");
    const stamp = Date.now().toString(36);
    const pendingImages = [];
    for (const [index, file] of files.entries()) {
      const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "jpg";
      const storagePath = `${folder}/${slug}-${stamp}-${index + 1}.${extension || "jpg"}`;
      await uploadImage(file, storagePath);
      uploadedPaths.push(storagePath);
      pendingImages.push({ storagePath, isPrimary: index === 0, sortOrder: index });
    }

    setStatus(saveStatus, "02 / 04 // CREATING ITEM RECORD…", "working");
    const createdItems = await restRequest("items", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(item)
    });
    const createdItem = createdItems[0];
    createdItemId = createdItem.id;
    if (music) {
      await restRequest("music_details", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ item_id: createdItem.id, ...music })
      });
    }

    if (publication) {
      await restRequest("publication_details", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({item_id: createdItem.id, ...publication})
      });
    }
    const imageRecords = pendingImages.map((image) => ({
        item_id: createdItem.id,
        storage_path: image.storagePath,
        is_primary: image.isPrimary,
        sort_order: image.sortOrder
      }));

    setStatus(saveStatus, "03 / 04 // INDEXING IMAGE RECORDS…", "working");
    await restRequest("images", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(imageRecords)
    });

    setStatus(saveStatus, "04 / 04 // LINKING TAG MATRIX…", "working");
    await createTags(createdItem.id, tagNames);
    setStatus(saveStatus, `ARCHIVE COMMIT COMPLETE // ${title.toUpperCase()}`, "success");
    itemForm.reset();
    syncRecordKind();
    clearPreviews();
    void refreshStorageFolders();
    try {
      await loadEditorData();
    } catch (error) {
      setStatus(saveStatus, `ARCHIVE COMMIT COMPLETE // Reference data could not refresh: ${error.message}`, "success");
    }
  } catch (error) {
    const cleanupResults = await Promise.allSettled([
      discardIncompleteItem(createdItemId),
      ...uploadedPaths.map(deleteUploadedImage)
    ]);
    const cleanupFailed = cleanupResults.some((result) => result.status === "rejected");
    setStatus(
      saveStatus,
      `ARCHIVE COMMIT INTERRUPTED // ${error.message}${cleanupFailed ? " // CLEANUP INCOMPLETE" : " // NOTHING CREATED"}`,
      "error"
    );
  } finally {
    saveButton.disabled = false;
  }
});

if (!projectUrl || !publicKey || projectUrl.includes("DIT-PROJEKT")) {
  loginForm.querySelector("button").disabled = true;
  setStatus(loginStatus, "CONFIG.JS IS NOT CONFIGURED", "error");
} else {
  restoreSession();
}
