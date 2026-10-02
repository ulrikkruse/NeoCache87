const config = window.NEOCACHE_CONFIG || {};
const musicPage = document.body.classList.contains("music-page");
const publicationPage = document.body.classList.contains("books-page") ? "books" : document.body.classList.contains("comics-page") ? "comics" : "";
const collectionPage = publicationPage || (musicPage ? "music" : "archive");
function itemCollection(item) {
  if (["books", "comics"].includes(item.publication_details?.kind)) return item.publication_details.kind;
  const category = String(typeof item.category === "string" ? item.category : item.category?.name || "").toLowerCase();
  if (["books", "comics"].includes(category)) return category;
  return isMusicItem(item) ? "music" : "archive";
}
function isMusicItem(item) {
  const type = String(typeof item.type === "string" ? item.type : item.type?.name || item.item_type || "").trim().toLowerCase();
  if (["merch", "merchandise"].includes(type)) return false;
  if (item.music_details) return true;
  // A music category can also describe posters and other merchandise.
  // Legacy records must identify an actual audio format to appear in Music.
  return /^(lp|vinyl|cd|sacd|cassette|audio cassette|tape|minidisc|7-inch single|12-inch single|ep|vinyl record|record|shellac|reel-to-reel)$/.test(type);
}
function collectionCategory(item) {
  if (publicationPage) return item.publication_details?.[publicationPage === "comics" ? "series" : "author"] || (publicationPage === "comics" ? "Unspecified series" : "Unknown author");
  return musicPage ? item.music_details?.artist || "Unknown artist" : getCategory(item);
}

const grid = document.querySelector("#item-grid");
const statusBox = document.querySelector("#status");
const count = document.querySelector("#item-count");
const filters = document.querySelector("#filters");
const typeFilter = document.querySelector("#type-filter");
const categoryFilter = document.querySelector("#category-filter");
const tagFilter = document.querySelector("#tag-filter");
const searchFilter = document.querySelector("#search-filter");
const randomItemButton = document.querySelector("#random-item");
const lightbox = document.querySelector("#image-lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxTitle = document.querySelector("#lightbox-title");
const imageCounter = document.querySelector("#image-counter");
const previousImage = document.querySelector("#previous-image");
const nextImage = document.querySelector("#next-image");
const closeLightbox = document.querySelector("#close-lightbox");
const detailDialog = document.querySelector("#item-detail");
const detailContent = document.querySelector("#detail-content");
const closeDetail = document.querySelector("#close-detail");
const bootSequence = document.querySelector("#boot-sequence");
const skipBoot = document.querySelector("#skip-boot");
const archiveStats = document.querySelector("#archive-stats");
const statItems = document.querySelector("#stat-items");
const statCategories = document.querySelector("#stat-categories");
const statTags = document.querySelector("#stat-tags");
const statOldest = document.querySelector("#stat-oldest");
const originTrigger = document.querySelector("#origin-trigger");
const originDialog = document.querySelector("#origin-transmission");
const closeOrigin = document.querySelector("#close-origin");
const DEFAULT_ITEM_LIMIT = 9;
const NEW_SIGNAL_DAYS = 30;
let allItems = [];
let visibleItems = [];
let viewerImages = [];
let viewerIndex = 0;
let viewerTitle = "";
let glitchTimer;
let bootTimer;
document.querySelector("#year").textContent = new Date().getFullYear();

function finishBoot() {
  clearTimeout(bootTimer);
  bootSequence.classList.add("closing");
  document.body.classList.remove("booting");
  setTimeout(() => {
    bootSequence.hidden = true;
    bootSequence.classList.remove("closing");
  }, 260);
  try {
    localStorage.setItem("neocache-booted", "true");
  } catch (error) {
    // The site still works when browser storage is unavailable.
  }
}

function startBoot() {
  if (musicPage || publicationPage) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let hasBooted = false;
  try {
    hasBooted = localStorage.getItem("neocache-booted") === "true";
  } catch (error) {
    // Fall back to showing the sequence once for this page load.
  }
  if (hasBooted || reduceMotion) return;
  bootSequence.hidden = false;
  document.body.classList.add("booting");
  bootTimer = setTimeout(finishBoot, 2300);
}

skipBoot.addEventListener("click", finishBoot);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !bootSequence.hidden) finishBoot();
});
startBoot();

