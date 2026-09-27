// Load the pre-populated FandomVerse content from JSON.
let categories;
let images;
let articles;
let characters;
let events;
let media;
let merchandise;
let faqs;
let aboutData;
let contactData;

window.fandomDataLoaded = false;
window.fandomDataReady = fetch("./data.json")
  .then(response => {
    if (!response.ok) throw new Error(`Could not load data.json (${response.status})`);
    return response.json();
  })
  .then(data => {
    ({ categories, images, articles, characters, events, media, merchandise, faqs, about: aboutData, contact: contactData } = data);
    window.fandomDataLoaded = true;
    return data;
  })
  .catch(error => {
    console.error("FandomVerse JSON data failed to load:", error);
    const notice = document.createElement("p");
    notice.className = "container";
    notice.style.cssText = "padding:2rem 1rem;color:var(--muted-foreground);text-align:center";
    notice.textContent = "Fandom content could not be loaded. Open this site through a local web server so its JSON data can be fetched.";
    document.body.prepend(notice);
    return null;
  });

function catName(slug) {
  const category = categories?.find(item => item.slug === slug);
  return category ? category.name : slug;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