function resolveImageUrl(image) {
  const source = image.url || image.image_url || image.path || image.storage_path;
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return source;

  // Relative paths are assumed to be in a public Storage bucket named "images".
  const cleanPath = source.replace(/^\/+/, "");
  const projectUrl = config.SUPABASE_URL.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
  return `${projectUrl}/storage/v1/object/public/images/${cleanPath}`;
}

function getItemImages(item) {
  const images = Array.isArray(item.images) ? [...item.images] : [];
  images.sort((a, b) => Number(Boolean(b.is_primary || b.primary)) - Number(Boolean(a.is_primary || a.primary)));
  const resolved = images
    .map((image) => ({
      url: resolveImageUrl(image),
      caption: image.caption || image.alt_text || image.title || ""
    }))
    .filter((image) => image.url);
  return resolved.filter((image, index) => resolved.findIndex((entry) => entry.url === image.url) === index);
}

function getPrimaryImage(item) {
  return getItemImages(item)[0]?.url || null;
}

function getTags(item) {
  if (Array.isArray(item.tags)) {
    return item.tags
      .map((tag) => typeof tag === "string" ? tag : tag.name || tag.title || tag.slug)
      .filter(Boolean);
  }
  if (!Array.isArray(item.item_tags)) return [];
  return item.item_tags
    .map((relation) => relation.tags?.name || relation.tags?.title || relation.tag?.name)
    .filter(Boolean);
}

function getCategory(item) {
  const tags = getTags(item);
  const category = typeof item.category === "string" ? item.category : item.category?.name;
  return category || item.category_name || tags[0] || "Uncategorized";
}

function getType(item) {
  const type = typeof item.type === "string" ? item.type : item.type?.name;
  if (item.publication_details) return type?.trim() || item.publication_details.format || item.item_type || "Unknown";
  if (isMusicItem(item) && item.music_details?.format) return item.music_details.format;
  return type || item.item_type || "Unknown";
}

function isRecentItem(item) {
  const createdAt = new Date(item.created_at).getTime();
  if (!Number.isFinite(createdAt)) return false;
  const age = Date.now() - createdAt;
  return age >= 0 && age <= NEW_SIGNAL_DAYS * 24 * 60 * 60 * 1000;
}

function buildItemUrl(item) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("item", item.slug || item.id);
  return url;
}

function updateItemUrl(item) {
  window.history.replaceState(null, "", buildItemUrl(item));
}

function clearItemUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("item")) return;
  url.searchParams.delete("item");
  window.history.replaceState(null, "", url);
}

async function copyItemLink(item, button) {
  const link = buildItemUrl(item).href;
  try {
    await navigator.clipboard.writeText(link);
  } catch (error) {
    const input = document.createElement("textarea");
    input.value = link;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  button.textContent = "LINK COPIED // READY TO TRANSMIT";
  setTimeout(() => { button.textContent = "COPY ITEM LINK"; }, 1800);
}

function updateArchiveStatistics() {
  const categories = new Set(allItems.map(collectionCategory).filter((value) => value !== "Uncategorized"));
  const tags = new Set(allItems.flatMap(getTags));
  const years = allItems.map((item) => Number.parseInt(item.year, 10)).filter(Number.isFinite);
  statItems.textContent = String(allItems.length).padStart(2, "0");
  statCategories.textContent = String(categories.size).padStart(2, "0");
  statTags.textContent = String(tags.size).padStart(2, "0");
  statOldest.textContent = years.length ? String(Math.min(...years)) : "----";
  archiveStats.hidden = false;
}

function textElement(tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  return element;
}

function addMetadata(list, label, value) {
  const wrapper = document.createElement("div");
  wrapper.append(textElement("dt", "", label), textElement("dd", "", value || "Unknown"));
  list.append(wrapper);
}

function renderViewerImage() {
  const image = viewerImages[viewerIndex];
  if (!image) return;
  lightboxImage.src = image.url;
  lightboxImage.alt = viewerTitle ? `${viewerTitle} – image ${viewerIndex + 1}` : `Archive image ${viewerIndex + 1}`;
  lightboxTitle.textContent = image.caption || viewerTitle || "Untitled archive image";
  imageCounter.textContent = `IMAGE ${String(viewerIndex + 1).padStart(2, "0")} / ${String(viewerImages.length).padStart(2, "0")}`;
  const hasMultipleImages = viewerImages.length > 1;
  previousImage.hidden = !hasMultipleImages;
  nextImage.hidden = !hasMultipleImages;
}

function openImageViewer(images, title, startIndex = 0) {
  if (!images.length) return;
  viewerImages = images;
  viewerTitle = title || "";
  viewerIndex = Math.min(Math.max(startIndex, 0), images.length - 1);
  renderViewerImage();
  lightbox.showModal();
}

function moveViewer(direction) {
  viewerIndex = (viewerIndex + direction + viewerImages.length) % viewerImages.length;
  renderViewerImage();
}

closeLightbox.addEventListener("click", () => lightbox.close());
previousImage.addEventListener("click", () => moveViewer(-1));
nextImage.addEventListener("click", () => moveViewer(1));
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});
lightbox.addEventListener("close", () => {
  lightboxImage.removeAttribute("src");
});
document.addEventListener("keydown", (event) => {
  if (!lightbox.open || viewerImages.length < 2) return;
  if (event.key === "ArrowLeft") moveViewer(-1);
  if (event.key === "ArrowRight") moveViewer(1);
});

closeDetail.addEventListener("click", () => detailDialog.close());
detailDialog.addEventListener("click", (event) => {
  if (event.target === detailDialog) detailDialog.close();
});
detailDialog.addEventListener("close", clearItemUrl);

originTrigger.addEventListener("click", () => originDialog.showModal());
closeOrigin.addEventListener("click", () => originDialog.close());
originDialog.addEventListener("click", (event) => {
  if (event.target === originDialog) originDialog.close();
});

function openItemDetail(item, updateUrl = true) {
  const images = getItemImages(item);
  const tags = [...new Set(getTags(item))];
  const title = item.title || "Untitled";
  const makeModel = [item.publication_details?.author || item.music_details?.artist || item.manufacturer || item.producer, item.publication_details?.publisher || item.music_details?.label || item.model]
    .filter((value) => value && String(value).trim().toLowerCase() !== "unknown manufacturer")
    .join(" · ");

  const media = document.createElement(images.length ? "button" : "div");
  media.className = "detail-media";
  if (images.length) {
    media.type = "button";
    media.setAttribute("aria-label", `Open image gallery for ${title}`);
    const image = document.createElement("img");
    image.src = images[0].url;
    image.alt = `${title} – primary image`;
    media.append(image, textElement("span", "detail-gallery-label", `VIEW GALLERY // ${images.length} ${images.length === 1 ? "IMAGE" : "IMAGES"}`));
    media.addEventListener("click", () => openImageViewer(images, title));
  } else {
    media.append(textElement("div", "image-placeholder", "NO IMAGE DATA"));
  }

  const information = document.createElement("div");
  information.className = "detail-information";
  information.append(textElement("p", "detail-kicker", `// RECORD ${String(allItems.indexOf(item) + 1).padStart(3, "0")}`));
  const heading = textElement("h2", "", title);
  heading.id = "detail-title";
  information.append(heading);
  if (makeModel) information.append(textElement("p", "detail-make", makeModel));

  const metadata = document.createElement("dl");
  metadata.className = "detail-metadata";
  addMetadata(metadata, "Year", item.year);
  addMetadata(metadata, "Type", getType(item));
  addMetadata(metadata, "Category", getCategory(item));
  if (item.music_details) {
    for (const [label, key] of [["Artist", "artist"], ["Format", "format"], ["Label", "label"], ["Catalog no.", "catalog_number"], ["Barcode", "barcode"], ["Country", "country"], ["Edition", "edition"], ["Matrix / runout", "matrix"], ["Media condition", "media_condition"], ["Sleeve condition", "sleeve_condition"], ["Discogs release ID", "discogs_release_id"], ["MusicBrainz release ID", "musicbrainz_release_id"]]) {
      if (item.music_details[key]) addMetadata(metadata, label, item.music_details[key]);
    }
  }
  if (item.publication_details) {
    for (const [label, key] of [["Author / writer", "author"], ["Publisher", "publisher"], ["Language", "language"], ["Edition", "edition"], ["ISBN", "isbn"], ["Series", "series"], ["Issue / volume", "issue"], ["Illustrator", "illustrator"]]) {
      if (item.publication_details[key]) addMetadata(metadata, label, item.publication_details[key]);
    }
  }
  information.append(metadata);

  const description = item.description || item.notes || item.summary;
  if (description) information.append(textElement("p", "detail-description", description));
  if (collectionPage === "archive" && item.personal_story?.trim()) {
    const story = document.createElement("section");
    story.className = "personal-story";
    story.setAttribute("aria-label", "Personal story");
    story.append(textElement("h3", "detail-kicker", "PERSONAL STORY"), textElement("p", "detail-description", item.personal_story));
    information.append(story);
  }
  if (tags.length) {
    const tagList = document.createElement("div");
    tagList.className = "tag-list detail-tags";
    tagList.setAttribute("aria-label", "Tags");
    tags.forEach((tag) => tagList.append(textElement("span", "tag-chip", `#${tag}`)));
    information.append(tagList);
  }

  const shareButton = textElement("button", "detail-share-button", "COPY ITEM LINK");
  shareButton.type = "button";
  shareButton.addEventListener("click", () => copyItemLink(item, shareButton));
  information.append(shareButton);

  detailContent.replaceChildren(media, information);
  if (updateUrl) updateItemUrl(item);
  detailDialog.showModal();
}

function createCard(item, index) {
  const card = document.createElement("article");
  card.className = "item-card";

  const imageUrl = getPrimaryImage(item);
  const imageWrap = document.createElement(imageUrl ? "button" : "div");
  imageWrap.className = "image-wrap";

  if (imageUrl) {
    const images = getItemImages(item);
    imageWrap.type = "button";
    imageWrap.classList.add("has-image");
    imageWrap.setAttribute("aria-label", `View full image of ${item.title || "this item"}`);
    imageWrap.addEventListener("click", () => openImageViewer(images, item.title));
    const image = document.createElement("img");
    image.className = "item-image";
    image.src = imageUrl;
    image.alt = item.title ? `${item.title} – primary image` : "Primary image";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      imageWrap.disabled = true;
      imageWrap.classList.remove("has-image");
      image.replaceWith(textElement("div", "image-placeholder", "IMAGE NOT FOUND"));
    });
    imageWrap.append(image);
  } else {
    imageWrap.append(textElement("div", "image-placeholder", "NO IMAGE DATA"));
  }
  imageWrap.append(textElement("span", "card-index", String(index + 1).padStart(3, "0")));
  if (isRecentItem(item)) imageWrap.append(textElement("span", "new-signal", "NEW SIGNAL"));

  const content = document.createElement("div");
  content.className = "item-content";
  const category = getCategory(item);
  const type = getType(item);
  const tags = [...new Set(getTags(item))];
  const makeModel = [item.publication_details?.author || item.music_details?.artist || item.manufacturer || item.producer, item.publication_details?.publisher || item.music_details?.label || item.model]
    .filter((value) => value && String(value).trim().toLowerCase() !== "unknown manufacturer")
    .join(" · ");
  content.append(textElement("h3", "", item.title || "Untitled"));
  if (makeModel) content.append(textElement("p", "make-model", makeModel));
  if (tags.length) {
    const tagList = document.createElement("div");
    tagList.className = "tag-list";
    tagList.setAttribute("aria-label", "Tags");
    tags.forEach((tag) => {
      const tagButton = textElement("button", "tag-chip", `#${tag}`);
      tagButton.type = "button";
      tagButton.classList.toggle("active", tagFilter.value === tag);
      tagButton.setAttribute("aria-pressed", String(tagFilter.value === tag));
      tagButton.setAttribute("aria-label", `Filter archive by tag ${tag}`);
      tagButton.addEventListener("click", () => {
        tagFilter.value = tagFilter.value === tag ? "" : tag;
        applyFilters();
      });
      tagList.append(tagButton);
    });
    content.append(tagList);
  }

  const metadata = document.createElement("dl");
  metadata.className = "metadata";
  addMetadata(metadata, "Year", item.year);
  addMetadata(metadata, "Type", type);
  addMetadata(metadata, "Category", category);
  content.append(metadata);

  const openFileButton = textElement("button", "open-file-button", "OPEN DOSSIER →");
  openFileButton.type = "button";
  openFileButton.setAttribute("aria-label", `Open details for ${item.title || "this item"}`);
  openFileButton.addEventListener("click", () => openItemDetail(item));
  content.append(openFileButton);
  card.append(imageWrap, content);
  return card;
}

function showMessage(message, isError = false) {
  statusBox.hidden = false;
  statusBox.classList.toggle("error", isError);
  statusBox.replaceChildren(textElement("p", "", message));
}

function addFilterOptions(select, values) {
  const options = [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value.toUpperCase();
    select.append(option);
  });
}

function triggerGridGlitch() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  clearTimeout(glitchTimer);
  grid.classList.remove("retuning");
  void grid.offsetWidth;
  grid.classList.add("retuning");
  glitchTimer = setTimeout(() => grid.classList.remove("retuning"), 520);
}

function applyFilters() {
  const selectedType = typeFilter.value;
  const selectedCategory = categoryFilter.value;
  const selectedTag = tagFilter.value;
  const searchTerm = searchFilter.value.trim().toLowerCase();
  visibleItems = allItems.filter((item) => {
    const typeMatches = !selectedType || getType(item) === selectedType;
    const categoryMatches = !selectedCategory || collectionCategory(item) === selectedCategory;
    const tagMatches = !selectedTag || getTags(item).includes(selectedTag);
    const searchableText = [
      item.title,
      ...Object.values(item.music_details || {}),
      ...Object.values(item.publication_details || {}),
      item.manufacturer,
      item.producer,
      item.model,
      item.year,
      getType(item),
      getCategory(item),
      ...getTags(item)
    ].filter(Boolean).join(" ").toLowerCase();
    const searchMatches = !searchTerm || searchableText.includes(searchTerm);
    return typeMatches && categoryMatches && tagMatches && searchMatches;
  });

  const hasActiveFilter = Boolean(selectedType || selectedCategory || selectedTag || searchTerm);
  const displayedItems = (musicPage || publicationPage || hasActiveFilter) ? visibleItems : visibleItems.slice(0, DEFAULT_ITEM_LIMIT);
  count.textContent = `${displayedItems.length} / ${allItems.length} ${allItems.length === 1 ? "item" : "items"}`;
  randomItemButton.disabled = !visibleItems.length;
  grid.replaceChildren(...displayedItems.map(createCard));
  triggerGridGlitch();
  if (visibleItems.length) {
    statusBox.hidden = true;
  } else {
    showMessage("NO MATCHING SIGNALS // RETUNE THE ARCHIVE");
  }
}

filters.addEventListener("change", applyFilters);
searchFilter.addEventListener("input", applyFilters);
filters.addEventListener("reset", () => requestAnimationFrame(applyFilters));
randomItemButton.addEventListener("click", () => {
  if (!visibleItems.length) return;
  const randomIndex = Math.floor(Math.random() * visibleItems.length);
  openItemDetail(visibleItems[randomIndex]);
});

async function loadItems() {
  const { SUPABASE_URL, SUPABASE_PUBLIC_KEY } = config;
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY || SUPABASE_URL.includes("DIT-PROJEKT")) {
    count.textContent = "Configuration missing";
    showMessage("Add your Supabase URL and public key to config.js.", true);
    return;
  }

  const select = "*,images(*),item_tags(tags(*)),music_details(*),publication_details(*)";
  // Accept both the project base URL and a URL that already includes /rest/v1.
  const projectUrl = SUPABASE_URL.replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
  const endpoint = `${projectUrl}/rest/v1/items?select=${encodeURIComponent(select)}&order=created_at.desc,id.asc&limit=100`;

  try {
    let requestEndpoint = endpoint;
    let response = await fetch(requestEndpoint, {
      headers: {
        apikey: SUPABASE_PUBLIC_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`
      }
    });
    // Older deployments can still serve existing collections before migrations.
    for (let attempt = 0; !response.ok && attempt < 2; attempt++) {
      const error = await response.clone().json().catch(() => null);
      const missing = ["publication_details", "music_details"].find(name => String(error?.message).includes(name));
      if (error?.code !== "PGRST200" || !missing || (missing === "publication_details" && publicationPage) || (missing === "music_details" && musicPage)) break;
      const requestUrl = new URL(requestEndpoint);
      requestUrl.searchParams.set("select", requestUrl.searchParams.get("select").replace(`,${missing}(*)`, ""));
      requestEndpoint = requestUrl.toString();
      response = await fetch(requestEndpoint, {headers:{apikey:SUPABASE_PUBLIC_KEY, Authorization:`Bearer ${SUPABASE_PUBLIC_KEY}`}});
    }
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      throw new Error(details?.message || `Supabase responded with HTTP ${response.status}`);
    }

    const items = await response.json();
    let page = items;
    while (page.length) {
      const nextResponse = await fetch(`${requestEndpoint}&offset=${items.length}`, {
        headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}` }
      });
      if (!nextResponse.ok) throw new Error(`Supabase responded with HTTP ${nextResponse.status}`);
      page = await nextResponse.json();
      items.push(...page);
    }
    // Room gallery records are excluded before building archive cards, filters,
    // statistics, random selections, and direct item links.
    allItems = items.filter((item) => itemCollection(item) === collectionPage && !getTags(item).some((tag) =>
      ["80s-room", "home-cinema"].includes(String(tag).trim().toLowerCase())
    ));
    count.textContent = `${allItems.length} ${allItems.length === 1 ? "item" : "items"}`;
    if (!allItems.length) {
      showMessage(collectionPage === "archive" ? "The archive is empty. No items were found." : `No ${collectionPage} yet. Check back soon.`);
      return;
    }

    addFilterOptions(typeFilter, allItems.map(getType));
    addFilterOptions(categoryFilter, allItems.map(collectionCategory));
    addFilterOptions(tagFilter, allItems.flatMap(getTags));
    updateArchiveStatistics();
    filters.hidden = false;
    applyFilters();
    const requestedItem = new URLSearchParams(window.location.search).get("item");
    if (requestedItem) {
      const item = allItems.find((entry) => String(entry.slug || "") === requestedItem || String(entry.id) === requestedItem);
      if (item) openItemDetail(item, false);
    }
  } catch (error) {
    console.error("NeoCache could not retrieve items:", error);
    count.textContent = "Connection error";
    showMessage(`${error.message}. Check config.js, table relationships, and Supabase RLS policies.`, true);
  }
}

loadItems();
